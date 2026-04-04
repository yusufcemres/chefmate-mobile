import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Recommendation } from '../../src/types';

const difficultyLabel: Record<string, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor', easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const difficultyColor: Record<string, string> = { EASY: colors.easy, MEDIUM: colors.medium, HARD: colors.hard, easy: colors.easy, medium: colors.medium, hard: colors.hard };

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'recommendations' | 'browse'>('recommendations');

  const fetchRecommendations = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await api.post<{
        data: {
          recommendations: {
            canMakeNow: Recommendation[];
            almostCanMake: Recommendation[];
            needShopping: Recommendation[];
          };
        };
      }>(`/users/${user.id}/recipe-recommendations`, { limit: 20 });
      const recs = res.data?.recommendations;
      const all = [
        ...(recs?.canMakeNow || []),
        ...(recs?.almostCanMake || []),
        ...(recs?.needShopping || []),
      ];
      setRecommendations(all);
      if (all.length === 0) {
        setViewMode('browse');
        fetchAllRecipes();
      }
    } catch {
      setViewMode('browse');
      fetchAllRecipes();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAllRecipes = async () => {
    try {
      const res = await api.get<any>('/recipes?status=PUBLISHED&limit=50');
      const items = res.data?.items || res.data || res.items || [];
      setAllRecipes(Array.isArray(items) ? items : []);
    } catch {}
  };

  useEffect(() => { fetchRecommendations(); }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    if (viewMode === 'recommendations') fetchRecommendations();
    else fetchAllRecipes().then(() => setRefreshing(false));
  };

  const renderRecipe = ({ item }: { item: Recommendation }) => {
    const { recipe, finalScore, missingIngredients, matchedIngredients, totalIngredients, seasonBonus, substitutionHints } = item;
    const scorePercent = Math.round(finalScore * 100);
    const isSeasonal = seasonBonus > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/recipe/${recipe.id}`)}
        activeOpacity={0.7}
      >
        {/* Match Badge */}
        <View style={[styles.matchBadge, {
          backgroundColor: scorePercent >= 70 ? colors.primary : scorePercent >= 40 ? colors.tertiary : colors.error,
        }]}>
          <MaterialIcons name="star" size={12} color={colors.textInverse} />
          <Text style={styles.matchText}>%{scorePercent}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
            {isSeasonal && (
              <View style={styles.seasonBadge}>
                <MaterialIcons name="eco" size={12} color={colors.primary} />
                <Text style={styles.seasonText}>Mevsiminde</Text>
              </View>
            )}
          </View>
        </View>

        {/* Meta Row */}
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <MaterialIcons name="schedule" size={14} color={colors.primary} />
            <Text style={styles.metaValue}>{recipe.totalTimeMinutes || 0} dk</Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialIcons name="restaurant" size={14} color={colors.primary} />
            <Text style={[styles.metaValue, { color: difficultyColor[recipe.difficulty] || colors.text }]}>
              {difficultyLabel[recipe.difficulty] || recipe.difficulty}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <MaterialIcons name="checklist" size={14} color={colors.primary} />
            <Text style={styles.metaValue}>{matchedIngredients}/{totalIngredients}</Text>
          </View>
          {(recipe as any).totalCalories ? (
            <View style={styles.metaChip}>
              <MaterialIcons name="local-fire-department" size={14} color={colors.secondary} />
              <Text style={styles.metaValue}>{Math.round((recipe as any).totalCalories / (recipe.servingSize || 1))} kcal</Text>
            </View>
          ) : null}
        </View>

        {/* Missing Ingredients */}
        {missingIngredients.length > 0 && (
          <View style={styles.missingRow}>
            <Text style={styles.missingLabel}>Eksik: </Text>
            <Text style={styles.missingText} numberOfLines={1}>
              {missingIngredients.map((m) => m.ingredientName).join(', ')}
            </Text>
          </View>
        )}

        {/* Substitution Hints */}
        {substitutionHints && substitutionHints.length > 0 && (
          <View style={styles.subRow}>
            <MaterialIcons name="lightbulb" size={12} color={colors.tertiary} />
            <Text style={styles.subText} numberOfLines={1}>
              Yerine: {(substitutionHints as any[]).map((h) => h.missingIngredient || h).join(', ')}
            </Text>
          </View>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <View style={styles.tagRow}>
            {recipe.tags.slice(0, 4).map((tag) => (
              <View key={tag.id} style={styles.tag}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderBrowseItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/recipe/${item.id}`)}
      activeOpacity={0.7}
    >
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.browseDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}
      <View style={styles.cardMeta}>
        <View style={styles.metaChip}>
          <MaterialIcons name="schedule" size={14} color={colors.primary} />
          <Text style={styles.metaValue}>{item.totalTimeMinutes || 0} dk</Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialIcons name="restaurant" size={14} color={colors.primary} />
          <Text style={[styles.metaValue, { color: difficultyColor[item.difficulty] || colors.text }]}>
            {difficultyLabel[item.difficulty] || item.difficulty}
          </Text>
        </View>
        <View style={styles.metaChip}>
          <MaterialIcons name="people" size={14} color={colors.primary} />
          <Text style={styles.metaValue}>{item.servingSize} kişi</Text>
        </View>
        {item.totalCalories ? (
          <View style={styles.metaChip}>
            <MaterialIcons name="local-fire-department" size={14} color={colors.secondary} />
            <Text style={styles.metaValue}>{Math.round(item.totalCalories / (item.servingSize || 1))} kcal</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Tarifler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'recommendations' && styles.modeBtnActive]}
          onPress={() => setViewMode('recommendations')}
        >
          <MaterialIcons
            name="auto-awesome"
            size={16}
            color={viewMode === 'recommendations' ? colors.onPrimary : colors.textMuted}
          />
          <Text style={[styles.modeBtnText, viewMode === 'recommendations' && styles.modeBtnTextActive]}>
            AI Öneriler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'browse' && styles.modeBtnActive]}
          onPress={() => { setViewMode('browse'); if (allRecipes.length === 0) fetchAllRecipes(); }}
        >
          <MaterialIcons
            name="menu-book"
            size={16}
            color={viewMode === 'browse' ? colors.onPrimary : colors.textMuted}
          />
          <Text style={[styles.modeBtnText, viewMode === 'browse' && styles.modeBtnTextActive]}>
            Tüm Tarifler
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'recommendations' ? (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.recipe.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="restaurant-menu" size={64} color={colors.primaryContainer} />
              <Text style={styles.emptyTitle}>Henüz tarif önerisi yok</Text>
              <Text style={styles.emptyText}>Stoğuna malzeme ekle veya tüm tariflere göz at!</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => { setViewMode('browse'); if (allRecipes.length === 0) fetchAllRecipes(); }}>
                <MaterialIcons name="menu-book" size={18} color={colors.onPrimary} />
                <Text style={styles.emptyButtonText}>Tüm Tarifleri Gör</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={allRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderBrowseItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Tarifler yükleniyor...</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.sm },

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 0,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },
  modeBtnTextActive: { color: colors.onPrimary },

  // List
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  // Card
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: '#302F2A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  browseDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm },

  // Match Badge
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  matchText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: '800' },

  // Meta
  cardMeta: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  metaValue: { fontSize: fontSize.xs, fontWeight: '700', color: colors.text },

  // Season
  seasonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  seasonText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },

  // Missing
  missingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  missingLabel: { fontSize: fontSize.xs, color: colors.error, fontWeight: '700' },
  missingText: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1 },

  // Substitution
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  subText: { fontSize: fontSize.xs, color: colors.tertiary, fontWeight: '600', flex: 1 },

  // Tags
  tagRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tag: {
    backgroundColor: colors.primaryContainer + '40',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '700' },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyButtonText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
});
