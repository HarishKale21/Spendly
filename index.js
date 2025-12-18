const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "PocketWatcher_Bhai_Secret_Key_123"; // Isse secure rakhein

// --- 1. Database Connection ---
const MONGO_URI = "mongodb+srv://harishkale532_db_user:harish123@cluster0.8ql1phg.mongodb.net/PocketWatcher?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Database connected Successfully✅"))
  .catch((err) => console.log("Could not connect to database: ", err.message));

// --- 2. Schemas & Models ---

// User Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  date: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Expense Model (Kharcha) - Added User Reference
const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 👈 User se link
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: 'General' },
  date: { type: Date, default: Date.now }
});
const Expense = mongoose.model('Expense', expenseSchema);

// Debt Model (Udhaar) - Added User Reference
const debtSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 👈 User se link
  friendName: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['To Receive', 'To Pay'], required: true },
  status: { type: String, default: 'Pending' }, 
  date: { type: Date, default: Date.now }
});
const Debt = mongoose.model('Debt', debtSchema);

// --- 3. Middleware to Verify Token (Security Guard) ---
const fetchUser = (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).send({ error: "Please authenticate using a valid token" });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ error: "Invalid Token!" });
  }
};

// --- 4. AUTH ROUTES ---

// Signup: Register a new user
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: "Email is already registered!" });

    const salt = await bcrypt.genSalt(10);
    const securedPassword = await bcrypt.hash(password, salt);

    user = await User.create({ name, email, password: securedPassword });
    const data = { user: { id: user.id } };
    const authToken = jwt.sign(data, JWT_SECRET);
    res.json({ success: true, authToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login: Existing user login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Wrong details!" });

    const passwordCompare = await bcrypt.compare(password, user.password);
    if (!passwordCompare) return res.status(400).json({ error: "Wrong password!" });

    const data = { user: { id: user.id } };
    const authToken = jwt.sign(data, JWT_SECRET);
    res.json({ success: true, authToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 5. PROTECTED DATA ROUTES (fetchUser middleware added) ---

// Add Expense (Linked to User)
app.post('/add-expense', fetchUser, async (req, res) => {
  try {
    const { title, amount, category } = req.body;
    const newExpense = new Expense({ user: req.user.id, title, amount, category });
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User's Expenses
app.get('/all-expenses', fetchUser, async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Debt (Linked to User)
app.post('/add-debt', fetchUser, async (req, res) => {
  try {
    const { friendName, amount, type } = req.body;
    const newDebt = new Debt({ user: req.user.id, friendName, amount, type });
    await newDebt.save();
    res.status(201).json(newDebt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User's Debts
app.get('/all-debts', fetchUser, async (req, res) => {
  try {
    const debts = await Debt.find({ user: req.user.id, status: 'Pending' }).sort({ date: -1 });
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Expense Delete Karne ke liye ---
app.delete('/delete-expense/:id', fetchUser, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: "Kharcha nahi mila!" });

    // Check karo ki ye kharcha usi user ka hai jo delete kar raha hai
    if (expense.user.toString() !== req.user.id) {
      return res.status(401).json({ error: "Access Denied: Not your record" });
    }
 
    // Debt Delete karne ke liye
app.delete('/delete-debt/:id', fetchUser, async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    if (!debt) return res.status(404).json({ error: "Debt record not found!" });

    if (debt.user.toString() !== req.user.id) {
      return res.status(401).json({ error: "Not Allowed" });
    }

    await Debt.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Debt deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
    
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Expense deleted! 🗑️" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settle Debt
app.put('/settle-debt/:id', fetchUser, async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    if(debt.user.toString() !== req.user.id) return res.status(401).send("Not Allowed");
    
    await Debt.findByIdAndUpdate(req.params.id, { status: 'Settled' });
    res.json({ message: "Balance settled!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Server Start ---
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
