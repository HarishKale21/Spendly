import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, StatusBar, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const API_URL = "http://192.168.1.18:5000"; 

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // 👈 Loading state add ki hai
  const router = useRouter();

  const handleLogin = async () => {
    // 1. Basic Validation
    if (!email || !password) {
      return Alert.alert("Oye!", "Email aur Password dono bharna zaroori hai.");
    }

    setLoading(true); // Button dabate hi spinner start
    try {
      const res = await axios.post(`${API_URL}/login`, { 
        email: email.trim().toLowerCase(), // Spaces hata diye aur lowercase kar diya
        password 
      });

      if (res.data.success) {
        // 2. Token Save
        await AsyncStorage.setItem('token', res.data.authToken);
        
        // 3. User ko confirm karo ki login ho gaya
        console.log("Login Success! Token Saved.");
        
        // 4. Redirect
        router.replace('/'); 
      }
    } catch (error: any) {
      console.log("Detailed Login Error:", error.response?.data);
      Alert.alert(
        "Login Fail ❌", 
        error.response?.data?.error || "Server connect nahi ho raha bhai!"
      );
    } finally {
      setLoading(false); // Error aaye ya success, loading band
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>PocketWatcher</Text>
        <Text style={styles.subtitle}>Welcome Back, Bhai! 👋</Text>
      </View>

      <View style={styles.form}>
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
            placeholder="Password" 
            style={styles.input} 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
            placeholderTextColor="#B0B0B0"
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.actionBtn, loading && { opacity: 0.7 }]} 
          onPress={handleLogin}
          disabled={loading} // Loading ke waqt baar-baar click nahi hoga
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Login Now</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup')}>
          <Text style={styles.footerLink}>Naya account chahiye? Signup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles remains the same...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', justifyContent: 'center', padding: 25 },
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