import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { spacing, fontSize, borderRadius, type ThemeColors } from '../src/theme';
import { useTheme } from '../src/theme/ThemeContext';
import { hapticSelection } from '../src/utils/haptics';

interface Tag { id: string; name: string; slug: string; type: string; emoji?: string }
interface RecipeItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  totalTimeMinutes?: number;
  totalCalories?: number;
  tags?: { tag: Tag }[];
}

const DIET_OPTIONS = [
  { key: 'vejetaryen', label: 'Vejetaryen', icon: 'eco' as const, color: '#BCCBB3' },
  { key: 'glutensiz', label: 'Glutensiz', icon: 'grain' as const, color: '#E2BFB2' },
  { key: 'vegan', label: 'Vegan', icon: 'local-florist' as const, color: '#BCCBB3' },
  { key: 'saglikli', label: 'Sağlıklı', icon: 'favorite' as const, color: '#FFB59C' },
];

const TIME_BUCKETS = [
  { key: 'any', label: 'Tümü', max: undefined },
  { key: '15', label: '15 dk', max: 15 },
  { key: '30', label: '30 dk', max: 30 },
  { key: '60', label: '1 saat', max: 60 },
];

const DIFFICULTY_OPTIONS = [
  { key: 'any', label: 'Tümü' },
  { key: 'EASY', label: 'Kolay' },
  { key: 'MEDIUM', label: 'Orta' },
  { key: 'HARD', label: 'Zor' },
];

export default function SearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Tag[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeDiets, setActiveDiets] = useState<Set<string>>(new Set());
  const [timeBucket, setTimeBucket] = useState<string>('any');
  const [difficulty, setDifficulty] = useState<string>('any');
  const [results, setResults] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ items: Tag[] } | Tag[]>('/tags?type=CATEGORY')
      .then((res: any) => setCategories(res.items || res || []))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (query.trim()) params.set('search', query.trim());
      if (activeCategory) params.set('tagSlug', activeCategory);
      const bucket = TIME_BUCKETS.find((b) => b.key === timeBucket);
      if (bucket?.max) params.set('maxTotalTime', String(bucket.max));
      if (difficulty !== 'any') params.set('difficulty', difficulty);
      const res: any = await api.get(`/recipes?${params.toString()}`);
      setResults(res.items || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeCategory, timeBucket, difficulty]);

  useEffect(() => {
    const t = setTimeout(runSearch, 400);
    return () => clearTimeout(t);
  }, [runSearch]);

  const toggleDiet = (key: string) => {
    hapticSelection();
    setActiveDiets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.brandRow}>
          <MaterialIcons name="restaurant-menu" size={20} color={colors.primaryContainer} />
          <Text style={styles.brand}>CHEFMATE</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero heading */}
        <Text style={styles.heading}>Keşfet</Text>

        {/* Search box */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tarif veya malzeme ara..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Kategoriler</Text>
          {activeCategory && (
            <TouchableOpacity onPress={() => setActiveCategory(null)}>
              <Text style={styles.sectionLink}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.slug;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  hapticSelection();
                  setActiveCategory(active ? null : cat.slug);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Diet bento */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Diyet
        </Text>
        <View style={styles.bentoGrid}>
          {DIET_OPTIONS.map((diet) => {
            const active = activeDiets.has(diet.key);
            return (
              <TouchableOpacity
                key={diet.key}
                style={[
                  styles.bentoCard,
                  active && { borderLeftWidth: 4, borderLeftColor: colors.primaryContainer },
                ]}
                onPress={() => toggleDiet(diet.key)}
              >
                <View style={styles.bentoCardHeader}>
                  <MaterialIcons name={diet.icon} size={22} color={diet.color} />
                  <View style={[styles.bentoCheck, active && styles.bentoCheckActive]}>
                    {active && <MaterialIcons name="check" size={14} color="#fff" />}
                  </View>
                </View>
                <View>
                  <Text style={styles.bentoLabel}>DİYET</Text>
                  <Text style={styles.bentoTitle}>{diet.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time row */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Hazırlama Süresi
        </Text>
        <View style={styles.segmentRow}>
          {TIME_BUCKETS.map((b) => {
            const active = timeBucket === b.key;
            return (
              <TouchableOpacity
                key={b.key}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => {
                  hapticSelection();
                  setTimeBucket(b.key);
                }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Difficulty row */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Zorluk
        </Text>
        <View style={styles.segmentRow}>
          {DIFFICULTY_OPTIONS.map((d) => {
            const active = difficulty === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => {
                  hapticSelection();
                  setDifficulty(d.key);
                }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Results */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {query || activeCategory || timeBucket !== 'any' || difficulty !== 'any'
              ? 'Sana Özel Sonuçlar'
              : 'Popüler Tarifler'}
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {results.map((r) => {
            const catTag = r.tags?.find((t) => t.tag?.type === 'CATEGORY')?.tag;
            return (
              <TouchableOpacity
                key={r.id}
                style={styles.recipeCard}
                onPress={() => router.push(`/recipe/${r.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.recipeImgWrap}>
                  {r.imageUrl ? (
                    <Image source={{ uri: r.imageUrl }} style={styles.recipeImg} />
                  ) : (
                    <View style={[styles.recipeImg, styles.recipeImgFallback]}>
                      <Text style={{ fontSize: 32 }}>{catTag?.emoji || '🍽️'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.recipeBody}>
                  {catTag && (
                    <Text style={styles.recipeCategory}>{catTag.name.toUpperCase()}</Text>
                  )}
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {r.title}
                  </Text>
                  {r.description && (
                    <Text style={styles.recipeDesc} numberOfLines={1}>
                      {r.description}
                    </Text>
                  )}
                  <View style={styles.recipeMeta}>
                    {r.totalTimeMinutes ? (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="schedule" size={13} color={colors.primary} />
                        <Text style={[styles.metaText, { color: colors.primary }]}>
                          {r.totalTimeMinutes} DK
                        </Text>
                      </View>
                    ) : null}
                    {r.totalCalories ? (
                      <View style={styles.metaItem}>
                        <MaterialIcons
                          name="local-fire-department"
                          size={13}
                          color={colors.secondary}
                        />
                        <Text style={[styles.metaText, { color: colors.secondary }]}>
                          {r.totalCalories} KCAL
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {!loading && results.length === 0 && (
            <View style={styles.empty}>
              <MaterialIcons name="search-off" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLow,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: {
    fontFamily: 'Jakarta-ExtraBold',
    fontSize: fontSize.lg,
    color: colors.primaryContainer,
    letterSpacing: -0.5,
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  heading: {
    fontSize: 36,
    fontFamily: 'Jakarta-ExtraBold',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 52,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: 'Manrope-Medium',
    fontSize: fontSize.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
  },
  sectionLink: {
    fontSize: fontSize.sm,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.primary,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSize.sm,
    color: colors.text,
  },
  chipTextActive: { color: colors.onPrimary, fontFamily: 'Jakarta-Bold' },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bentoCard: {
    width: '47.5%',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    height: 128,
    justifyContent: 'space-between',
  },
  bentoCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  bentoCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoCheckActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: 'Jakarta-ExtraBold',
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  bentoTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  segmentBtnActive: { backgroundColor: colors.surfaceContainerHighest },
  segmentText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  segmentTextActive: { color: colors.primary, fontFamily: 'Jakarta-Bold' },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  },
  resultsTitle: {
    fontSize: fontSize.xl,
    fontFamily: 'Jakarta-ExtraBold',
    color: colors.text,
    letterSpacing: -0.5,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    minHeight: 128,
  },
  recipeImgWrap: { width: '33%' },
  recipeImg: { width: '100%', height: '100%' },
  recipeImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  recipeBody: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  recipeCategory: {
    fontSize: 10,
    fontFamily: 'Jakarta-ExtraBold',
    color: colors.tertiary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recipeTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  recipeDesc: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textMuted,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, fontFamily: 'Jakarta-ExtraBold', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
