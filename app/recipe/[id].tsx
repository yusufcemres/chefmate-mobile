import { useEffect, useState } from 'react';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useShoppingStore } from '../../src/stores/shopping';
import { useMealPlanStore } from '../../src/stores/meal-plans';
import { useFavoritesStore } from '../../src/stores/favorites';
import { useOfflineCacheStore } from '../../src/stores/offline-cache';
import { colors, spacing, fontSize, borderRadius, fonts } from '../../src/theme';
import { hapticSelection } from '../../src/utils/haptics';
import type { Recipe, MealPlan } from '../../src/types';
import AiRecipeSuggestion from '../../src/components/AiRecipeSuggestion';
import RecipeReviews from '../../src/components/RecipeReviews';
import { findSubstitutions, Substitution } from '../../src/data/ingredient-substitutions';

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

const isWeb = Platform.OS === 'web';

// Extract tag helpers
function getRecipeTags(recipe: any) { return (recipe.tags || []).map((rt: any) => rt.tag || rt); }
function getCuisineTag(recipe: any) { return getRecipeTags(recipe).find((t: any) => t.type === 'CUISINE'); }
function getCategoryTag(recipe: any) { return getRecipeTags(recipe).find((t: any) => t.type === 'CATEGORY'); }

function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const [servings, setServings] = useState<number>(0); // 0 = original
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [showSubsFor, setShowSubsFor] = useState<string | null>(null);
  const { generateFromRecipe } = useShoppingStore();
  const { plans, fetchPlans, addItem: addToPlan } = useMealPlanStore();
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const { isFavorite, toggle: toggleFavorite, fetch: fetchFavorites, loaded: favsLoaded } = useFavoritesStore();

  useEffect(() => {
    fetchPlans();
    if (!favsLoaded) fetchFavorites();
    api.get<any>(`/recipes/${id}`)
      .then((res) => {
        setRecipe(res as any);
        setServings((res as any).servingSize || 1);
        // Cache for offline access
        useOfflineCacheStore.getState().cacheRecipe(res).catch(() => {});
        // Increment view count after successful load
        api.post(`/recipes/${id}/view`).catch(() => {});
      })
      .catch(() => {
        // Try offline cache fallback
        const cached = useOfflineCacheStore.getState().getCachedRecipe(id!);
        if (cached) {
          setRecipe(cached as any);
          setServings(cached.servingSize || 1);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const loadNutrition = async () => {
    if (nutrition) { setShowNutrition(!showNutrition); return; }
    try {
      const res = await api.get<any>(`/recipes/${id}/nutrition`);
      setNutrition(res as any);
      setShowNutrition(true);
    } catch { }
  };

  const handleShare = async () => {
    if (!recipe) return;
    const url = `https://chefmate-sand.vercel.app/recipe/${id}`;
    const message = `${recipe.title} — ChefMate'te bu tarife göz at! ${url}`;
    if (isWeb) {
      try { await navigator.clipboard.writeText(message); window.alert('Link kopyalandı!'); } catch { window.alert(message); }
    } else {
      Share.share({ message, url });
    }
  };

  const handleAddToShoppingList = async () => {
    try {
      const result = await generateFromRecipe(id!);
      const msg = result?.message || 'Liste oluşturuldu';
      isWeb ? window.alert(msg) : Alert.alert('Alışveriş Listesi', msg);
    } catch (err: any) {
      const errMsg = err.message || 'Hata oluştu';
      isWeb ? window.alert(errMsg) : Alert.alert('Hata', errMsg);
    }
  };

  const toggleIngredientCheck = (ingId: string) => {
    hapticSelection();
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
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
  const scaleFactor = recipe.servingSize > 0 ? servings / recipe.servingSize : 1;
  const tags = getRecipeTags(recipe);
  const cuisine = getCuisineTag(recipe);
  const category = getCategoryTag(recipe);

  // JSON-LD Recipe Schema for Google rich results
  const jsonLd = Platform.OS === 'web' ? {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description,
    ...(recipe.imageUrl ? { image: recipe.imageUrl } : {}),
    prepTime: recipe.prepTimeMinutes ? `PT${recipe.prepTimeMinutes}M` : undefined,
    cookTime: recipe.cookTimeMinutes ? `PT${recipe.cookTimeMinutes}M` : undefined,
    totalTime: totalTime ? `PT${totalTime}M` : undefined,
    recipeYield: `${recipe.servingSize} porsiyon`,
    recipeCategory: category?.name || undefined,
    recipeCuisine: cuisine?.name || undefined,
    recipeIngredient: recipe.ingredients.map((ing: any) =>
      `${ing.quantityDisplay ?? ''} ${ing.displayUnit ?? ''} ${ing.ingredientNameSnapshot}`.trim()
    ),
    recipeInstructions: recipe.steps.map((step: any) => ({
      '@type': 'HowToStep',
      text: step.instruction,
    })),
    ...(recipe.ratingAvg > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Number(recipe.ratingAvg).toFixed(1),
        ratingCount: recipe.ratingCount || 1,
      },
    } : {}),
    ...((recipe as any).totalCalories ? {
      nutrition: {
        '@type': 'NutritionInformation',
        calories: `${(recipe as any).totalCalories} kcal`,
        ...((recipe as any).totalProtein ? { proteinContent: `${(recipe as any).totalProtein} g` } : {}),
        ...((recipe as any).totalCarbs ? { carbohydrateContent: `${(recipe as any).totalCarbs} g` } : {}),
        ...((recipe as any).totalFat ? { fatContent: `${(recipe as any).totalFat} g` } : {}),
      },
    } : {}),
  } : null;

  const canonicalUrl = `https://chefmate-sand.vercel.app/recipe/${id}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* OG Tags + JSON-LD for web SEO */}
      {Platform.OS === 'web' && (
        <Head>
          <title>{recipe.title} | ChefMate</title>
          <meta name="description" content={recipe.description} />
          <link rel="canonical" href={canonicalUrl} />

          {/* Open Graph */}
          <meta property="og:title" content={`${recipe.title} | ChefMate`} />
          <meta property="og:description" content={recipe.description} />
          <meta property="og:url" content={canonicalUrl} />
          <meta property="og:type" content="article" />
          {recipe.imageUrl && <meta property="og:image" content={recipe.imageUrl} />}

          {/* Twitter Card */}
          <meta name="twitter:title" content={recipe.title} />
          <meta name="twitter:description" content={recipe.description} />
          {recipe.imageUrl && <meta name="twitter:image" content={recipe.imageUrl} />}

          {/* JSON-LD */}
          {jsonLd && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
          )}
        </Head>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ===== Hero Banner ===== */}
        <View style={styles.heroBanner}>
          {recipe.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={{ fontSize: 64 }}>{category?.emoji || '🍽️'}</Text>
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
            style={styles.heroGradient}
          />
          {/* Back button */}
          <TouchableOpacity style={styles.heroBackBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {/* Action buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroActionBtn} onPress={() => toggleFavorite(recipe.id)}>
              <MaterialIcons
                name={isFavorite(recipe.id) ? 'favorite' : 'favorite-border'}
                size={20}
                color={isFavorite(recipe.id) ? '#FF4B6E' : '#fff'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroActionBtn} onPress={handleShare}>
              <MaterialIcons name="share" size={20} color="#fff" />
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity style={styles.heroActionBtn} onPress={() => window.print()}>
                <MaterialIcons name="print" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          {/* Overlay info */}
          <View style={styles.heroOverlay}>
            {category && (
              <View style={styles.heroCategoryBadge}>
                <Text style={styles.heroCategoryText}>{category.emoji} {category.name}</Text>
              </View>
            )}
            {cuisine && (
              <View style={styles.heroCuisineBadge}>
                <Text style={styles.heroCuisineText}>{cuisine.emoji} {cuisine.name}</Text>
              </View>
            )}
            <Text style={styles.heroTitle}>{recipe.title}</Text>
            {recipe.ratingAvg > 0 && (
              <Text style={styles.heroRating}>★ {Number(recipe.ratingAvg).toFixed(1)} ({recipe.ratingCount || 0})</Text>
            )}
          </View>
        </View>

        {/* ===== Floating Prep/Nutrition Bar ===== */}
        <View style={styles.floatingBar}>
          <View style={styles.floatingItem}>
            <Text style={styles.floatingValue}>{recipe.prepTimeMinutes || '—'}</Text>
            <Text style={styles.floatingLabel}>HAZIRLIK</Text>
          </View>
          <View style={styles.floatingDivider} />
          <View style={styles.floatingItem}>
            <Text style={styles.floatingValue}>{recipe.cookTimeMinutes || '—'}</Text>
            <Text style={styles.floatingLabel}>PİŞİRME</Text>
          </View>
          <View style={styles.floatingDivider} />
          <View style={styles.floatingItem}>
            <Text style={styles.floatingValue}>{servings}</Text>
            <Text style={styles.floatingLabel}>KİŞİLİK</Text>
          </View>
          <View style={styles.floatingDivider} />
          <View style={styles.floatingItem}>
            <Text style={[styles.floatingValue, { color: difficultyColor[recipe.difficulty] }]}>
              {difficultyLabel[recipe.difficulty] || recipe.difficulty}
            </Text>
            <Text style={styles.floatingLabel}>ZORLUK</Text>
          </View>
          {(recipe as any).totalCalories > 0 && (
            <>
              <View style={styles.floatingDivider} />
              <View style={styles.floatingItem}>
                <Text style={[styles.floatingValue, { color: colors.primary }]}>{(recipe as any).totalCalories}</Text>
                <Text style={styles.floatingLabel}>KCAL</Text>
              </View>
            </>
          )}
        </View>

        {/* ===== Compact Action Bar ===== */}
        <View style={styles.actionBar} accessibilityRole="toolbar">
          <TouchableOpacity style={styles.actionBtn} onPress={() => toggleFavorite(recipe.id)} accessibilityLabel={isFavorite(recipe.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'} accessibilityRole="button">
            <MaterialIcons
              name={isFavorite(recipe.id) ? 'favorite' : 'favorite-border'}
              size={22}
              color={isFavorite(recipe.id) ? '#FF4B6E' : colors.textSecondary}
            />
            <Text style={styles.actionLabel}>Favori</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPlanPicker(true)} accessibilityLabel="Yemek planına ekle" accessibilityRole="button">
            <MaterialIcons name="calendar-today" size={22} color={colors.textSecondary} />
            <Text style={styles.actionLabel}>Plana Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAddToShoppingList} accessibilityLabel="Alışveriş listesine ekle" accessibilityRole="button">
            <MaterialIcons name="shopping-cart" size={22} color={colors.textSecondary} />
            <Text style={styles.actionLabel}>Listeye</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} accessibilityLabel="Tarifi paylaş" accessibilityRole="button">
            <MaterialIcons name="share" size={22} color={colors.textSecondary} />
            <Text style={styles.actionLabel}>Paylaş</Text>
          </TouchableOpacity>
        </View>

        {/* Body content */}
        <View style={styles.body}>
          {/* Description */}
          {recipe.description ? <Text style={styles.desc}>{recipe.description}</Text> : null}

          {/* Tags */}
          {tags.length > 0 && (
            <View style={styles.tagRow}>
              {tags.map((tag: any) => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.emoji ? `${tag.emoji} ` : ''}{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ===== Portion Scaling ===== */}
          <View style={styles.portionRow}>
            <Text style={styles.portionLabel}>Porsiyon</Text>
            <View style={styles.portionControls}>
              <TouchableOpacity
                style={styles.portionBtn}
                onPress={() => setServings(Math.max(1, servings - 1))}
              >
                <MaterialIcons name="remove" size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.portionValue}>{servings}</Text>
              <TouchableOpacity
                style={styles.portionBtn}
                onPress={() => setServings(servings + 1)}
              >
                <MaterialIcons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
              {servings !== recipe.servingSize && (
                <TouchableOpacity
                  style={[styles.portionBtn, { marginLeft: 8 }]}
                  onPress={() => setServings(recipe.servingSize)}
                >
                  <MaterialIcons name="restart-alt" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {scaleFactor !== 1 && (recipe as any).totalCalories > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
              <MaterialIcons name="local-fire-department" size={14} color={colors.warning} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontFamily: 'Manrope-Medium' }}>
                {Math.round((recipe as any).totalCalories * scaleFactor)} kcal ({servings} kişilik)
              </Text>
            </View>
          )}

          {/* ===== Ingredients ===== */}
          <View style={styles.sectionHeader}>
            <MaterialIcons name="checklist" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Malzemeler ({recipe.ingredients.length})</Text>
          </View>
          <View style={styles.ingredientList}>
            {recipe.ingredients.map((ing: any) => {
              const isChecked = checkedIngredients.has(ing.id);
              const qty = ing.quantityDisplay ?? ing.requiredQuantity;
              const scaledQty = qty ? Math.round(qty * scaleFactor * 10) / 10 : qty;
              const subs = findSubstitutions(ing.ingredientNameSnapshot);
              const isSubOpen = showSubsFor === ing.id;
              return (
                <View key={ing.id}>
                  <TouchableOpacity
                    style={[styles.ingredientRow, isChecked && styles.ingredientRowChecked]}
                    onPress={() => toggleIngredientCheck(ing.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                      {isChecked && <MaterialIcons name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.ingredientName, isChecked && styles.ingredientNameChecked]}>
                      {ing.ingredientNameSnapshot}
                    </Text>
                    {subs && (
                      <TouchableOpacity
                        style={styles.subBtn}
                        onPress={() => setShowSubsFor(isSubOpen ? null : ing.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialIcons name="swap-horiz" size={16} color={colors.tertiary} />
                      </TouchableOpacity>
                    )}
                    <View style={[styles.roleBadge, {
                      backgroundColor: (ing.role === 'MAIN' || ing.role === 'main') ? colors.primaryContainer + '60' :
                        (ing.role === 'SEASONING' || ing.role === 'seasoning') ? colors.tertiaryContainer + '60' :
                        colors.surfaceContainerHigh,
                    }]}>
                      <Text style={[styles.roleText, {
                        color: (ing.role === 'MAIN' || ing.role === 'main') ? colors.primary :
                          (ing.role === 'SEASONING' || ing.role === 'seasoning') ? colors.tertiary :
                          colors.textMuted,
                      }]}>{roleLabel[ing.role] || ing.role}</Text>
                    </View>
                    <Text style={[styles.ingredientQty, isChecked && { color: colors.textMuted }]}>
                      {scaledQty} {ing.displayUnit ?? ing.requiredUnit}
                    </Text>
                  </TouchableOpacity>
                  {isSubOpen && subs && (
                    <View style={styles.subPanel}>
                      <Text style={styles.subPanelTitle}>Yerine kullanılabilir:</Text>
                      {subs.map((s, i) => (
                        <View key={i} style={styles.subItem}>
                          <Text style={styles.subItemName}>{s.name}</Text>
                          <Text style={styles.subItemRatio}>{s.ratio}</Text>
                          {s.note && <Text style={styles.subItemNote}>{s.note}</Text>}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* ===== Steps ===== */}
          <View style={styles.sectionHeader}>
            <MaterialIcons name="format-list-numbered" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Yapılışı</Text>
          </View>
          <View style={styles.stepList}>
            {recipe.steps.map((step: any, idx: number) => (
              <View key={step.id} style={styles.stepCard}>
                {/* Big step number (editorial style) */}
                <View style={styles.stepNumberBg}>
                  <Text style={styles.stepNumberBig}>{step.stepNumber ?? step.stepOrder ?? idx + 1}</Text>
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

          {/* ===== Chef's Tip ===== */}
          {(recipe as any).tips && (
            <View style={styles.tipBox}>
              <View style={styles.tipHeader}>
                <MaterialIcons name="lightbulb" size={18} color={colors.secondary} />
                <Text style={styles.tipTitle}>Şefin Notu</Text>
              </View>
              <Text style={styles.tipText}>{(recipe as any).tips}</Text>
            </View>
          )}

          {/* Reviews Section */}
          <RecipeReviews recipeId={recipe.id} ratingAvg={recipe.ratingAvg} ratingCount={recipe.ratingCount || 0} />

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

          {showPlanPicker && (
            <View style={styles.planPicker}>
              {plans.length === 0 ? (
                <Text style={styles.planPickerEmpty}>Henüz planın yok. Profil sayfasından oluştur.</Text>
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
                        isWeb ? window.alert(msg) : Alert.alert('Eklendi', msg);
                      } catch (err: any) {
                        const msg = err.message || 'Hata';
                        isWeb ? window.alert(msg) : Alert.alert('Hata', msg);
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

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ===== Sticky Bottom CTA (Talabat pattern) ===== */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity
          style={styles.cookBtn}
          onPress={() => router.push(`/cooking/${recipe.id}`)}
        >
          <MaterialIcons name="play-arrow" size={24} color={colors.onPrimary} />
          <Text style={styles.cookBtnText}>Pişirmeye Başla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    ...(isWeb ? { maxWidth: 800, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { marginTop: spacing.md, fontSize: fontSize.lg, fontFamily: 'Manrope-Regular', color: colors.textSecondary },

  // Hero Banner
  heroBanner: {
    width: '100%' as any,
    height: isWeb ? 400 : 300,
    position: 'relative',
    backgroundColor: colors.surfaceContainerHigh,
  },
  heroImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
  heroFallback: {
    width: '100%' as any,
    height: '100%' as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%' as any,
  },
  heroBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 50,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroActions: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 50,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  heroActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  heroCategoryBadge: {
    backgroundColor: 'rgba(230,107,61,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  heroCategoryText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: '#fff',
  },
  heroCuisineBadge: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroCuisineText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.text,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontFamily: 'Jakarta-ExtraBold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroRating: {
    fontSize: fontSize.md,
    fontFamily: 'Jakarta-Bold',
    color: '#F5A623',
    marginTop: 4,
  },

  // Compact Action Bar
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh + '50',
  },
  actionBtn: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontSize: 10,
    fontFamily: 'Manrope-SemiBold',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // Floating Bar
  floatingBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: -24,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
  },
  floatingItem: { flex: 1, alignItems: 'center', gap: 2 },
  floatingDivider: { width: 1, height: 36, backgroundColor: colors.outlineVariant, opacity: 0.3 },
  floatingValue: { fontSize: fontSize.lg, fontFamily: 'Jakarta-Bold', color: colors.text },
  floatingLabel: { fontSize: 9, fontFamily: 'Manrope-SemiBold', color: colors.textMuted, letterSpacing: 1 },

  // Body
  body: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  desc: { fontSize: fontSize.md, fontFamily: 'Manrope-Regular', color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  tag: { backgroundColor: colors.primaryContainer + '40', borderRadius: borderRadius.full, paddingHorizontal: 12, paddingVertical: 4 },
  tagText: { fontSize: fontSize.xs, fontFamily: 'Manrope-SemiBold', color: colors.primary },

  // Portion Scaling
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  portionLabel: { fontSize: fontSize.md, fontFamily: 'Jakarta-Bold', color: colors.text },
  portionControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  portionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portionValue: { fontSize: fontSize.xl, fontFamily: 'Jakarta-Bold', color: colors.primary, minWidth: 30, textAlign: 'center' },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.xl, fontFamily: 'Jakarta-Bold', color: colors.text, letterSpacing: -0.3 },

  // Ingredients
  ingredientList: { backgroundColor: colors.surfaceContainerLowest, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.sm },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
    gap: spacing.sm,
  },
  ingredientRowChecked: {
    backgroundColor: colors.surfaceContainerLow,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ingredientName: { fontSize: fontSize.md, fontFamily: 'Manrope-SemiBold', color: colors.text, flex: 1 },
  ingredientNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  roleText: { fontSize: 10, fontFamily: 'Jakarta-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientQty: { fontSize: fontSize.md, fontFamily: 'Jakarta-Bold', color: colors.primary },

  // Substitution
  subBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tertiaryContainer + '40',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  subPanel: {
    backgroundColor: colors.tertiaryContainer + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  subPanelTitle: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-Bold',
    color: colors.tertiary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  subItem: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 3,
  },
  subItemName: { fontSize: fontSize.sm, fontFamily: 'Manrope-SemiBold', color: colors.text },
  subItemRatio: { fontSize: fontSize.xs, fontFamily: 'Jakarta-Bold', color: colors.tertiary, backgroundColor: colors.tertiaryContainer + '40', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  subItemNote: { fontSize: fontSize.xs, fontFamily: 'Manrope-Regular', color: colors.textMuted, fontStyle: 'italic' as const },

  // Steps (editorial big numbers)
  stepList: { gap: spacing.lg, marginBottom: spacing.md },
  stepCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '50',
  },
  stepNumberBg: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberBig: {
    fontSize: 24,
    fontFamily: 'Jakarta-ExtraBold',
    color: colors.primary,
  },
  stepContent: { flex: 1 },
  stepInstruction: { fontSize: fontSize.md, fontFamily: 'Manrope-Regular', color: colors.text, lineHeight: 22 },
  stepDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    backgroundColor: colors.tertiaryContainer + '40',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  stepDuration: { fontSize: fontSize.xs, fontFamily: 'Manrope-SemiBold', color: colors.tertiary },

  // Chef's Tip
  tipBox: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    backgroundColor: colors.secondaryContainer + '30',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  tipTitle: { fontSize: fontSize.md, fontFamily: 'Jakarta-Bold', color: colors.secondary },
  tipText: { fontSize: fontSize.md, fontFamily: 'Manrope-Regular', color: colors.text, lineHeight: 22, fontStyle: 'italic' },

  // Nutrition
  nutritionToggle: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  nutritionToggleText: { color: colors.primary, fontFamily: 'Jakarta-Bold', fontSize: fontSize.md },
  nutritionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  nutritionTitle: { fontSize: fontSize.md, fontFamily: 'Jakarta-Bold', color: colors.text, marginBottom: spacing.sm },
  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  nutritionItem: { alignItems: 'center', flex: 1, gap: 2 },
  nutritionValue: { fontSize: fontSize.lg, fontFamily: 'Jakarta-Bold', color: colors.primary },
  nutritionLabel: { fontSize: fontSize.xs, fontFamily: 'Manrope-Regular', color: colors.textMuted },
  nutritionNote: { fontSize: fontSize.xs, fontFamily: 'Manrope-Regular', color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },

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
  shopBtnText: { color: colors.onSecondary, fontFamily: 'Jakarta-Bold', fontSize: fontSize.md },

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
  planBtnText: { color: colors.textInverse, fontFamily: 'Jakarta-Bold', fontSize: fontSize.md },

  planPicker: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  planPickerEmpty: { padding: spacing.md, color: colors.textSecondary, fontFamily: 'Manrope-Regular', fontSize: fontSize.sm, textAlign: 'center' },
  planPickerItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
  planPickerName: { fontSize: fontSize.md, fontFamily: 'Jakarta-Bold', color: colors.text },
  planPickerMeta: { fontSize: fontSize.xs, fontFamily: 'Manrope-Regular', color: colors.textSecondary, marginTop: 2 },

  // Sticky Bottom CTA
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'web' ? spacing.sm : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...(isWeb ? { maxWidth: 800, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  cookBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cookBtnText: { color: colors.onPrimary, fontFamily: 'Jakarta-ExtraBold', fontSize: fontSize.lg },
});

export default withScreenErrorBoundary(RecipeDetailScreen, 'Tarif Detayı');
