import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  
  const segments = useSegments();
  const router = useRouter();

  // Function to check token
  const checkLogin = async () => {
    const token = await AsyncStorage.getItem('token');
    setHasToken(!!token);
    setIsReady(true);
  };

  useEffect(() => {
    checkLogin();
  }, [segments]); // 👈 Har segment change par check karega

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!hasToken && !inAuthGroup) {
      // Agar token nahi hai aur auth screens par nahi ho
      router.replace('/login');
    } else if (hasToken && inAuthGroup) {
      // Agar token hai aur galti se login/signup par ho
      router.replace('/');
    }
  }, [hasToken, isReady, segments]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0984E3" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}