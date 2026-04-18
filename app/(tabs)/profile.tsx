import { useState, useEffect, useMemo } from 'react';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
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
import { useFavoritesStore } from '../../src/stores/favorites';
import { api } from '../../src/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';
import BadgeDisplay from '../../src/components/BadgeDisplay';

type ThemeMode = 'light' | 'dark' | 'system';

const isWeb = Platform.OS === 'web';

const allergenOptions = [
  'Gluten', 'Süt', 'Yumurta', 'Balık', 'Kabuklu Deniz Ürünü',
  'Fıstık', 'Soya', 'Kereviz', 'Hardal', 'Susam',
];

const cuisineOptions = [
  { slug: 'turk-mutfagi', label: 'Türk Mutfağı', emoji: '🇹🇷' },
  { slug: 'italyan', label: 'İtalyan', emoji: '🇮🇹' },
  { slug: 'asya', label: 'Asya', emoji: '🥢' },
  { slug: 'meksika', label: 'Meksika', emoji: '🌮' },
  { slug: 'akdeniz', label: 'Akdeniz', emoji: '🫒' },
  { slug: 'hint', label: 'Hint', emoji: '🍛' },
  { slug: 'japon', label: 'Japon', emoji: '🍣' },
  { slug: 'fransiz', label: 'Fransız', emoji: '🥐' },
  { slug: 'ortadogu', label: 'Ortadoğu', emoji: '🧆' },
  { slug: 'amerikan', label: 'Amerikan', emoji: '🍔' },
  { slug: 'cin', label: 'Çin', emoji: '🥟' },
  { slug: 'kore', label: 'Kore', emoji: '🍜' },
];

const skillLevels = [
  { key: 'BEGINNER', label: 'Başlangıç', emoji: '🌱' },
  { key: 'INTERMEDIATE', label: 'Orta', emoji: '👨‍🍳' },
  { key: 'ADVANCED', label: 'İleri', emoji: '⭐' },
];

const dietOptions = [
  { key: 'vegetarian', label: 'Vejetaryen' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten_free', label: 'Glutensiz' },
  { key: 'dairy_free', label: 'Süt Ürünsüz' },
  { key: 'low_carb', label: 'Düşük Karbonhidrat' },
];

interface ProfileStats {
  totalFavorites: number;
  inventoryCount: number;
  mealPlanCount: number;
}

interface WasteStats {
  wasteScore: number;
  totalConsumed: number;
  totalWaste: number;
  consumptionRate: number;
  expiringItemsCount: number;
  weeklyBreakdown: Array<{ week: string; consumed: number; wasted: number }>;
}

function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, preferences, logout, updatePreferences } = useAuthStore();
  const { ids: favoriteIds, loaded: favsLoaded, fetch: fetchFavs } = useFavoritesStore();
  const { mode: themeMode, setMode: setThemeMode, isDark, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(preferences?.allergens || []);
  const [selectedDiets, setSelectedDiets] = useState<Record<string, boolean>>(
    preferences?.dietaryProfile || {},
  );
  const [servingSize, setServingSize] = useState(String(preferences?.servingSize || 1));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'prefs' | 'stats'>('stats');
  const [stats, setStats] = useState<ProfileStats>({ totalFavorites: 0, inventoryCount: 0, mealPlanCount: 0 });
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(preferences?.cuisinePreferences || []);
  const [selectedSkill, setSelectedSkill] = useState<string>(preferences?.cookingSkillLevel || 'INTERMEDIATE');
  const [tasteProfile, setTasteProfile] = useState<any>(null);
  const [wasteStats, setWasteStats] = useState<WasteStats | null>(null);

  useEffect(() => {
    if (!favsLoaded) fetchFavs();
    // Fetch basic stats
    Promise.all([
      api.get<any>('/inventory').catch(() => ({ items: [] })),
      api.get<any>('/meal-plans').catch(() => []),
    ]).then(([inv, plans]) => {
      const invItems = Array.isArray(inv) ? inv.length : (inv?.items?.length || 0);
      const planCount = Array.isArray(plans) ? plans.length : 0;
      setStats({ totalFavorites: favoriteIds.length, inventoryCount: invItems, mealPlanCount: planCount });
    });

    if (user) {
      // Fetch taste profile
      api.get<any>(`/users/${user.id}/taste-profile`).then((res) => {
        setTasteProfile(res);
      }).catch(() => {});

      // Fetch waste stats
      api.get<any>(`/users/${user.id}/inventory/waste-stats?days=30`).then((res) => {
        setWasteStats(res as any);
      }).catch(() => {});
    }
  }, [favsLoaded]);

  useEffect(() => {
    setStats(s => ({ ...s, totalFavorites: favoriteIds.length }));
  }, [favoriteIds.length]);

  const toggleAllergen = (a: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  };

  const toggleCuisine = (slug: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
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
      // Also save cuisine preferences + rebuild taste profile
      if (user) {
        await api.post(`/users/${user.id}/taste-profile/preferences`, {
          cuisines: selectedCuisines,
          skillLevel: selectedSkill,
        });
      }
      if (isWeb) window.alert('Tercihleriniz güncellendi.');
      else Alert.alert('Kaydedildi', 'Tercihleriniz güncellendi.');
    } catch (err: any) {
      if (isWeb) window.alert(err.message || 'Hata');
      else Alert.alert('Hata', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = isWeb
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.md + 70 + insets.bottom + 24 }]}
    >
      {/* ===== Profile Header ===== */}
      <View style={styles.profileHeader} accessibilityLabel={`Profil: ${user?.displayName || 'ChefMate Kullanıcı'}`}>
        <View style={styles.avatarContainer} accessibilityLabel={`${user?.displayName || 'Kullanıcı'} profil fotoğrafı`}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.displayName?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.verifiedBadge} accessibilityLabel="Doğrulanmış hesap">
            <MaterialIcons name="verified" size={16} color={colors.onPrimary} />
          </View>
        </View>
        <Text style={styles.userName}>{user?.displayName || 'ChefMate Kullanıcı'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* ===== Bento Stats Grid ===== */}
      <View style={styles.bentoGrid}>
        {/* Large card - Favorites */}
        <View
          style={[styles.bentoCard, styles.bentoLarge]}
          accessibilityLabel={`${stats.totalFavorites} favori tarif`}
          accessibilityRole="summary"
        >
          <View style={styles.bentoIconWrap}>
            <MaterialIcons name="favorite" size={28} color="#FF4B6E" />
          </View>
          <Text style={styles.bentoValue}>{stats.totalFavorites}</Text>
          <Text style={styles.bentoLabel}>Favori Tarif</Text>
        </View>
        {/* Right column - 2 small cards */}
        <View style={styles.bentoColumn}>
          <View
            style={[styles.bentoCard, styles.bentoSmall]}
            accessibilityLabel={`${stats.inventoryCount} stok ürün`}
            accessibilityRole="summary"
          >
            <MaterialIcons name="kitchen" size={22} color={colors.tertiary} />
            <Text style={styles.bentoSmallValue}>{stats.inventoryCount}</Text>
            <Text style={styles.bentoSmallLabel}>Stok Ürün</Text>
          </View>
          <View
            style={[styles.bentoCard, styles.bentoSmall]}
            accessibilityLabel={`${stats.mealPlanCount} yemek planı`}
            accessibilityRole="summary"
          >
            <MaterialIcons name="event-note" size={22} color={colors.secondary} />
            <Text style={styles.bentoSmallValue}>{stats.mealPlanCount}</Text>
            <Text style={styles.bentoSmallLabel}>Yemek Planı</Text>
          </View>
        </View>
      </View>

      {/* ===== Waste Score Dashboard ===== */}
      {wasteStats && (
        <View style={styles.wasteSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="eco" size={18} color={colors.success} />
            <Text style={styles.sectionTitle}>İsraf Skoru</Text>
          </View>
          <View style={styles.wasteScoreRow}>
            <View style={[
              styles.wasteScoreCircle,
              { borderColor: wasteStats.wasteScore >= 80 ? colors.success : wasteStats.wasteScore >= 50 ? colors.warning : colors.error },
            ]}>
              <Text style={[
                styles.wasteScoreValue,
                { color: wasteStats.wasteScore >= 80 ? colors.success : wasteStats.wasteScore >= 50 ? colors.warning : colors.error },
              ]}>{wasteStats.wasteScore}</Text>
              <Text style={styles.wasteScoreLabel}>/ 100</Text>
            </View>
            <View style={styles.wasteMetrics}>
              <View style={styles.wasteMetricRow}>
                <Text style={styles.wasteMetricIcon}>✅</Text>
                <Text style={styles.wasteMetricText}>Tüketilen: {wasteStats.totalConsumed}g</Text>
              </View>
              <View style={styles.wasteMetricRow}>
                <Text style={styles.wasteMetricIcon}>🗑️</Text>
                <Text style={styles.wasteMetricText}>İsraf: {wasteStats.totalWaste}g</Text>
              </View>
              <View style={styles.wasteMetricRow}>
                <Text style={styles.wasteMetricIcon}>⏰</Text>
                <Text style={styles.wasteMetricText}>{wasteStats.expiringItemsCount} ürün sona eriyor</Text>
              </View>
              <View style={styles.wasteMetricRow}>
                <Text style={styles.wasteMetricIcon}>📊</Text>
                <Text style={styles.wasteMetricText}>Kullanım oranı: %{wasteStats.consumptionRate}</Text>
              </View>
            </View>
          </View>
          {/* Simple weekly bar chart */}
          {wasteStats.weeklyBreakdown.length > 0 && (
            <View style={styles.weeklyChart}>
              {wasteStats.weeklyBreakdown.slice(-4).map((w) => {
                const total = w.consumed + w.wasted;
                const consumedPct = total > 0 ? (w.consumed / total) * 100 : 100;
                return (
                  <View key={w.week} style={styles.weeklyBar}>
                    <View style={styles.weeklyBarStack}>
                      <View style={[styles.weeklyBarFill, { height: `${consumedPct}%`, backgroundColor: colors.success }]} />
                      <View style={[styles.weeklyBarFill, { height: `${100 - consumedPct}%`, backgroundColor: colors.error + '60' }]} />
                    </View>
                    <Text style={styles.weeklyBarLabel}>{w.week.slice(5)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ===== Badges ===== */}
      <BadgeDisplay />

      {/* ===== Quick Nav Cards ===== */}
      <View style={styles.navGrid}>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/households')}>
          <MaterialIcons name="home" size={24} color={colors.primary} />
          <Text style={styles.navCardLabel}>Hanelerim</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/meal-plans')}>
          <MaterialIcons name="calendar-today" size={24} color={colors.primary} />
          <Text style={styles.navCardLabel}>Planlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navCard} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications" size={24} color={colors.secondary} />
          <Text style={styles.navCardLabel}>Bildirimler</Text>
        </TouchableOpacity>
      </View>

      {/* ===== Tab Selector ===== */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>Tercihler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'prefs' && styles.tabActive]}
          onPress={() => setActiveTab('prefs')}
        >
          <Text style={[styles.tabText, activeTab === 'prefs' && styles.tabTextActive]}>Beslenme & Alerjen</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stats' && (
        <>
          {/* Theme Mode */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="dark-mode" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Görünüm</Text>
            </View>
            <View style={styles.themeModes}>
              {([
                { key: 'light' as ThemeMode, label: 'Açık', icon: 'light-mode' as const },
                { key: 'dark' as ThemeMode, label: 'Koyu', icon: 'dark-mode' as const },
                { key: 'system' as ThemeMode, label: 'Sistem', icon: 'settings-brightness' as const },
              ]).map((t) => {
                const isCurrent = t.key === themeMode;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.themeBtn, isCurrent && styles.themeBtnActive]}
                    onPress={() => setThemeMode(t.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label} tema`}
                    accessibilityState={{ selected: isCurrent }}
                  >
                    <MaterialIcons
                      name={t.icon}
                      size={20}
                      color={isCurrent ? colors.onPrimary : colors.textMuted}
                    />
                    <Text style={[styles.themeBtnText, isCurrent && styles.themeBtnTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                accessibilityRole="button"
                accessibilityLabel="Porsiyon azalt"
              >
                <MaterialIcons name="remove" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={styles.servingInput}
                keyboardType="numeric"
                value={servingSize}
                onChangeText={setServingSize}
                textAlign="center"
                accessibilityLabel={`Porsiyon sayısı: ${servingSize}`}
              />
              <TouchableOpacity
                style={styles.servingBtn}
                onPress={() => setServingSize(String(parseInt(servingSize) + 1))}
                accessibilityRole="button"
                accessibilityLabel="Porsiyon artır"
              >
                <MaterialIcons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.servingLabel}>kişilik</Text>
            </View>
          </View>

          {/* Cooking Skill Level */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="school" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Pişirme Seviyesi</Text>
            </View>
            <View style={styles.skillRow}>
              {skillLevels.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.skillBtn, selectedSkill === s.key && styles.skillBtnActive]}
                  onPress={() => setSelectedSkill(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.label} pişirme seviyesi`}
                  accessibilityState={{ selected: selectedSkill === s.key }}
                >
                  <Text style={styles.skillEmoji}>{s.emoji}</Text>
                  <Text style={[styles.skillLabel, selectedSkill === s.key && styles.skillLabelActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cuisine Preferences */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="restaurant" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Mutfak Tercihleri</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Sevdiğin mutfakları seç, öneriler kişiselleşsin</Text>
            <View style={styles.cuisineGrid}>
              {cuisineOptions.map((c) => (
                <TouchableOpacity
                  key={c.slug}
                  style={[styles.cuisineChip, selectedCuisines.includes(c.slug) && styles.cuisineChipActive]}
                  onPress={() => toggleCuisine(c.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ selected: selectedCuisines.includes(c.slug) }}
                  accessibilityLabel={c.label}
                >
                  <Text style={styles.cuisineEmoji}>{c.emoji}</Text>
                  <Text style={[styles.cuisineLabel, selectedCuisines.includes(c.slug) && styles.cuisineLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Taste Profile Summary */}
          {tasteProfile && Object.keys(tasteProfile.tagScores || {}).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.secondary} />
                <Text style={styles.sectionTitle}>Lezzet Profilin</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Aktivitelerine göre otomatik oluşturuldu</Text>
              <View style={styles.tasteTagsWrap}>
                {Object.entries(tasteProfile.tagScores as Record<string, number>)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 10)
                  .map(([tag, score]) => (
                    <View key={tag} style={styles.tasteTag}>
                      <Text style={styles.tasteTagText}>{tag}</Text>
                      <View style={[styles.tasteTagBar, { width: Math.min(40, (score as number) * 3) }]} />
                    </View>
                  ))
                }
              </View>
              {tasteProfile.difficultyPreference && (
                <Text style={styles.tasteInsight}>
                  Tercih ettiğin zorluk: <Text style={{ fontWeight: '700' }}>{tasteProfile.difficultyPreference}</Text>
                </Text>
              )}
              {tasteProfile.avgTimePreference && (
                <Text style={styles.tasteInsight}>
                  Ortalama pişirme süresi: <Text style={{ fontWeight: '700' }}>{tasteProfile.avgTimePreference} dk</Text>
                </Text>
              )}
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Kaydediliyor' : 'Tercihleri kaydet'}
            accessibilityState={{ disabled: saving }}
          >
            <MaterialIcons name="save" size={20} color={colors.onPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}</Text>
          </TouchableOpacity>
        </>
      )}

      {activeTab === 'prefs' && (
        <>
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
                  accessibilityRole="switch"
                  accessibilityLabel={`${d.label} beslenme tercihi`}
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
                    accessibilityRole="checkbox"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={a}
                  >
                    {active && <MaterialIcons name="check" size={14} color={colors.error} />}
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Kaydediliyor' : 'Tercihleri kaydet'}
            accessibilityState={{ disabled: saving }}
          >
            <MaterialIcons name="save" size={20} color={colors.onPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Çıkış yap"
      >
        <MaterialIcons name="logout" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    ...(isWeb ? { maxWidth: 800, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
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
  avatarText: { color: colors.onPrimaryContainer, fontSize: fontSize.title, fontFamily: fonts.headingExtraBold },
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
  userName: { fontSize: fontSize.xxl, fontFamily: fonts.headingExtraBold, color: colors.text, letterSpacing: -0.5 },
  userEmail: { fontSize: fontSize.sm, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 2 },

  // Bento Grid
  bentoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bentoCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bentoLarge: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  bentoColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  bentoSmall: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  bentoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: '#FF4B6E' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bentoValue: {
    fontSize: 36,
    fontFamily: fonts.headingExtraBold,
    color: colors.text,
    letterSpacing: -1,
  },
  bentoLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.5,
  },
  bentoSmallValue: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.headingBold,
    color: colors.text,
    marginTop: 4,
  },
  bentoSmallLabel: {
    fontSize: 10,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.5,
  },

  // Nav Grid
  navGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  navCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  navCardLabel: { fontSize: fontSize.xs, fontFamily: fonts.headingBold, color: colors.text, textAlign: 'center' },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.headingSemiBold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },

  // Section
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },

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
    fontFamily: fonts.headingBold,
    color: colors.text,
  },
  servingLabel: { fontSize: fontSize.md, fontFamily: fonts.bodyMedium, color: colors.textSecondary },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  switchLabel: { fontSize: fontSize.md, fontFamily: fonts.bodyMedium, color: colors.text },

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
  chipText: { fontSize: fontSize.sm, fontFamily: fonts.bodyMedium, color: colors.textSecondary },
  chipTextActive: { color: colors.error, fontFamily: fonts.bodySemiBold },

  // Save
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: colors.onPrimary, fontFamily: fonts.headingBold, fontSize: fontSize.md },

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
  logoutText: { color: colors.error, fontFamily: fonts.headingBold, fontSize: fontSize.md },

  disabled: { opacity: 0.5 },

  // Theme mode selector
  themeModes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  themeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeBtnText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.headingSemiBold,
    color: colors.textSecondary,
  },
  themeBtnTextActive: {
    color: colors.onPrimary,
  },

  // Waste dashboard
  wasteSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  wasteScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  wasteScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wasteScoreValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  wasteScoreLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  wasteMetrics: {
    flex: 1,
    gap: 4,
  },
  wasteMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wasteMetricIcon: { fontSize: 14 },
  wasteMetricText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  weeklyChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 60,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  weeklyBar: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyBarStack: {
    width: 20,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
  weeklyBarFill: {
    width: '100%' as any,
  },
  weeklyBarLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Skill level
  skillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skillBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skillBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  skillEmoji: { fontSize: 20, marginBottom: 2 },
  skillLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  skillLabelActive: {
    color: colors.onPrimary,
  },

  // Cuisine preferences
  sectionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  cuisineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 4,
  },
  cuisineChipActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary,
  },
  cuisineEmoji: { fontSize: 16 },
  cuisineLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cuisineLabelActive: {
    color: colors.primary,
  },

  // Taste profile
  tasteTagsWrap: {
    gap: 6,
  },
  tasteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tasteTagText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '600',
    width: 100,
  },
  tasteTagBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  tasteInsight: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

export default withScreenErrorBoundary(ProfileScreen, 'Profil');
