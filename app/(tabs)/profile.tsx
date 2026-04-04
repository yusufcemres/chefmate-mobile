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
      {/* User Info */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.displayName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* Serving Size */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Porsiyon Sayısı</Text>
        <View style={styles.servingRow}>
          <TouchableOpacity
            style={styles.servingBtn}
            onPress={() => setServingSize(String(Math.max(1, parseInt(servingSize) - 1)))}
          >
            <Text style={styles.servingBtnText}>-</Text>
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
            <Text style={styles.servingBtnText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.servingLabel}>kişilik</Text>
        </View>
      </View>

      {/* Diet */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beslenme Tercihleri</Text>
        {dietOptions.map((d) => (
          <View key={d.key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{d.label}</Text>
            <Switch
              value={!!selectedDiets[d.key]}
              onValueChange={(v) => setSelectedDiets((prev) => ({ ...prev, [d.key]: v }))}
              trackColor={{ true: colors.primaryLight, false: colors.border }}
              thumbColor={selectedDiets[d.key] ? colors.primary : '#f4f3f4'}
            />
          </View>
        ))}
      </View>

      {/* Allergens */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alerjenler</Text>
        <View style={styles.chipRow}>
          {allergenOptions.map((a) => {
            const active = selectedAllergens.includes(a);
            return (
              <TouchableOpacity
                key={a}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleAllergen(a)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}</Text>
      </TouchableOpacity>

      {/* Households */}
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/households')}>
        <Text style={styles.navBtnText}>🏠  Hanelerim</Text>
      </TouchableOpacity>

      {/* Meal Plans */}
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/meal-plans')}>
        <Text style={styles.navBtnText}>📅  Yemek Planlarım</Text>
      </TouchableOpacity>

      {/* Notifications */}
      <TouchableOpacity style={styles.navBtn} onPress={() => router.push('/notifications')}>
        <Text style={styles.navBtnText}>🔔  Bildirimler</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.textInverse, fontSize: fontSize.xl, fontWeight: '800' },
  userName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: fontSize.sm, color: colors.textSecondary },
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  servingBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  servingBtnText: { fontSize: fontSize.xl, color: colors.text },
  servingInput: { width: 50, height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, fontSize: fontSize.lg, color: colors.text },
  servingLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  switchLabel: { fontSize: fontSize.md, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipActive: { borderColor: colors.error, backgroundColor: '#FEE2E2' },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.error, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
  navBtn: { backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  navBtnText: { color: colors.text, fontWeight: '700', fontSize: fontSize.md },
  logoutBtn: { borderWidth: 1, borderColor: colors.error, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  logoutText: { color: colors.error, fontWeight: '600', fontSize: fontSize.md },
  disabled: { opacity: 0.5 },
});
