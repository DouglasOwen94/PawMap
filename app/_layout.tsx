import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/urbanist';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'expo-dev-client';
import 'react-native-reanimated';

import { SavedToast } from '@/components/SavedToast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AdminAuthProvider } from '@/hooks/useAdminAuth';
import { SavedVenuesProvider } from '@/hooks/useSavedVenues';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Urbanist_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AdminAuthProvider>
      <SavedVenuesProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen
              name="admin-approve"
              options={{ title: 'Review submission', headerBackTitle: 'Back' }}
            />
          </Stack>
          <StatusBar style="auto" />
          <SavedToast />
        </ThemeProvider>
      </SavedVenuesProvider>
      </AdminAuthProvider>
    </GestureHandlerRootView>
  );
}
