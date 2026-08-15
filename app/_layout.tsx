import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Keep native splash from being hidden before the root navigator is ready.
// A bounded fallback prevents a permanent splash if font loading hangs/fails.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let cancelled = false;
    const hideSplash = () => {
      if (!cancelled) SplashScreen.hideAsync().catch(() => {});
    };

    if (fontsLoaded || fontError) {
      hideSplash();
      return () => { cancelled = true; };
    }

    // Never allow an asset-loading problem to leave the APK permanently on splash.
    const fallback = setTimeout(hideSplash, 3000);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [fontsLoaded, fontError]);

  // Start the navigation tree even if font loading is delayed. The Inter font
  // family has safe system fallbacks, so startup must not depend on the font.
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
