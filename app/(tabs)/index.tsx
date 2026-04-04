import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Recommendation } from '../../src/types';

const difficultyLabel: Record<string, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor', easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const difficultyColor: Record<string, string> = { EASY: colors.easy, MEDIUM: colors.medium, HARD: colors.hard, easy: colors.easy, medium: colors.medium, hard: colors.hard };

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecommendations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
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
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
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
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
            {isSeasonal && (
              <View style={styles.seasonBadge}>
                <Text style={styles.seasonText}>🌿 Mevsiminde</Text>
              </View>
            )}
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: scorePercent >= 70 ? colors.success : scorePercent >= 40 ? colors.warning : colors.error }]}>
            <Text style={styles.scoreText}>%{scorePercent}</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Süre</Text>
            <Text style={styles.metaValue}>{recipe.totalTimeMinutes || 0} dk</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Zorluk</Text>
            <Text style={[styles.metaValue, { color: difficultyColor[recipe.difficulty] || colors.text }]}>
              {difficultyLabel[recipe.difficulty] || recipe.difficulty}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Malzeme</Text>
            <Text style={styles.metaValue}>{matchedIngredients}/{totalIngredients}</Text>
          </View>
          {(recipe as any).totalCalories ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Kalori</Text>
              <Text style={styles.metaValue}>{Math.round((recipe as any).totalCalories / (recipe.servingSize || 1))} kcal</Text>
            </View>
          ) : null}
        </View>

        {missingIngredients.length > 0 && (
          <View style={styles.missingRow}>
            <Text style={styles.missingLabel}>Eksik: </Text>
            <Text style={styles.missingText} numberOfLines={1}>
              {missingIngredients.map((m) => m.ingredientName).join(', ')}
            </Text>
          </View>
        )}

        {substitutionHints && substitutionHints.length > 0 && (
          <View style={styles.subRow}>
            <Text style={styles.subText} numberOfLines={1}>
              💡 Yerine kullanılabilir: {(substitutionHints as any[]).map((h) => h.missingIngredient || h).join(', ')}
            </Text>
          </View>
        )}

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Tarifler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recommendations}
      keyExtractor={(item) => item.recipe.id}
      renderItem={renderRecipe}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, textAlign: 'center' }}>🍳</Text>
          <Text style={styles.emptyTitle}>Henüz tarif önerisi yok</Text>
          <Text style={styles.emptyText}>Mutfak stoğuna malzeme ekleyerek başla!</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/inventory')}>
            <Text style={styles.emptyButtonText}>Stok Ekle</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.sm },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.sm },
  scoreBadge: { borderRadius: borderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: '800' },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  cardMeta: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  metaItem: {},
  metaLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  metaValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  seasonBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  seasonText: { fontSize: fontSize.xs, color: colors.secondary, fontWeight: '600' },
  missingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  missingLabel: { fontSize: fontSize.xs, color: colors.error, fontWeight: '600' },
  missingText: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1 },
  subRow: { marginBottom: spacing.xs },
  subText: { fontSize: fontSize.xs, color: colors.info, fontWeight: '500' },
  tagRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.borderLight, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: fontSize.xs, color: colors.textSecondary },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  emptyButton: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  emptyButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
});
