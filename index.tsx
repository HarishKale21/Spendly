import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Dimensions, StatusBar, Alert, useColorScheme, Platform, ActivityIndicator } from 'react-native';
import { PieChart } from "react-native-chart-kit";
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 👈 Token storage ke liye

// --- Voice Recognition Setup ---
let VoiceModule: any = null;
let useSpeechRecognitionEvent: any = () => {}; 
try {
  const VoiceLib = require("expo-speech-recognition");
  VoiceModule = VoiceLib.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = VoiceLib.useSpeechRecognitionEvent;
} catch (e) {
  console.log("Voice module support issue in Expo Go");
}

const API_URL = "https://spendly-uwqn.onrender.com"; 
const screenWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const router = useRouter();
  const systemTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');
  const [activeTab, setActiveTab] = useState<'Expenses' | 'Debts'>('Expenses');
  const [modalVisible, setModalVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [friendName, setFriendName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtType, setDebtType] = useState('To Receive');

  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Others'];

  const colors = {
    bg: isDarkMode ? '#121212' : '#F4F7FA',
    card: isDarkMode ? '#1E1E1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#2D3436',
    subText: isDarkMode ? '#B0B0B0' : '#636E72',
    border: isDarkMode ? '#333' : '#F0F0F0',
    header: isDarkMode ? '#1A1A1A' : '#0984E3'
  };
 const handleLogout = async () => {
  try {
    await AsyncStorage.removeItem('token'); // Token saaf kiya
    router.replace('/login'); // Login screen par bhej diya
  } catch (e) {
    console.error("Logout Error:", e);
  }
};

  // --- Utility: Get Headers with Token ---
  const getAuthConfig = async () => {
    const token = await AsyncStorage.getItem('token');
    return { headers: { "auth-token": token } };
  };

  // --- Voice Logic ---
  useSpeechRecognitionEvent("result", (event: any) => {
    const transcript = event.results[0]?.transcript.toLowerCase();
    if (transcript) processVoiceInput(transcript);
  });

  const startVoiceRecording = async () => {
    if (!VoiceModule) {
      Alert.alert("Voice recognition requires a Development Build.");
      return;
    }
    const result = await VoiceModule.requestPermissionsAsync();
    if (result.granted) VoiceModule.start({ lang: "en-US", interimResults: true });
  };

  const processVoiceInput = (text: string) => {
    const numbers = text.match(/\d+/);
    if (numbers) activeTab === 'Expenses' ? setAmount(numbers[0]) : setDebtAmount(numbers[0]);
    const foundCategory = categories.find(cat => text.includes(cat.toLowerCase()));
    if (foundCategory) setCategory(foundCategory);
    const categoryToReplace = foundCategory || category;
    const cleanText = text.replace(/\d+/g, '').replace(categoryToReplace.toLowerCase(), '').trim();
    activeTab === 'Expenses' ? setTitle(cleanText) : setFriendName(cleanText);
  };

  // --- API Logic (Updated for Security) ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const config = await getAuthConfig(); // 👈 Token mangwao
      const [expRes, debtRes] = await Promise.all([
        axios.get(`${API_URL}/all-expenses`, config),
        axios.get(`${API_URL}/all-debts`, config)
      ]);
      setTransactions(expRes.data || []);
      setDebts(debtRes.data || []);
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert("Please Login first");
      }
      console.log("Fetch Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddEntry = async () => {
    const isExp = activeTab === 'Expenses';
    const currentTitle = isExp ? title : friendName;
    const currentAmount = isExp ? amount : debtAmount;

    if (!currentTitle || !currentAmount) return Alert.alert("Wait!", "Fill details!");

    try {
      const config = await getAuthConfig(); // 👈 Auth Header
      if (isExp) {
        await axios.post(`${API_URL}/add-expense`, { title, amount: parseFloat(amount), category: category }, config);
      } else {
        await axios.post(`${API_URL}/add-debt`, { friendName, amount: parseFloat(debtAmount), type: debtType }, config);
      }
      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (e: any) { 
      console.log(e.response?.data);
      Alert.alert("Error", "Could not save. Please check your token!"); 
    }
  };

  const handleDelete = async (id: string) => {
  const isExp = activeTab === 'Expenses';
  const endpoint = isExp ? 'delete-expense' : 'delete-debt';

  Alert.alert("Delete?", "Are you sure you want to remove this entry?", [
    { text: "No" },
    { 
      text: "Yes", 
      onPress: async () => {
        try {
          const config = await getAuthConfig();
          // Endpoint dynamically change hoga tab ke hisaab se
          await axios.delete(`${API_URL}/${endpoint}/${id}`, config);
          fetchData(); 
        } catch (e) { 
          Alert.alert("Error", "Could not Delete"); 
        }
      }
    }
  ]);
};

  const resetForm = () => {
    setTitle(''); setAmount(''); setFriendName(''); setDebtAmount('');
  };

  const settleDebt = async (id: any) => {
    Alert.alert("Settle?", "Is the balance cleared?", [
      { text: "No" },
      { text: "Yes", onPress: async () => {
          try {
            const config = await getAuthConfig();
            await axios.put(`${API_URL}/settle-debt/${id}`, {}, config);
            fetchData();
          } catch (e) { console.log(e); }
      }}
    ]);
  };

  // --- Chart & Stats (Memoized) ---
  const expenseChartData = useMemo(() => {
    const dataMap: any = {};
    transactions.forEach(item => {
      const cat = item.category || 'Others';
      dataMap[cat] = (dataMap[cat] || 0) + item.amount;
    });
    const sliceColors = ["#FF6B6B", "#48dbfb", "#1DD1A1", "#feca57", "#ff9ff3"];
    return Object.keys(dataMap).map((key, index) => ({
      name: key, 
      population: dataMap[key], 
      color: sliceColors[index % sliceColors.length], 
      legendFontColor: colors.subText, 
      legendFontSize: 12
    }));
  }, [transactions, colors.subText]);

  const debtChartData = useMemo(() => {
    const receive = debts.filter(d => d.type === 'To Receive').reduce((sum, item) => sum + item.amount, 0);
    const pay = debts.filter(d => d.type === 'To Pay').reduce((sum, item) => sum + item.amount, 0);
    return [
      { name: "Receive", population: receive, color: "#1DD1A1", legendFontColor: colors.subText, legendFontSize: 12 },
      { name: "Pay", population: pay, color: "#FECA57", legendFontColor: colors.subText, legendFontSize: 12 }
    ];
  }, [debts, colors.subText]);

  const stats = useMemo(() => ({
    totalExpenses: transactions.reduce((sum, item) => sum + item.amount, 0),
    totalToReceive: debts.filter(d => d.type === 'To Receive').reduce((sum, item) => sum + item.amount, 0),
    totalToPay: debts.filter(d => d.type === 'To Pay').reduce((sum, item) => sum + item.amount, 0),
  }), [transactions, debts]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brandName}>Spendly</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.themeBtn} onPress={startVoiceRecording}>
              <MaterialIcons name="mic" size={20} color={isRecognizing ? "#FF6B6B" : "#FFF"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.themeBtn} onPress={() => setIsDarkMode(!isDarkMode)}>
              <MaterialIcons name={isDarkMode ? "wb-sunny" : "brightness-3"} size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.themeBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabSection}>
        <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
          {(['Expenses', 'Debts'] as const).map((tab) => (
            <TouchableOpacity 
              key={tab}
              onPress={() => setActiveTab(tab)} 
              style={[styles.tabButton, activeTab === tab && { backgroundColor: isDarkMode ? '#333' : '#E1F0FF' }]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? (isDarkMode ? '#FFF' : '#0984E3') : colors.subText }]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Chart Card */}
        <View style={[styles.contentCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>{activeTab === 'Expenses' ? 'Expense Analytics' : 'Debt Overview'}</Text>
          {(activeTab === 'Expenses' ? transactions.length : debts.length) > 0 ? (
            <PieChart
              data={activeTab === 'Expenses' ? expenseChartData : debtChartData}
               //width={screenWidth - 80} height={180}
              width={screenWidth - 40} height={180}
              chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
              accessor={"population"} backgroundColor={"transparent"} paddingLeft={"15"} absolute
            />
          ) : (
            <View style={{ height: 180, justifyContent: 'center' }}>
               <Text style={{ color: colors.subText }}>No data found🏜️</Text>
            </View>
          )}

          <View style={[styles.statRow, { borderColor: colors.border }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.subText }]}>{activeTab === 'Expenses' ? 'Total Spent' : 'To Receive'}</Text>
              <Text style={[styles.statValue, {color: activeTab === 'Expenses' ? '#FF6B6B' : '#1DD1A1'}]}>
                ₹{activeTab === 'Expenses' ? stats.totalExpenses : stats.totalToReceive}
              </Text>
            </View>
            {activeTab === 'Debts' && (
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.subText }]}>To Pay</Text>
                <Text style={[styles.statValue, {color: '#FECA57'}]}>₹{stats.totalToPay}</Text>
              </View>
            )}
          </View>
        </View>

        {/* History List */}
        <View style={{ paddingHorizontal: 20 }}>
  <Text style={[styles.sectionHeading, { color: colors.text }]}>History</Text>
  {loading ? (
    <ActivityIndicator size="large" color="#0984E3" />
  ) : (
    (activeTab === 'Expenses' ? transactions : debts).map((item) => (
      <View key={item._id} style={[styles.listCard, { backgroundColor: colors.card }]}>
        
        {/* --- Dynamic Category Icons --- */}
        <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#333' : '#F4F7FA' }]}>
          <MaterialIcons 
            name={
              activeTab === 'Expenses' 
                ? (item.category === 'Food' ? 'fastfood' : 
                   item.category === 'Transport' ? 'directions-bus' : 
                   item.category === 'Shopping' ? 'shopping-bag' : 
                   item.category === 'Bills' ? 'receipt-long' : 'payments')
                : "person"
            } 
            size={22} 
            color="#0984E3" 
          />
        </View>

        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>
            {activeTab === 'Expenses' ? item.title : item.friendName}
          </Text>
          {activeTab === 'Expenses' ? (
            <Text style={{ fontSize: 12, color: colors.subText }}>{item.category || 'General'}</Text>
          ) : (
            <TouchableOpacity onPress={() => settleDebt(item._id)}>
              <Text style={{ color: '#0984E3', fontSize: 12, fontWeight: 'bold' }}>Settle Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* --- Amount & Delete Action --- */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.itemAmount, { color: activeTab === 'Expenses' ? '#FF6B6B' : (item.type === 'To Receive' ? '#1DD1A1' : '#FECA57') }]}>
            {activeTab === 'Expenses' ? `-₹${item.amount}` : `₹${item.amount}`}
          </Text>
          
          {/* Delete Icon (Sirf Expenses ke liye ya Debts ke liye bhi rakh sakte ho) */}
          <TouchableOpacity 
            onPress={() => handleDelete(item._id)} 
            style={{ marginTop: 5, padding: 4 }}
          >
            <MaterialIcons name="delete-outline" size={18} color={isDarkMode ? "#FF6B6B" : "#D63031"} />
          </TouchableOpacity>
        </View>

      </View>
    ))
  )}
</View>
      </ScrollView>

      {/* FAB & Modal */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <MaterialIcons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
      <Text style={[styles.modalHeader, { color: colors.text }]}>New Entry</Text>
      
      <TextInput 
        placeholder="Details" 
        placeholderTextColor={colors.subText} 
        style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
        value={activeTab === 'Expenses' ? title : friendName} 
        onChangeText={activeTab === 'Expenses' ? setTitle : setFriendName} 
      />
      
      <TextInput 
        placeholder="Amount" 
        keyboardType="numeric" 
        placeholderTextColor={colors.subText} 
        style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
        value={activeTab === 'Expenses' ? amount : debtAmount} 
        onChangeText={activeTab === 'Expenses' ? setAmount : setDebtAmount} 
      />

      {/* --- Agar Expense Tab hai toh Category dikhao --- */}
      {activeTab === 'Expenses' && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10, color: colors.text }}>Category?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => (
              <TouchableOpacity 
                key={cat} 
                onPress={() => setCategory(cat)} 
                style={[
                  styles.catBtn, 
                  { backgroundColor: category === cat ? '#0984E3' : (isDarkMode ? '#333' : '#F4F7FA') }
                ]}
              >
                <Text style={{ color: category === cat ? '#FFF' : colors.subText, fontWeight: 'bold' }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* --- 👇 YE HAI NAYA CODE: Agar Debts Tab hai toh To Take/Pay dikhao 👇 --- */}
      {activeTab === 'Debts' && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10, color: colors.text }}>What's the balance?</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              onPress={() => setDebtType('To Receive')} 
              style={[
                styles.debtTypeBtn, 
                { 
                  backgroundColor: debtType === 'To Receive' ? '#1DD1A1' : (isDarkMode ? '#333' : '#F4F7FA'),
                  flex: 1,
                  flexDirection: 'row',
                  padding: 12,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
            >
              <MaterialIcons name="call-received" size={20} color={debtType === 'To Receive' ? '#FFF' : '#1DD1A1'} />
              <Text style={{ color: debtType === 'To Receive' ? '#FFF' : colors.subText, fontWeight: 'bold', marginLeft: 5 }}>To Take</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setDebtType('To Pay')} 
              style={[
                styles.debtTypeBtn, 
                { 
                  backgroundColor: debtType === 'To Pay' ? '#FECA57' : (isDarkMode ? '#333' : '#F4F7FA'),
                  flex: 1,
                  flexDirection: 'row',
                  padding: 12,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
            >
              <MaterialIcons name="call-made" size={20} color={debtType === 'To Pay' ? '#FFF' : '#FECA57'} />
              <Text style={{ color: debtType === 'To Pay' ? '#FFF' : colors.subText, fontWeight: 'bold', marginLeft: 5 }}>To Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleAddEntry}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 15, alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 60, paddingHorizontal: 25, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  brandName: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  themeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 15 },
  tabSection: { paddingHorizontal: 20, marginTop: -35 },
  tabContainer: { flexDirection: 'row', borderRadius: 20, padding: 6, elevation: 12 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 16 },
  tabText: { fontWeight: '800' },
  contentCard: { marginHorizontal: 10, marginVertical: 20, paddingHorizontal: 10, paddingVertical: 20, borderRadius: 30, elevation: 5, alignItems: 'center' },
  sectionHeading: { fontSize: 18, fontWeight: '800', marginBottom: 15, alignSelf: 'flex-start' },
  statRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginTop: 15, borderTopWidth: 1, paddingTop: 15 },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 20, fontWeight: '900' },
  listCard: { padding: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2 },
  iconCircle: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemAmount: { fontSize: 16, fontWeight: '800' },
  itemCat: { fontSize: 12, color: '#0984E3' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#0984E3', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { margin: 25, padding: 25, borderRadius: 30 },
  modalHeader: { fontSize: 22, fontWeight: '900', marginBottom: 20 },
  input: { borderBottomWidth: 1.5, marginBottom: 20, padding: 10, fontSize: 16 },
  saveBtn: { backgroundColor: '#0984E3', padding: 15, borderRadius: 15, alignItems: 'center' },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  catBtn: { 
  paddingHorizontal: 15, 
  paddingVertical: 10, 
  borderRadius: 20, 
  marginRight: 10, 
  borderWidth: 1, 
  borderColor: 'rgba(0,0,0,0.05)' 
},
debtTypeBtn: {
  flexDirection: 'row',
  padding: 12,
  borderRadius: 15,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: 'transparent'
}
});