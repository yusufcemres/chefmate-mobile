import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuthStore } from '../../src/stores/auth';
import { colors } from '../../src/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Tarifler: '🍳',
    Stok: '🧊',
    Tara: '📷',
    Liste: '🛒',
    Profil: '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {icons[label] || '📋'}
    </Text>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tarifler',
          tabBarIcon: ({ focused }) => <TabIcon label="Tarifler" focused={focused} />,
          headerTitle: 'ChefMate',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Stok',
          tabBarIcon: ({ focused }) => <TabIcon label="Stok" focused={focused} />,
          headerTitle: 'Mutfak Stoğum',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Tara',
          tabBarIcon: ({ focused }) => <TabIcon label="Tara" focused={focused} />,
          headerTitle: 'AI Tarama',
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: 'Liste',
          tabBarIcon: ({ focused }) => <TabIcon label="Liste" focused={focused} />,
          headerTitle: 'Alışveriş Listesi',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon label="Profil" focused={focused} />,
          headerTitle: 'Profilim',
        }}
      />
    </Tabs>
  );
}
