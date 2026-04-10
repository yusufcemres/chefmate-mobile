import { useEffect, useCallback, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from '@expo-google-fonts/manrope';
import { useAuthStore } from '../src/stores/auth';
import { colors } from '../src/theme';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useOfflineCacheStore } from '../src/stores/offline-cache';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const [timedOut, setTimedOut] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Jakarta-Medium': PlusJakartaSans_500Medium,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
  });

  useEffect(() => {
    init();
    useOfflineCacheStore.getState().loadCache();
    // Timeout: if fonts don't load within 3s, proceed anyway
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || fontError !== null || timedOut;

  const onLayoutReady = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ThemedApp fontsLoaded={fontsLoaded} onLayoutReady={onLayoutReady} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ThemedApp({ fontsLoaded, onLayoutReady }: { fontsLoaded: boolean; onLayoutReady: () => void }) {
  const { isDark, colors: c } = useTheme();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'expiry_alert' || data?.type === 'expiry_warning') {
        router.push('/notifications');
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} onLayout={onLayoutReady}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: fontsLoaded ? 'Jakarta-Bold' : undefined },
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/[id]"
          options={{ title: 'Tarif Detayı', headerShown: false }}
        />
        <Stack.Screen
          name="collection/[slug]"
          options={{ title: 'Koleksiyon', headerShown: false }}
        />
        <Stack.Screen
          name="cooking/[id]"
          options={{ title: 'Pişirme Modu', headerBackTitle: 'Geri', presentation: 'fullScreenModal' }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
