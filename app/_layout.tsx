import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import odooApi from '../src/services/odooApi';

import { useColorScheme } from '@/hooks/useColorScheme';

const OdooTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#875A7B',
    background: '#F9F9F9',
    card: '#FFFFFF',
    text: '#333333',
    border: '#E5E5E5',
    notification: '#875A7B',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isConfigured, setIsConfigured] = useState(false);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    const hasConfig = await odooApi.loadConfig();
    setIsConfigured(hasConfig);
  };

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={OdooTheme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#875A7B',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
      <StatusBar style="light" backgroundColor="#875A7B" />
    </ThemeProvider>
  );
}
