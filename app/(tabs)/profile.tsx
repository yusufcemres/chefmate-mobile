import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';

const allergenOptions = [
  'Gluten', 'Süt', 'Yumurta', 'Balık', 'Kabuklu Deniz Ürünü',
  'Fıstık', 'Soya', 'Kereviz', 'Hardal', 'Susam',
];

const dietOptions = [
  { key: 'vegetarian', label: 'Vejetaryen' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten_free', label: 'Glutensiz' },
  { key: 'dairy_free', label: 'Süt Ürünsüz' },
  { key: 'low_carb', label: 'Düşük Karbonhidrat' },
];

export default function ProfileScreen() {
  const { user, preferences, logout, updatePreferences } = useAuthStore();
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(preferences?.allergens || []);
  const [selectedDiets, setSelectedDiets] = useState<Record<string, boolean>>(
    preferences?.dietaryProfile || {},
  );
  const [servingSize, setServingSize] = useState(String(preferences?.servingSize || 1));
  const [saving, setSaving] = useState(false);

  const toggleAllergen = (a: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences({
        allergens: selectedAllergens,
        dietaryProfile: selectedDiets,
        servingSize: parseInt(servingSize) || 1,
      });
      if (Platform.OS === 'web') window.alert('Tercihleriniz güncellendi.');
      else Alert.alert('Kaydedildi', 'Tercihleriniz güncellendi.');
    } catch (err: any) {
      if (Platform.OS === 'web') window.alert(err.message || 'Hata');
      else Alert.alert('Hata', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Çıkış yapmak istediğinize emin misiniz?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
            { text: 'İptal', onPress: () => resolve(false) },
            { text: 'Çıkış Yap', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (confirmed) {
      await logout();
      router.replace('/(auth)/login');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <MaterialIcons name="verified" size={16} color={colors.onPrimary} />
          </View>
        </View>
        <Text style={styles.userName}>{user?.displayName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Quick Nav Cards */}
      <View style={styles.navGrid}>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/households')}>
          <MaterialIcons name="home" size={28} color={colors.primary} />
          <Text style={styles.navCardLabel}>Hanelerim</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/meal-plans')}>
          <MaterialIcons name="calendar-today" size={28} color={colors.primary} />
          <Text style={styles.navCardLabel}>Yemek Planları</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications" size={28} color={colors.secondary} />
          <Text style={styles.navCardLabel}>Bildirimler</Text>
        </TouchableOpacity>
      </View>

      {/* Serving Size */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="people" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Porsiyon Sayısı</Text>
        </View>
        <View style={styles.servingRow}>
          <TouchableOpacity
            style={styles.servingBtn}
            onPress={() => setServingSize(String(Math.max(1, parseInt(servingSize) - 1)))}
          >
            <MaterialIcons name="remove" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.servingInput}
            keyboardType="numeric"
            value={servingSize}
            onChangeText={setServingSize}
            textAlign="center"
          />
          <TouchableOpacity
            style={styles.servingBtn}
            onPress={() => setServingSize(String(parseInt(servingSize) + 1))}
          >
            <MaterialIcons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.servingLabel}>kişilik</Text>
        </View>
      </View>

      {/* Diet */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="restaurant" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Beslenme Tercihleri</Text>
        </View>
        {dietOptions.map((d) => (
          <View key={d.key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{d.label}</Text>
            <Switch
              value={!!selectedDiets[d.key]}
              onValueChange={(v) => setSelectedDiets((prev) => ({ ...prev, [d.key]: v }))}
              trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHigh }}
              thumbColor={selectedDiets[d.key] ? colors.primary : colors.surfaceContainerHighest}
            />
          </View>
        ))}
      </View>

      {/* Allergens */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="warning" size={18} color={colors.error} />
          <Text style={styles.sectionTitle}>Alerjenler</Text>
        </View>
        <View style={styles.chipRow}>
          {allergenOptions.map((a) => {
            const active = selectedAllergens.includes(a);
            return (
              <TouchableOpacity
                key={a}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleAllergen(a)}
              >
                {active && <MaterialIcons name="check" size={14} color={colors.error} />}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        <MaterialIcons name="save" size={20} color={colors.onPrimary} />
        <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialIcons name="logout" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  avatarContainer: { position: 'relative', marginBottom: spacing.sm },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '3deg' }],
    shadowColor: '#302F2A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarText: { color: colors.onPrimaryContainer, fontSize: fontSize.title, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  userName: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  userEmail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

  // Nav Grid
  navGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  navCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  navCardLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.text, textAlign: 'center' },

  // Section
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },

  // Serving
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  servingBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingInput: {
    width: 56,
    height: 40,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  servingLabel: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  switchLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  chipActive: {
    borderColor: colors.error,
    backgroundColor: colors.errorContainer + '20',
  },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: colors.error, fontWeight: '700' },

  // Save
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },

  // Logout
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: { color: colors.error, fontWeight: '700', fontSize: fontSize.md },

  disabled: { opacity: 0.5 },
});
