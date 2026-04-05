import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { colors, borderRadius } from '../../src/theme';

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

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  if (isLoading || onboardingDone === null) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: 'transparent',
          height: Platform.OS === 'web' ? 64 : 70,
          paddingBottom: Platform.OS === 'web' ? 8 : 12,
          paddingTop: 6,
          borderTopLeftRadius: borderRadius.xxl,
          borderTopRightRadius: borderRadius.xxl,
          position: 'absolute',
          elevation: 8,
          shadowColor: '#302F2A',
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
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerShown: false,
        headerTitleStyle: {
          fontWeight: '800',
          color: colors.primary,
          fontSize: 20,
          letterSpacing: -0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tarifler',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: colors.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="restaurant-menu" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
          headerTitle: 'The Culinary Editorial',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Stok',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: colors.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="kitchen" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
          headerTitle: 'Mutfak Stoğum',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Tara',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: colors.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="photo-camera" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
          headerTitle: 'AI Tarama',
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Liste',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: colors.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="shopping-cart" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
          headerTitle: 'Alışveriş Listesi',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: colors.primaryContainer,
              borderRadius: borderRadius.full,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <MaterialIcons name="person" size={24} color={focused ? colors.primary : color} />
            </View>
          ),
          headerTitle: 'Profilim',
        }}
      />
    </Tabs>
  );
}
