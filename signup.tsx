import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, StatusBar, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const API_URL = "http://192.168.1.18:5000"; 

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // 👈 Loading state add ki
  const router = useRouter();

  const handleSignup = async () => {
    // Basic validation with trim
    if (!name.trim() || !email.trim() || !password) {
      return Alert.alert("Wait!", "Bhai saari details toh bharo!");
    }

    // Email format validation (Optional but good)
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return Alert.alert("Invalid Email", "Bhai sahi email id daalo.");
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/register`, { 
        name: name.trim(), 
        email: email.trim().toLowerCase(), 
        password 
      });

      if (res.data.success) {
        await AsyncStorage.setItem('token', res.data.authToken);
        Alert.alert("Mubarak Ho! 🎉", "Aapka account ban gaya.");
        router.replace('/'); 
      }
    } catch (error: any) {
      console.log("Signup Error:", error.response?.data);
      Alert.alert("Signup Failed", error.response?.data?.error || "Kuch locha ho gaya!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>PocketWatcher</Text>
        <Text style={styles.subtitle}>Chalo, Hisaab Shuru Karte Hain! 📝</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputRow}>
          <MaterialIcons name="person" size={20} color="#0984E3" />
          <TextInput 
            placeholder="Full Name" 
            style={styles.input} 
            value={name} 
            onChangeText={setName} 
            placeholderTextColor="#B0B0B0"
          />
        </View>

        <View style={styles.inputRow}>
          <MaterialIcons name="email" size={20} color="#0984E3" />
          <TextInput 
            placeholder="Email Address" 
            style={styles.input} 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none" 
            placeholderTextColor="#B0B0B0"
          />
        </View>

        <View style={styles.inputRow}>
          <MaterialIcons name="lock" size={20} color="#0984E3" />
          <TextInput 
            placeholder="Create Password" 
            style={styles.input} 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            placeholderTextColor="#B0B0B0"
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.actionBtn, loading && { opacity: 0.7 }]} 
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={styles.footerLink}>Pehle se account hai? Login karo</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F4F7FA', justifyContent: 'center', padding: 25 },
  header: { marginBottom: 30, alignItems: 'center' },
  title: { fontSize: 36, fontWeight: '900', color: '#0984E3' },
  subtitle: { fontSize: 16, color: '#636E72', marginTop: 5 },
  form: { backgroundColor: '#FFF', padding: 25, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderColor: '#F0F0F0', marginBottom: 20 },
  input: { flex: 1, padding: 12, fontSize: 16, color: '#2D3436' },
  actionBtn: { backgroundColor: '#0984E3', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  footerLink: { textAlign: 'center', marginTop: 25, color: '#0984E3', fontWeight: '700' }
});