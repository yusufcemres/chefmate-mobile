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
import { api } from '../../src/api/client';
import { useShoppingStore } from '../../src/stores/shopping';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Recipe } from '../../src/types';

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

  useEffect(() => {
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
        <Text style={{ fontSize: 48 }}>🍽️</Text>
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

      {/* Meta Row */}
      <View style={styles.metaRow}>
        <View style={styles.metaCard}>
          <Text style={styles.metaValue}>{totalTime} dk</Text>
          <Text style={styles.metaLabel}>Toplam Süre</Text>
        </View>
        <View style={styles.metaCard}>
          <Text style={[styles.metaValue, { color: difficultyColor[recipe.difficulty] }]}>
            {difficultyLabel[recipe.difficulty]}
          </Text>
          <Text style={styles.metaLabel}>Zorluk</Text>
        </View>
        <View style={styles.metaCard}>
          <Text style={styles.metaValue}>{recipe.servingSize}</Text>
          <Text style={styles.metaLabel}>Kişilik</Text>
        </View>
        <View style={styles.metaCard}>
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
      <Text style={styles.sectionTitle}>Malzemeler</Text>
      <View style={styles.ingredientList}>
        {recipe.ingredients.map((ing: any) => (
          <View key={ing.id} style={styles.ingredientRow}>
            <View style={styles.ingredientLeft}>
              <Text style={styles.ingredientName}>{ing.ingredientNameSnapshot}</Text>
              <Text style={styles.ingredientRole}>{roleLabel[ing.role] || ing.role}</Text>
            </View>
            <Text style={styles.ingredientQty}>
              {ing.quantityDisplay ?? ing.requiredQuantity} {ing.displayUnit ?? ing.requiredUnit}
            </Text>
          </View>
        ))}
      </View>

      {/* Steps */}
      <Text style={styles.sectionTitle}>Yapılışı</Text>
      <View style={styles.stepList}>
        {recipe.steps.map((step: any) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.stepNumber ?? step.stepOrder}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
              {(step.stepDurationMinutes || step.durationMinutes) ? (
                <Text style={styles.stepDuration}>{step.stepDurationMinutes || step.durationMinutes} dakika</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {/* Nutrition Toggle */}
      <TouchableOpacity style={styles.nutritionToggle} onPress={loadNutrition}>
        <Text style={styles.nutritionToggleText}>
          {showNutrition ? 'Besin Değerlerini Gizle' : 'Besin Değerlerini Göster'}
        </Text>
      </TouchableOpacity>

      {showNutrition && nutrition && (
        <View style={styles.nutritionCard}>
          <Text style={styles.nutritionTitle}>Porsiyon Başı ({nutrition.servingSize} kişilik)</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{nutrition.perServing.calories}</Text>
              <Text style={styles.nutritionLabel}>kcal</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{nutrition.perServing.protein}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{nutrition.perServing.carbs}g</Text>
              <Text style={styles.nutritionLabel}>Karb</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{nutrition.perServing.fat}g</Text>
              <Text style={styles.nutritionLabel}>Yağ</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{nutrition.perServing.fiber}g</Text>
              <Text style={styles.nutritionLabel}>Lif</Text>
            </View>
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
        <Text style={styles.shopBtnText}>Eksik Malzemeleri Listeye Ekle</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cookBtn}
        onPress={() => router.push(`/cooking/${recipe.id}`)}
      >
        <Text style={styles.cookBtnText}>Pişirme Modunu Başlat</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginTop: spacing.md, fontSize: fontSize.lg, color: colors.textSecondary },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  desc: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metaCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' },
  metaValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  metaLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  tag: { backgroundColor: colors.primaryLight + '30', borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  ingredientList: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  ingredientLeft: {},
  ingredientName: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  ingredientRole: { fontSize: fontSize.xs, color: colors.textMuted },
  ingredientQty: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  stepList: { gap: spacing.md },
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumberText: { color: colors.textInverse, fontWeight: '800', fontSize: fontSize.sm },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  stepDuration: { fontSize: fontSize.xs, color: colors.secondary, fontWeight: '600', marginTop: 4 },
  stepTip: { fontSize: fontSize.xs, color: colors.warning, marginTop: 2, fontStyle: 'italic' },
  nutritionToggle: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  nutritionToggleText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },
  nutritionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.sm },
  nutritionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary },
  nutritionLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  nutritionNote: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  shopBtn: { backgroundColor: colors.warning, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  shopBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: fontSize.md },
  cookBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  cookBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: fontSize.lg },
});
