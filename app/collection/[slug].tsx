import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useFavoritesStore } from '../../src/stores/favorites';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';

const isWeb = Platform.OS === 'web';

const difficultyLabel: Record<string, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor' };
const getDifficultyColor = (colors: ThemeColors, diff: string): string => {
  const map: Record<string, string> = { EASY: colors.easy, MEDIUM: colors.medium, HARD: colors.hard };
  return map[diff] || colors.textMuted;
};

function getCuisineTag(recipe: any) {
  return (recipe.tags || []).map((rt: any) => rt.tag || rt).find((t: any) => t.type === 'CUISINE');
}
function getCategoryTag(recipe: any) {
  return (recipe.tags || []).map((rt: any) => rt.tag || rt).find((t: any) => t.type === 'CATEGORY');
}

export default function CollectionDetailScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isFavorite, toggle: toggleFav, loaded: favsLoaded, fetch: fetchFavs } = useFavoritesStore();

  useEffect(() => {
    if (!favsLoaded) fetchFavs();
    api.get<any>(`/collections/${slug}`)
      .then((res) => setCollection(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={s.center}>
        <MaterialIcons name="collections-bookmark" size={48} color={colors.outlineVariant} />
        <Text style={s.emptyTitle}>Koleksiyon bulunamadı</Text>
      </View>
    );
  }

  const recipes = (collection.recipes || []).map((cr: any) => cr.recipe).filter(Boolean);

  const renderHeader = () => (
    <View>
      {/* Hero */}
      <View style={s.hero}>
        {collection.imageUrl ? (
          <Image source={{ uri: collection.imageUrl }} style={s.heroImage} resizeMode="cover" />
        ) : (
          <View style={s.heroFallback}>
            <MaterialIcons name="collections-bookmark" size={48} color={colors.textMuted} />
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.heroGradient} />
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.heroContent}>
          <Text style={s.heroTitle}>{collection.name}</Text>
          <Text style={s.heroSub}>{recipes.length} tarif</Text>
        </View>
      </View>

      {/* Description */}
      {collection.description && (
        <Text style={s.desc}>{collection.description}</Text>
      )}
    </View>
  );

  const renderRecipe = ({ item }: { item: any }) => {
    const cuisine = getCuisineTag(item);
    const category = getCategoryTag(item);
    const isFav = isFavorite(item.id);

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/recipe/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={s.cardImgWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={s.cardImg} resizeMode="cover" />
          ) : (
            <View style={s.cardImgFallback}>
              <Text style={{ fontSize: 32 }}>{category?.emoji || '🍽️'}</Text>
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={s.cardGradient} />
          {category && (
            <View style={s.catBadge}>
              <Text style={s.catBadgeText}>{category.emoji} {category.name}</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.favBtn}
            onPress={(e) => { e.stopPropagation?.(); toggleFav(item.id); }}
            hitSlop={8}
          >
            <MaterialIcons name={isFav ? 'favorite' : 'favorite-border'} size={18} color={isFav ? '#FF4B6E' : '#fff'} />
          </TouchableOpacity>
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={s.cardMeta}>
            {item.ratingAvg > 0 && (
              <Text style={s.rating}>★ {Number(item.ratingAvg).toFixed(1)}</Text>
            )}
            <Text style={s.metaDot}>·</Text>
            <Text style={s.meta}>{item.totalTimeMinutes || 0}dk</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={[s.meta, { color: getDifficultyColor(colors, item.difficulty) }]}>
              {difficultyLabel[item.difficulty] || item.difficulty}
            </Text>
          </View>
          {cuisine && (
            <Text style={s.cuisineLabel}>{cuisine.emoji} {cuisine.name}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={recipes}
      keyExtractor={(item) => item.id}
      renderItem={renderRecipe}
      ListHeaderComponent={renderHeader}
      numColumns={isWeb ? 2 : 1}
      key={isWeb ? 'web' : 'mobile'}
      contentContainerStyle={s.list}
      ListEmptyComponent={
        <View style={s.empty}>
          <MaterialIcons name="restaurant-menu" size={48} color={colors.outlineVariant} />
          <Text style={s.emptyTitle}>Bu koleksiyonda henüz tarif yok</Text>
        </View>
      }
    />
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  list: {
    backgroundColor: colors.background,
    paddingBottom: 100,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },

  // Hero
  hero: {
    width: '100%' as any,
    height: isWeb ? 300 : 220,
    position: 'relative',
    backgroundColor: colors.surfaceContainerHigh,
  },
  heroImage: { width: '100%' as any, height: '100%' as any },
  heroFallback: { width: '100%' as any, height: '100%' as any, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceContainerLow },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' as any },
  backBtn: {
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
  heroContent: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  heroTitle: { fontSize: fontSize.xxl, fontFamily: fonts.headingExtraBold, color: '#fff', letterSpacing: -0.5 },
  heroSub: { fontSize: fontSize.sm, fontFamily: fonts.bodySemiBold, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  desc: {
    fontSize: fontSize.md,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  // Card
  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    margin: spacing.xs,
    marginHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    ...(isWeb ? { maxWidth: '48%' as any } : {}),
  },
  cardImgWrap: { width: '100%' as any, height: 160, position: 'relative', backgroundColor: colors.surfaceContainerHigh },
  cardImg: { width: '100%' as any, height: '100%' as any },
  cardImgFallback: { width: '100%' as any, height: '100%' as any, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceContainerLow },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  catBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(230,107,61,0.9)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  catBadgeText: { fontSize: fontSize.xs, fontFamily: fonts.headingSemiBold, color: '#fff' },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text, letterSpacing: -0.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  rating: { fontSize: fontSize.xs, fontFamily: fonts.headingSemiBold, color: '#F5A623' },
  metaDot: { fontSize: fontSize.xs, color: colors.textMuted, marginHorizontal: 2 },
  meta: { fontSize: fontSize.xs, fontFamily: fonts.bodyMedium, color: colors.textMuted },
  cuisineLabel: { fontSize: fontSize.xs, fontFamily: fonts.bodySemiBold, color: colors.primary, marginTop: 2 },

  // Empty
  empty: { justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontFamily: fonts.headingBold, color: colors.text, marginTop: spacing.md },
});
