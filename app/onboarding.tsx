import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../src/stores/auth';
import { colors, spacing, fontSize, borderRadius, fonts } from '../src/theme';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const cuisineOptions = [
  { slug: 'turk-mutfagi', name: 'Türk', emoji: '🇹🇷' },
  { slug: 'italyan-mutfagi', name: 'İtalyan', emoji: '🇮🇹' },
  { slug: 'japon-mutfagi', name: 'Japon', emoji: '🇯🇵' },
  { slug: 'kore-mutfagi', name: 'Kore', emoji: '🇰🇷' },
  { slug: 'meksika-mutfagi', name: 'Meksika', emoji: '🇲🇽' },
  { slug: 'hint-mutfagi', name: 'Hint', emoji: '🇮🇳' },
  { slug: 'fransiz-mutfagi', name: 'Fransız', emoji: '🇫🇷' },
  { slug: 'cin-mutfagi', name: 'Çin', emoji: '🇨🇳' },
  { slug: 'akdeniz-mutfagi', name: 'Akdeniz', emoji: '🫒' },
  { slug: 'osmanli-mutfagi', name: 'Osmanlı', emoji: '👑' },
];

const dietOptions = [
  { key: 'vegetarian', label: 'Vejetaryen', emoji: '🥦', desc: 'Et ve balık yok' },
  { key: 'vegan', label: 'Vegan', emoji: '🌱', desc: 'Hayvansal ürün yok' },
  { key: 'gluten_free', label: 'Glutensiz', emoji: '🌾', desc: 'Gluten içermeyen' },
  { key: 'dairy_free', label: 'Süt Ürünsüz', emoji: '🥛', desc: 'Laktoz/süt yok' },
  { key: 'low_carb', label: 'Düşük Karb', emoji: '🥩', desc: 'Keto / Low-carb' },
];

const allergenOptions = [
  'Gluten', 'Süt', 'Yumurta', 'Balık', 'Kabuklu Deniz Ürünü',
  'Fıstık', 'Soya', 'Kereviz', 'Hardal', 'Susam',
];

const TOTAL_STEPS = 2;

export default function OnboardingScreen() {
  const { updatePreferences } = useAuthStore();
  const [step, setStep] = useState(0);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<Record<string, boolean>>({});
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [servingSize, setServingSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const next = () => animateTransition(Math.min(step + 1, TOTAL_STEPS - 1));
  const back = () => animateTransition(Math.max(step - 1, 0));

  const toggleCuisine = (slug: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };
  const toggleDiet = (key: string) => setSelectedDiets((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleAllergen = (key: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key],
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updatePreferences({
        dietaryProfile: selectedDiets,
        allergens: selectedAllergens,
        servingSize,
      });
    } catch {}
    await AsyncStorage.setItem('onboarding_done', 'true');
    setSaving(false);
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(tabs)');
  };

  return (
    <View style={s.container}>
      {/* Progress */}
      <View style={s.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[s.progressBar, i <= step && s.progressBarActive]} accessibilityLabel={'Adım ' + (i + 1)} />
        ))}
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ===== STEP 0: Welcome + Cuisine + Serving ===== */}
          {step === 0 && (
            <View style={s.stepCenter}>
              {/* Hero */}
              <View style={s.heroIcon}>
                <Text style={{ fontSize: 52 }}>👨‍🍳</Text>
              </View>
              <Text style={s.heroTitle}>
                Mutfağının{'\n'}Dijital Şefi
              </Text>
              <Text style={s.heroDesc}>
                577+ tarif, AI destekli öneriler.{'\n'}
                Hangi mutfakları sevdiğini ve kaç kişilik pişirdiğini söyle.
              </Text>

              {/* Cuisine selection */}
              <Text style={s.sectionLabel}>Favori Mutfaklar</Text>
              <View style={s.cuisineGrid}>
                {cuisineOptions.map((c) => {
                  const active = selectedCuisines.includes(c.slug);
                  return (
                    <TouchableOpacity
                      key={c.slug}
                      style={s.cuisineCircle}
                      onPress={() => toggleCuisine(c.slug)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={c.name}
                    >
                      <View style={[s.cuisineIconWrap, active && s.cuisineIconWrapActive]}>
                        <Text style={s.cuisineEmoji}>{c.emoji}</Text>
                        {active && (
                          <View style={s.cuisineCheck}>
                            <MaterialIcons name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text style={[s.cuisineLabel, active && s.cuisineLabelActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Serving size */}
              <Text style={s.sectionLabel}>Porsiyon</Text>
              <View style={s.servingRow}>
                <TouchableOpacity
                  style={s.servingBtn}
                  onPress={() => setServingSize(Math.max(1, servingSize - 1))}
                >
                  <MaterialIcons name="remove" size={22} color={colors.primary} />
                </TouchableOpacity>
                <View style={s.servingCenter}>
                  <Text style={s.servingNumber}>{servingSize}</Text>
                  <Text style={s.servingUnit}>kişilik</Text>
                </View>
                <TouchableOpacity
                  style={s.servingBtn}
                  onPress={() => setServingSize(Math.min(12, servingSize + 1))}
                >
                  <MaterialIcons name="add" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={s.hint}>Seçmesen de tüm mutfakları görebilirsin</Text>
            </View>
          )}

          {/* ===== STEP 1: Diet + Allergens + Finish ===== */}
          {step === 1 && (
            <View style={s.stepCenter}>
              <Text style={s.stepEmoji}>🥗</Text>
              <Text style={s.stepTitle}>Beslenme & Alerjenler</Text>
              <Text style={s.stepDesc}>Uygun olmayan tarifleri filtrelememize yardımcı olur</Text>

              {/* Diet cards */}
              <View style={s.dietGrid}>
                {dietOptions.map((d) => {
                  const active = !!selectedDiets[d.key];
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[s.dietCard, active && s.dietCardActive]}
                      onPress={() => toggleDiet(d.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={d.label}
                    >
                      <Text style={s.dietEmoji}>{d.emoji}</Text>
                      <Text style={[s.dietLabel, active && s.dietLabelActive]}>{d.label}</Text>
                      <Text style={s.dietDesc}>{d.desc}</Text>
                      {active && (
                        <View style={s.dietCheck}>
                          <MaterialIcons name="check" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Allergens */}
              <Text style={s.allergenTitle}>Alerjenler</Text>
              <View style={s.allergenRow}>
                {allergenOptions.map((a) => {
                  const active = selectedAllergens.includes(a);
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[s.allergenChip, active && s.allergenChipActive]}
                      onPress={() => toggleAllergen(a)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={a}
                    >
                      {active && <MaterialIcons name="close" size={14} color={colors.error} />}
                      <Text style={[s.allergenText, active && s.allergenTextActive]}>{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Ready summary */}
              <View style={s.readyCard}>
                <MaterialIcons name="auto-awesome" size={32} color={colors.primary} />
                <Text style={s.readyTitle}>Hazırsın!</Text>
                <Text style={s.readyDesc}>
                  {selectedCuisines.length > 0
                    ? `${selectedCuisines.length} mutfak · `
                    : ''}
                  {Object.values(selectedDiets).filter(Boolean).length > 0
                    ? `${Object.values(selectedDiets).filter(Boolean).length} diyet · `
                    : ''}
                  {servingSize} kişilik porsiyonlar
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Bottom navigation */}
      <View style={s.bottomBar}>
        {step === 0 ? (
          <>
            <TouchableOpacity onPress={handleSkip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Atla">
              <Text style={s.skipText}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={next} accessibilityRole="button" accessibilityLabel="Devam">
              <Text style={s.nextBtnText}>Devam</Text>
              <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={s.backBtn} onPress={back} accessibilityRole="button" accessibilityLabel="Geri">
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={s.backText}>Geri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.finishBtn, saving && { opacity: 0.5 }]}
              onPress={handleFinish}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Kaydediliyor' : 'Keşfetmeye Başla'}
            >
              <MaterialIcons name="auto-awesome" size={18} color={colors.onPrimary} />
              <Text style={s.finishBtnText}>
                {saving ? 'Kaydediliyor...' : 'Keşfetmeye Başla!'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    ...(isWeb ? { maxWidth: 600, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Platform.OS === 'web' ? spacing.lg : spacing.xl + 16,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceContainerHigh,
  },
  progressBarActive: { backgroundColor: colors.primaryContainer },

  // Steps
  stepCenter: { alignItems: 'center', paddingTop: spacing.md },

  // Hero
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 44,
    fontFamily: fonts.headingExtraBold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  heroDesc: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // Section labels
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.headingExtraBold,
    color: colors.primaryContainer,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  },

  // Step headers
  stepEmoji: { fontSize: 44, marginBottom: spacing.xs },
  stepTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.headingExtraBold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  stepDesc: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Cuisine grid
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%' as any,
  },
  cuisineCircle: {
    alignItems: 'center',
    width: (width - 80) / 5 > 72 ? 72 : (width - 80) / 5,
  },
  cuisineIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  cuisineIconWrapActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  cuisineEmoji: { fontSize: 24 },
  cuisineCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  cuisineLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  cuisineLabelActive: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },

  // Serving
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  servingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingCenter: { alignItems: 'center' },
  servingNumber: {
    fontSize: 48,
    fontFamily: fonts.headingExtraBold,
    color: colors.primary,
    lineHeight: 54,
  },
  servingUnit: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },

  // Diet cards
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%' as any,
    marginBottom: spacing.lg,
  },
  dietCard: {
    width: (width - 72) / 2,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
    position: 'relative',
  },
  dietCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer + '30',
  },
  dietEmoji: { fontSize: 28, marginBottom: 4 },
  dietLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.headingBold,
    color: colors.text,
  },
  dietLabelActive: { color: colors.primary },
  dietDesc: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  dietCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Allergens
  allergenTitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingBold,
    color: colors.text,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    width: '100%' as any,
    marginBottom: spacing.lg,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  allergenChipActive: {
    borderColor: colors.error,
    backgroundColor: colors.error + '12',
  },
  allergenText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
  },
  allergenTextActive: {
    color: colors.error,
    fontFamily: fonts.bodySemiBold,
  },

  // Ready card
  readyCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%' as any,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  readyTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.headingBold,
    color: colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  readyDesc: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'web' ? spacing.md : spacing.xl,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontFamily: fonts.bodyMedium,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontFamily: fonts.headingSemiBold,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
  },
  nextBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.headingBold,
    fontSize: fontSize.md,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
  },
  finishBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.headingBold,
    fontSize: fontSize.md,
  },
});
