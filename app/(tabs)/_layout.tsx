import { useEffect, useState, useCallback } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { colors, borderRadius } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: 'restaurant-menu',
  inventory: 'kitchen',
  scan: 'photo-camera',
  shopping: 'shopping-cart',
  profile: 'person',
};

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const checkOnboarding = useCallback(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  useEffect(() => {
    checkOnboarding();
  }, [checkOnboarding]);

  const { colors: c } = useTheme();

  if (isLoading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surfaceContainerLowest,
          borderTopColor: 'transparent',
          height: Platform.OS === 'web' ? 64 : 70,
          paddingBottom: Platform.OS === 'web' ? 8 : 12,
          paddingTop: 6,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          position: 'absolute',
          elevation: 8,
          shadowColor: c.text,
          shadowOpacity: 0.06,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -12 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        headerStyle: {
          backgroundColor: c.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerShown: false,
        headerTitleStyle: {
          fontWeight: '800',
          color: c.primary,
          fontSize: 20,
          letterSpacing: -0.5,
        },
      }}
    >
      {/* ===== 3 Visible Tabs ===== */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: c.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="explore" size={24} color={focused ? c.primary : color} />
            </View>
          ),
          headerTitle: 'ChefMate',
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: 'Mutfağım',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: c.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="kitchen" size={24} color={focused ? c.primary : color} />
            </View>
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Ben',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: c.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="person" size={24} color={focused ? c.primary : color} />
            </View>
          ),
          headerTitle: 'Profilim',
        }}
      />
      {/* ===== Hidden tabs (still accessible via router.push) ===== */}
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
      <Tabs.Screen name="shopping" options={{ href: null }} />
    </Tabs>
  );
}
