import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { useTheme } from '../../src/theme/ThemeContext';
import { fonts, fontSize, spacing, borderRadius } from '../../src/theme';
import { PressableScale } from '../../src/components/PressableScale';
import { hapticSelection } from '../../src/utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 24;

interface Recipe {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  difficulty?: string;
  totalTimeMinutes?: number;
  servingSize?: number;
  tags?: any[];
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  type: string;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Kolay',
  MEDIUM: 'Orta Seviye',
  HARD: 'Zor',
};

function HomeScreen() {
  const { colors: c } = useTheme();
  const { user } = useAuthStore();

  const [trending, setTrending] = useState<Recipe[]>([]);
  const [seasonal, setSeasonal] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Tag[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const toArr = (res: any): any[] =>
        Array.isArray(res) ? res : res?.items || res?.data || [];
      const [trendRes, seasonRes, catRes] = await Promise.all([
        api.get<any>('/recipes/trending?limit=6').catch(() => []),
        api.get<any>('/recipes/seasonal?limit=10').catch(() => []),
        api.get<any>('/tags?type=CATEGORY').catch(() => []),
      ]);
      setTrending(toArr(trendRes));
      setSeasonal(toArr(seasonRes));
      setCategories(toArr(catRes).slice(0, 8));
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const goToRecipe = (id: string) => {
    hapticSelection();
    router.push(`/recipe/${id}`);
  };

  const hero = trending[0];
  const bentoSmalls = trending.slice(1, 3);
  const newItems = seasonal.slice(0, 4);

  const styles = makeStyles(c);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ===== Top App Bar (fixed) ===== */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.brandRow}>
            <MaterialIcons name="restaurant-menu" size={22} color={c.primaryContainer} />
            <Text style={[styles.brandText, { color: c.primaryContainer }]}>CHEFMATE</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={() => router.push('/search' as any)}>
              <MaterialIcons name="search" size={24} color={c.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/notifications')}>
              <MaterialIcons name="notifications-none" size={24} color={c.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        {/* ===== Hero Card ===== */}
        {hero && (
          <PressableScale style={styles.heroCard} onPress={() => goToRecipe(hero.id)}>
            {hero.imageUrl && (
              <Image source={{ uri: hero.imageUrl }} style={styles.heroImage} resizeMode="cover" />
            )}
            <LinearGradient
              colors={['transparent', 'transparent', c.background]}
              style={StyleSheet.absoluteFill}
            />

            {/* Şefin Notu — glass effect */}
            <View style={styles.chefNote}>
              <Text style={[styles.chefNoteLabel, { color: c.primary }]}>ŞEFİN NOTU</Text>
              <Text style={[styles.chefNoteText, { color: c.text }]} numberOfLines={2}>
                {hero.description?.slice(0, 60) || 'Şef ipucu için tarifi aç.'}
              </Text>
            </View>

            {/* Bottom content */}
            <View style={styles.heroContent}>
              <View style={[styles.heroBadge, { backgroundColor: c.primaryContainer }]}>
                <Text style={[styles.heroBadgeText, { color: c.onPrimaryContainer }]}>
                  GÜNÜN SEÇİMİ
                </Text>
              </View>
              <Text style={[styles.heroTitle, { color: c.text }]}>Bugün bunu pişir</Text>
              <Text style={[styles.heroSubtitle, { color: c.textSecondary }]} numberOfLines={1}>
                {hero.title}
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaItem}>
                  <MaterialIcons name="schedule" size={14} color={c.primary} />
                  <Text style={[styles.heroMetaText, { color: c.primary }]}>
                    {hero.totalTimeMinutes || 45} Dakika
                  </Text>
                </View>
                <View style={styles.heroMetaItem}>
                  <MaterialIcons name="restaurant" size={14} color={c.primary} />
                  <Text style={[styles.heroMetaText, { color: c.primary }]}>
                    {DIFFICULTY_LABEL[hero.difficulty || 'MEDIUM']}
                  </Text>
                </View>
              </View>
            </View>
          </PressableScale>
        )}

        {/* ===== Category Pills ===== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          <CategoryPill
            label="TÜMÜ"
            active={activeCategory === 'all'}
            onPress={() => {
              hapticSelection();
              setActiveCategory('all');
            }}
            c={c}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name.toUpperCase()}
              active={activeCategory === cat.slug}
              onPress={() => {
                hapticSelection();
                setActiveCategory(cat.slug);
                router.push(`/etiket/${cat.slug}`);
              }}
              c={c}
            />
          ))}
        </ScrollView>

        {/* ===== Önerilen (Asymmetric Bento) ===== */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Önerilen</Text>
              <TouchableOpacity onPress={() => router.push('/tarif')}>
                <Text style={[styles.sectionLink, { color: c.primary }]}>TÜMÜNÜ GÖR</Text>
              </TouchableOpacity>
            </View>

            {/* Featured wide card */}
            {trending[0] && (
              <PressableScale
                style={[styles.bentoFeatured, { backgroundColor: c.surfaceContainerLow }]}
                onPress={() => goToRecipe(trending[0].id)}
              >
                {trending[0].imageUrl && (
                  <Image
                    source={{ uri: trending[0].imageUrl }}
                    style={styles.bentoFeaturedImage}
                    resizeMode="cover"
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(19,19,19,0.85)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bentoFeaturedContent}>
                  <Text style={[styles.bentoFeaturedTitle, { color: c.text }]} numberOfLines={1}>
                    {trending[0].title}
                  </Text>
                  <Text style={[styles.bentoFeaturedMeta, { color: c.textSecondary }]}>
                    {trending[0].totalTimeMinutes || 30} dk •{' '}
                    {DIFFICULTY_LABEL[trending[0].difficulty || 'MEDIUM']}
                  </Text>
                </View>
                <View style={[styles.bentoArrow, { backgroundColor: c.primaryContainer }]}>
                  <MaterialIcons name="arrow-forward" size={18} color={c.onPrimaryContainer} />
                </View>
              </PressableScale>
            )}

            {/* Two small cards */}
            {bentoSmalls.length > 0 && (
              <View style={styles.bentoRow}>
                {bentoSmalls.map((r) => (
                  <PressableScale
                    key={r.id}
                    style={[styles.bentoSmall, { backgroundColor: c.surfaceContainerLow }]}
                    onPress={() => goToRecipe(r.id)}
                  >
                    {r.imageUrl && (
                      <Image
                        source={{ uri: r.imageUrl }}
                        style={styles.bentoSmallImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.bentoSmallContent}>
                      <Text
                        style={[styles.bentoSmallTitle, { color: c.text }]}
                        numberOfLines={2}
                      >
                        {r.title}
                      </Text>
                      <View style={styles.bentoSmallMeta}>
                        <MaterialIcons name="timer" size={12} color={c.textMuted} />
                        <Text style={[styles.bentoSmallMetaText, { color: c.textMuted }]}>
                          {r.totalTimeMinutes || 20} dk
                        </Text>
                      </View>
                    </View>
                  </PressableScale>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ===== Yeni (Vertical Rail) ===== */}
        {newItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Yeni</Text>
            </View>
            <View style={{ gap: 24 }}>
              {newItems.map((r) => (
                <PressableScale
                  key={r.id}
                  style={styles.railItem}
                  onPress={() => goToRecipe(r.id)}
                >
                  <View style={[styles.railThumb, { backgroundColor: c.surfaceContainerLow }]}>
                    {r.imageUrl && (
                      <Image
                        source={{ uri: r.imageUrl }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                  <View style={styles.railContent}>
                    <View
                      style={[styles.railChip, { borderColor: c.primary + '55' }]}
                    >
                      <Text style={[styles.railChipText, { color: c.primary }]}>
                        {r.difficulty === 'EASY' ? 'HIZLI' : 'YENİ'}
                      </Text>
                    </View>
                    <Text style={[styles.railTitle, { color: c.text }]} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text
                      style={[styles.railDesc, { color: c.textSecondary }]}
                      numberOfLines={2}
                    >
                      {r.description || 'Yeni bir tarif keşfet.'}
                    </Text>
                    <View style={styles.railMetaRow}>
                      <MaterialIcons name="restaurant" size={14} color={c.text} />
                      <Text style={[styles.railMetaText, { color: c.text }]}>
                        {r.servingSize || 2} Kişilik
                      </Text>
                    </View>
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function CategoryPill({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        stylesPill.pill,
        {
          backgroundColor: active ? c.primary : c.surfaceContainerHigh,
        },
      ]}
    >
      <Text
        style={[
          stylesPill.pillText,
          { color: active ? c.onPrimary : c.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const stylesPill = StyleSheet.create({
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginRight: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: fonts.bodySemiBold,
  },
});

function makeStyles(c: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Header
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      paddingTop: Platform.OS === 'ios' ? 50 : 30,
      backgroundColor: 'rgba(14,14,14,0.7)',
    },
    headerInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: H_PAD,
      paddingBottom: 16,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandText: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -1,
      fontFamily: fonts.headingExtraBold,
    },

    scrollContent: {
      paddingTop: Platform.OS === 'ios' ? 110 : 90,
      paddingBottom: 130,
    },

    // Hero
    heroCard: {
      marginHorizontal: H_PAD,
      aspectRatio: 4 / 5,
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: c.surfaceContainerLow,
      marginBottom: 40,
      justifyContent: 'flex-end',
    },
    heroImage: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.7,
    },
    heroContent: {
      padding: 28,
      zIndex: 2,
    },
    heroBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 5,
      borderRadius: 999,
      marginBottom: 16,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      fontFamily: fonts.bodySemiBold,
    },
    heroTitle: {
      fontSize: 36,
      fontWeight: '900',
      lineHeight: 38,
      letterSpacing: -1.5,
      marginBottom: 6,
      fontFamily: fonts.headingExtraBold,
    },
    heroSubtitle: {
      fontSize: 18,
      fontWeight: '500',
      marginBottom: 18,
      fontFamily: fonts.bodyMedium,
    },
    heroMetaRow: {
      flexDirection: 'row',
      gap: 16,
    },
    heroMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    heroMetaText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: fonts.bodySemiBold,
    },
    chefNote: {
      position: 'absolute',
      top: 22,
      left: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      maxWidth: 200,
      zIndex: 3,
    },
    chefNoteLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginBottom: 2,
      fontFamily: fonts.bodySemiBold,
    },
    chefNoteText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: fonts.bodyRegular,
    },

    // Pills
    pillsScroll: {
      marginBottom: 40,
    },
    pillsRow: {
      paddingHorizontal: H_PAD,
    },

    // Sections
    section: {
      marginBottom: 48,
    },
    sectionHeader: {
      paddingHorizontal: H_PAD,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -1,
      fontFamily: fonts.headingExtraBold,
    },
    sectionLink: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      fontFamily: fonts.bodySemiBold,
    },

    // Bento
    bentoFeatured: {
      marginHorizontal: H_PAD,
      aspectRatio: 16 / 9,
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
      justifyContent: 'flex-end',
    },
    bentoFeaturedImage: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.9,
    },
    bentoFeaturedContent: {
      padding: 20,
      zIndex: 2,
    },
    bentoFeaturedTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 4,
      fontFamily: fonts.headingBold,
    },
    bentoFeaturedMeta: {
      fontSize: 12,
      fontFamily: fonts.bodyMedium,
    },
    bentoArrow: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },
    bentoRow: {
      flexDirection: 'row',
      gap: 16,
      paddingHorizontal: H_PAD,
    },
    bentoSmall: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 24,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    bentoSmallImage: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    bentoSmallContent: {
      padding: 14,
      zIndex: 2,
      backgroundColor: 'rgba(14,14,14,0.65)',
    },
    bentoSmallTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
      fontFamily: fonts.headingBold,
    },
    bentoSmallMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    bentoSmallMetaText: {
      fontSize: 10,
      fontFamily: fonts.bodyMedium,
    },

    // Rail
    railItem: {
      flexDirection: 'row',
      paddingHorizontal: H_PAD,
      alignItems: 'center',
      gap: 20,
    },
    railThumb: {
      width: 110,
      height: 110,
      borderRadius: 20,
      overflow: 'hidden',
    },
    railContent: {
      flex: 1,
    },
    railChip: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      marginBottom: 6,
    },
    railChipText: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      fontFamily: fonts.bodySemiBold,
    },
    railTitle: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 4,
      fontFamily: fonts.headingBold,
    },
    railDesc: {
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 10,
      fontFamily: fonts.bodyRegular,
    },
    railMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    railMetaText: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: fonts.bodySemiBold,
    },
  });
}

export default withScreenErrorBoundary(HomeScreen, 'Keşfet');
