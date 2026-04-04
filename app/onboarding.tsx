import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';

const { width } = Dimensions.get('window');

const allergenOptions = [
  { key: 'Gluten', icon: '🌾' },
  { key: 'Süt', icon: '🥛' },
  { key: 'Yumurta', icon: '🥚' },
  { key: 'Balık', icon: '🐟' },
  { key: 'Kabuklu Deniz Ürünü', icon: '🦐' },
  { key: 'Fıstık', icon: '🥜' },
  { key: 'Soya', icon: '🫘' },
  { key: 'Kereviz', icon: '🥬' },
  { key: 'Hardal', icon: '🟡' },
  { key: 'Susam', icon: '🫓' },
];

const dietOptions = [
  { key: 'vegetarian', label: 'Vejetaryen', icon: '🥗', desc: 'Et ve balık yok' },
  { key: 'vegan', label: 'Vegan', icon: '🌱', desc: 'Hayvansal ürün yok' },
  { key: 'gluten_free', label: 'Glutensiz', icon: '🚫', desc: 'Gluten içermeyen' },
  { key: 'dairy_free', label: 'Süt Ürünsüz', icon: '🥛', desc: 'Laktoz/süt yok' },
  { key: 'low_carb', label: 'Düşük Karbonhidrat', icon: '🥩', desc: 'Keto / Low-carb' },
];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { updatePreferences } = useAuthStore();
  const [step, setStep] = useState(0);
  const [selectedDiets, setSelectedDiets] = useState<Record<string, boolean>>({});
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [servingSize, setServingSize] = useState(2);
  const [saving, setSaving] = useState(false);

  const toggleDiet = (key: string) => {
    setSelectedDiets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    } catch {
      // preferences may fail if endpoint not ready — continue anyway
    }
    await AsyncStorage.setItem('onboarding_done', 'true');
    setSaving(false);
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/(tabs)');
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* STEP 0: Welcome */}
        {step === 0 && (
          <View style={styles.stepContainer}>
            <Text style={styles.heroIcon}>👨‍🍳</Text>
            <Text style={styles.heroTitle}>ChefMate'e{'\n'}Hoş Geldin!</Text>
            <Text style={styles.heroDesc}>
              Mutfağındaki malzemelere göre tarif önerileri al, yemek planları oluştur ve alışveriş listeni yönet.
            </Text>
            <Text style={styles.heroSub}>
              Sana en iyi önerileri sunabilmemiz için birkaç tercihini öğrenmek istiyoruz.
            </Text>
          </View>
        )}

        {/* STEP 1: Diet Preferences */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>🥗</Text>
            <Text style={styles.stepTitle}>Beslenme Tercihlerin</Text>
            <Text style={styles.stepDesc}>Sana uygun olmayan tarifleri filtrelememize yardımcı olur</Text>
            <View style={styles.optionsGrid}>
              {dietOptions.map((d) => {
                const active = !!selectedDiets[d.key];
                return (
                  <TouchableOpacity
                    key={d.key}
                    style={[styles.optionCard, active && styles.optionCardActive]}
                    onPress={() => toggleDiet(d.key)}
                  >
                    <Text style={styles.optionIcon}>{d.icon}</Text>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{d.label}</Text>
                    <Text style={styles.optionDesc}>{d.desc}</Text>
                    {active && <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: Allergens */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>⚠️</Text>
            <Text style={styles.stepTitle}>Alerjenler</Text>
            <Text style={styles.stepDesc}>Bu malzemeleri içeren tarifleri hariç tutacağız</Text>
            <View style={styles.allergenGrid}>
              {allergenOptions.map((a) => {
                const active = selectedAllergens.includes(a.key);
                return (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.allergenChip, active && styles.allergenChipActive]}
                    onPress={() => toggleAllergen(a.key)}
                  >
                    <Text style={styles.allergenIcon}>{a.icon}</Text>
                    <Text style={[styles.allergenLabel, active && styles.allergenLabelActive]}>{a.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.allergenNote}>Seçmezsen sorun yok — sonra profilden ekleyebilirsin</Text>
          </View>
        )}

        {/* STEP 3: Serving + Finish */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepIcon}>🍽️</Text>
            <Text style={styles.stepTitle}>Porsiyon Sayısı</Text>
            <Text style={styles.stepDesc}>Genellikle kaç kişilik yemek yapıyorsun?</Text>
            <View style={styles.servingSelector}>
              <TouchableOpacity
                style={styles.servingBtn}
                onPress={() => setServingSize(Math.max(1, servingSize - 1))}
              >
                <Text style={styles.servingBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.servingDisplay}>
                <Text style={styles.servingNumber}>{servingSize}</Text>
                <Text style={styles.servingUnit}>kişilik</Text>
              </View>
              <TouchableOpacity
                style={styles.servingBtn}
                onPress={() => setServingSize(Math.min(12, servingSize + 1))}
              >
                <Text style={styles.servingBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.readyCard}>
              <Text style={styles.readyIcon}>🎉</Text>
              <Text style={styles.readyTitle}>Hazırsın!</Text>
              <Text style={styles.readyDesc}>
                Tercihlerini kaydedip hemen yemek keşfetmeye başlayabilirsin.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomBar}>
        {step === 0 ? (
          <>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>Başlayalım →</Text>
            </TouchableOpacity>
          </>
        ) : step < TOTAL_STEPS - 1 ? (
          <>
            <TouchableOpacity onPress={back}>
              <Text style={styles.backText}>← Geri</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>İleri →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={back}>
              <Text style={styles.backText}>← Geri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.finishBtn, saving && { opacity: 0.5 }]}
              onPress={handleFinish}
              disabled={saving}
            >
              <Text style={styles.finishBtnText}>
                {saving ? 'Kaydediliyor...' : 'Keşfetmeye Başla! 🚀'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: 120 },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressDot: {
    width: (width - 120) / TOTAL_STEPS,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
  },
  progressDotActive: { backgroundColor: colors.primary },

  // Step container
  stepContainer: { alignItems: 'center', paddingTop: spacing.lg },

  // Hero (Welcome)
  heroIcon: { fontSize: 72, marginBottom: spacing.md },
  heroTitle: { fontSize: fontSize.title, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 42 },
  heroDesc: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 22, paddingHorizontal: spacing.md },
  heroSub: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },

  // Step headers
  stepIcon: { fontSize: 48, marginBottom: spacing.sm },
  stepTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  stepDesc: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },

  // Diet options grid
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, width: '100%' },
  optionCard: {
    width: (width - 80) / 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  optionCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '15' },
  optionIcon: { fontSize: 32, marginBottom: spacing.xs },
  optionLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  optionLabelActive: { color: colors.primary },
  optionDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: colors.textInverse, fontSize: 13, fontWeight: '800' },

  // Allergen grid
  allergenGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, width: '100%' },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  allergenChipActive: { borderColor: colors.error, backgroundColor: '#FEE2E2' },
  allergenIcon: { fontSize: 18 },
  allergenLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  allergenLabelActive: { color: colors.error, fontWeight: '700' },
  allergenNote: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' },

  // Serving selector
  servingSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  servingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingBtnText: { fontSize: 28, color: colors.primary, fontWeight: '700', lineHeight: 32 },
  servingDisplay: { alignItems: 'center' },
  servingNumber: { fontSize: 48, fontWeight: '800', color: colors.primary },
  servingUnit: { fontSize: fontSize.sm, color: colors.textSecondary },

  // Ready card
  readyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  readyIcon: { fontSize: 42, marginBottom: spacing.sm },
  readyTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  readyDesc: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

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
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  skipText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '500' },
  backText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
  },
  nextBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
  finishBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
  },
  finishBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
});
