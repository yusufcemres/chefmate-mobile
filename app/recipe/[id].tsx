import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useShoppingStore } from '../../src/stores/shopping';
import { useMealPlanStore } from '../../src/stores/meal-plans';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Recipe, MealPlan } from '../../src/types';
import AiRecipeSuggestion from '../../src/components/AiRecipeSuggestion';

interface NutritionInfo {
  recipeId: string;
  title: string;
  servingSize: number;
  perServing: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  perRecipe: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  ingredientsWithNutrition: number;
  totalIngredients: number;
}

const difficultyLabel: Record<string, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor', easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const difficultyColor: Record<string, string> = { EASY: colors.easy, MEDIUM: colors.medium, HARD: colors.hard, easy: colors.easy, medium: colors.medium, hard: colors.hard };
const roleLabel: Record<string, string> = { MAIN: 'Ana', SEASONING: 'Baharat', OPTIONAL: 'Opsiyonel', main: 'Ana', seasoning: 'Baharat', optional: 'Opsiyonel' };

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const { generateFromRecipe } = useShoppingStore();
  const { plans, fetchPlans, addItem: addToPlan } = useMealPlanStore();
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  useEffect(() => {
    fetchPlans();
    api.get<{ data: Recipe }>(`/recipes/${id}`)
      .then((res) => setRecipe(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const loadNutrition = async () => {
    if (nutrition) { setShowNutrition(!showNutrition); return; }
    try {
      const res = await api.get<{ data: NutritionInfo }>(`/recipes/${id}/nutrition`);
      setNutrition(res.data || res as any);
      setShowNutrition(true);
    } catch { }
  };

  const handleAddToShoppingList = async () => {
    try {
      const result = await generateFromRecipe(id!);
      const msg = result?.message || 'Liste oluşturuldu';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Alışveriş Listesi', msg);
    } catch (err: any) {
      const errMsg = err.message || 'Hata oluştu';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Hata', errMsg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="restaurant" size={64} color={colors.surfaceContainerHigh} />
        <Text style={styles.errorText}>Tarif bulunamadı</Text>
      </View>
    );
  }

  const totalTime = recipe.totalTimeMinutes || (recipe.prepTimeMinutes + recipe.cookTimeMinutes);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.desc}>{recipe.description}</Text>

      {/* Floating Meta Card */}
      <View style={styles.metaCard}>
        <View style={styles.metaItem}>
          <MaterialIcons name="schedule" size={20} color={colors.primary} />
          <Text style={styles.metaValue}>{totalTime} dk</Text>
          <Text style={styles.metaLabel}>Toplam</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <MaterialIcons name="restaurant" size={20} color={difficultyColor[recipe.difficulty] || colors.primary} />
          <Text style={[styles.metaValue, { color: difficultyColor[recipe.difficulty] }]}>
            {difficultyLabel[recipe.difficulty]}
          </Text>
          <Text style={styles.metaLabel}>Zorluk</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <MaterialIcons name="people" size={20} color={colors.primary} />
          <Text style={styles.metaValue}>{recipe.servingSize}</Text>
          <Text style={styles.metaLabel}>Kişilik</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <MaterialIcons name="star" size={20} color={colors.tertiary} />
          <Text style={styles.metaValue}>{(recipe.ratingAvg || 0).toFixed(1)}</Text>
          <Text style={styles.metaLabel}>{recipe.ratingCount} oy</Text>
        </View>
      </View>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <View style={styles.tagRow}>
          {recipe.tags.map((tag) => (
            <View key={tag.id} style={styles.tag}>
              <Text style={styles.tagText}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ingredients */}
      <View style={styles.sectionHeader}>
        <MaterialIcons name="checklist" size={22} color={colors.primary} />
        <Text style={styles.sectionTitle}>Malzemeler</Text>
      </View>
      <View style={styles.ingredientList}>
        {recipe.ingredients.map((ing: any) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <View style={styles.ingredientLeft}>
              <Text style={styles.ingredientName}>{ing.ingredientNameSnapshot}</Text>
              <View style={[styles.roleBadge, {
                backgroundColor: ing.role === 'main' || ing.role === 'MAIN' ? colors.primaryContainer + '60' :
                  ing.role === 'seasoning' || ing.role === 'SEASONING' ? colors.tertiaryContainer + '60' :
                  colors.surfaceContainerHigh,
              }]}>
                <Text style={[styles.roleText, {
                  color: ing.role === 'main' || ing.role === 'MAIN' ? colors.primary :
                    ing.role === 'seasoning' || ing.role === 'SEASONING' ? colors.tertiary :
                    colors.textMuted,
                }]}>{roleLabel[ing.role] || ing.role}</Text>
              </View>
            </View>
            <Text style={styles.ingredientQty}>
              {ing.quantityDisplay ?? ing.requiredQuantity} {ing.displayUnit ?? ing.requiredUnit}
            </Text>
          </View>
        ))}
      </View>

      {/* Steps */}
      <View style={styles.sectionHeader}>
        <MaterialIcons name="format-list-numbered" size={22} color={colors.primary} />
        <Text style={styles.sectionTitle}>Yapılışı</Text>
      </View>
      <View style={styles.stepList}>
        {recipe.steps.map((step: any) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.stepNumber ?? step.stepOrder}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
              {(step.stepDurationMinutes || step.durationMinutes) ? (
                <View style={styles.stepDurationBadge}>
                  <MaterialIcons name="schedule" size={12} color={colors.tertiary} />
                  <Text style={styles.stepDuration}>{step.stepDurationMinutes || step.durationMinutes} dakika</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* AI Recipe Suggestion */}
      <AiRecipeSuggestion recipeId={recipe.id} />

      {/* Nutrition Toggle */}
      <TouchableOpacity style={styles.nutritionToggle} onPress={loadNutrition}>
        <MaterialIcons name={showNutrition ? 'expand-less' : 'expand-more'} size={20} color={colors.primary} />
        <Text style={styles.nutritionToggleText}>
          {showNutrition ? 'Besin Değerlerini Gizle' : 'Besin Değerlerini Göster'}
        </Text>
      </TouchableOpacity>

      {showNutrition && nutrition && (
        <View style={styles.nutritionCard}>
          <Text style={styles.nutritionTitle}>Porsiyon Başı ({nutrition.servingSize} kişilik)</Text>
          <View style={styles.nutritionGrid}>
            {[
              { label: 'kcal', value: nutrition.perServing.calories, icon: 'local-fire-department' as const },
              { label: 'Protein', value: `${nutrition.perServing.protein}g`, icon: 'fitness-center' as const },
              { label: 'Karb', value: `${nutrition.perServing.carbs}g`, icon: 'grain' as const },
              { label: 'Yağ', value: `${nutrition.perServing.fat}g`, icon: 'water-drop' as const },
              { label: 'Lif', value: `${nutrition.perServing.fiber}g`, icon: 'eco' as const },
            ].map((n) => (
              <View key={n.label} style={styles.nutritionItem}>
                <MaterialIcons name={n.icon} size={16} color={colors.primary} />
                <Text style={styles.nutritionValue}>{n.value}</Text>
                <Text style={styles.nutritionLabel}>{n.label}</Text>
              </View>
            ))}
          </View>
          {nutrition.ingredientsWithNutrition < nutrition.totalIngredients && (
            <Text style={styles.nutritionNote}>
              * {nutrition.totalIngredients - nutrition.ingredientsWithNutrition} malzemenin besin değeri bilinmiyor
            </Text>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <TouchableOpacity style={styles.shopBtn} onPress={handleAddToShoppingList}>
        <MaterialIcons name="shopping-cart" size={20} color={colors.onSecondary} />
        <Text style={styles.shopBtnText}>Eksik Malzemeleri Listeye Ekle</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.planBtn} onPress={() => setShowPlanPicker(!showPlanPicker)}>
        <MaterialIcons name="calendar-today" size={20} color={colors.textInverse} />
        <Text style={styles.planBtnText}>Yemek Planına Ekle</Text>
      </TouchableOpacity>

      {showPlanPicker && (
        <View style={styles.planPicker}>
          {plans.length === 0 ? (
            <Text style={styles.planPickerEmpty}>
              Henüz planın yok. Profil sayfasından oluştur.
            </Text>
          ) : (
            plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={styles.planPickerItem}
                onPress={async () => {
                  try {
                    const today = new Date().toISOString().split('T')[0];
                    await addToPlan(plan.id, { recipeId: recipe.id, date: today, mealType: 'DINNER' });
                    setShowPlanPicker(false);
                    const msg = `"${recipe.title}" plana eklendi!`;
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Eklendi', msg);
                  } catch (err: any) {
                    const msg = err.message || 'Hata';
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
                  }
                }}
              >
                <Text style={styles.planPickerName}>{plan.name}</Text>
                <Text style={styles.planPickerMeta}>
                  {new Date(plan.startDate).toLocaleDateString('tr')} — {new Date(plan.endDate).toLocaleDateString('tr')}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.cookBtn}
        onPress={() => router.push(`/cooking/${recipe.id}`)}
      >
        <MaterialIcons name="play-arrow" size={24} color={colors.onPrimary} />
        <Text style={styles.cookBtnText}>Pişirme Modunu Başlat</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { marginTop: spacing.md, fontSize: fontSize.lg, color: colors.textSecondary },

  // Header
  title: { fontSize: fontSize.title, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  desc: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 22 },

  // Meta Card
  metaCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  metaItem: { flex: 1, alignItems: 'center', gap: 2 },
  metaDivider: { width: 1, height: 40, backgroundColor: colors.outlineVariant, opacity: 0.4 },
  metaValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  metaLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  tag: { backgroundColor: colors.primaryContainer + '40', borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 4 },
  tagText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },

  // Ingredients
  ingredientList: { backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.sm },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  ingredientLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  ingredientName: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  roleText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientQty: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },

  // Steps
  stepList: { gap: spacing.md, marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.sm },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  stepDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.tertiaryContainer + '40',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  stepDuration: { fontSize: fontSize.xs, color: colors.tertiary, fontWeight: '700' },

  // Nutrition
  nutritionToggle: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  nutritionToggleText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  nutritionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  nutritionTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  nutritionItem: { alignItems: 'center', flex: 1, gap: 2 },
  nutritionValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary },
  nutritionLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  nutritionNote: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },

  // Action Buttons
  shopBtn: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  shopBtnText: { color: colors.onSecondary, fontWeight: '800', fontSize: fontSize.md },

  planBtn: {
    backgroundColor: colors.tertiary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  planBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: fontSize.md },

  planPicker: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  planPickerEmpty: { padding: spacing.md, color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  planPickerItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
  planPickerName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  planPickerMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  cookBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cookBtnText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.lg },
});
