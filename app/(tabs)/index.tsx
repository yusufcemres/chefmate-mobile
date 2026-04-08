import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
  ScrollView,
  Image,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { useFavoritesStore } from '../../src/stores/favorites';
import { colors, spacing, fontSize, borderRadius, fonts } from '../../src/theme';
import { HomePageSkeleton } from '../../src/components/Skeleton';
import { PressableScale } from '../../src/components/PressableScale';
import { EmptyState } from '../../src/components/EmptyState';
import { WebFooter } from '../../src/components/WebFooter';
import { hapticSelection } from '../../src/utils/haptics';
import type { Recommendation, TagWithCount } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const difficultyLabel: Record<string, string> = { EASY: 'Kolay', MEDIUM: 'Orta', HARD: 'Zor' };
const difficultyColor: Record<string, string> = { EASY: colors.easy, MEDIUM: colors.medium, HARD: colors.hard };

// Popular search terms (Talabat pattern)
const popularSearches = ['Köfte', 'Çorba', 'Makarna', 'Salata', 'Tatlı', 'Tavuk', 'Pilav', 'Börek'];

// Season helper
function getCurrentSeason(): { slug: string; name: string; emoji: string } {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return { slug: 'ilkbahar', name: 'İlkbahar', emoji: '🌸' };
  if (m >= 6 && m <= 8) return { slug: 'yaz', name: 'Yaz', emoji: '☀️' };
  if (m >= 9 && m <= 11) return { slug: 'sonbahar', name: 'Sonbahar', emoji: '🍂' };
  return { slug: 'kis', name: 'Kış', emoji: '❄️' };
}

// Extract tag info from recipe
function getRecipeTags(recipe: any) {
  return (recipe.tags || []).map((rt: any) => rt.tag || rt);
}
function getCuisineTag(recipe: any) {
  return getRecipeTags(recipe).find((t: any) => t.type === 'CUISINE');
}
function getCategoryTag(recipe: any) {
  return getRecipeTags(recipe).find((t: any) => t.type === 'CATEGORY');
}

// ===================== RECIPE CARD COMPONENT =====================
function RecipeCard({ item, onFavToggle, isFav, size = 'normal' }: {
  item: any; onFavToggle: (id: string) => void; isFav: boolean; size?: 'normal' | 'large' | 'small';
}) {
  const tags = getRecipeTags(item);
  const cuisine = getCuisineTag(item);
  const category = getCategoryTag(item);
  const isLarge = size === 'large';
  const imageH = isLarge ? 220 : size === 'small' ? 140 : 180;
  const isNew = item.createdAt && (Date.now() - new Date(item.createdAt).getTime()) < 7 * 24 * 3600 * 1000;

  return (
    <PressableScale
      style={[styles.recipeCard, isLarge && styles.recipeCardLarge]}
      onPress={() => router.push(`/recipe/${item.id}`)}
    >
      {/* Image area */}
      <View style={[styles.cardImageWrap, { height: imageH }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImageFallback, { height: imageH }]}>
            <Text style={styles.fallbackEmoji}>{category?.emoji || '🍽️'}</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.cardGradient}
        />
        {/* Category badge (bottom-left) */}
        {category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{category.emoji} {category.name}</Text>
          </View>
        )}
        {/* Fav heart (top-right) */}
        <TouchableOpacity
          style={styles.favBtn}
          onPress={(e) => { e.stopPropagation?.(); onFavToggle(item.id); }}
          hitSlop={8}
        >
          <MaterialIcons
            name={isFav ? 'favorite' : 'favorite-border'}
            size={18}
            color={isFav ? '#FF4B6E' : '#fff'}
          />
        </TouchableOpacity>
        {/* Top-rated badge */}
        {item.ratingAvg >= 4.5 && item.ratingCount >= 20 && (
          <View style={styles.topRatedBadge}>
            <Text style={styles.topRatedText}>Top Rated</Text>
          </View>
        )}
        {/* New badge */}
        {isNew && !item.ratingAvg && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Yeni</Text>
          </View>
        )}
      </View>

      {/* Content area */}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {/* Meta row 1: Rating + Time + Difficulty */}
        <View style={styles.cardMetaRow}>
          {item.ratingAvg > 0 && (
            <Text style={styles.ratingText}>
              ★ {Number(item.ratingAvg).toFixed(1)} ({item.ratingCount || 0})
            </Text>
          )}
          <Text style={styles.metaDot}>·</Text>
          <MaterialIcons name="schedule" size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>{item.totalTimeMinutes || 0}dk</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={[styles.metaText, { color: difficultyColor[item.difficulty] || colors.text }]}>
            {difficultyLabel[item.difficulty] || item.difficulty}
          </Text>
        </View>
        {/* Meta row 2: Calories + Cuisine */}
        <View style={styles.cardMetaRow}>
          {item.totalCalories ? (
            <>
              <MaterialIcons name="local-fire-department" size={13} color={colors.primary} />
              <Text style={styles.metaText}>{item.totalCalories} kcal</Text>
            </>
          ) : null}
          {cuisine && (
            <>
              {item.totalCalories ? <Text style={styles.metaDot}>·</Text> : null}
              <Text style={styles.cuisineText}>{cuisine.emoji} {cuisine.name}</Text>
            </>
          )}
        </View>
      </View>
    </PressableScale>
  );
}

// ===================== MAIN HOME SCREEN =====================
export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { isFavorite, toggle: toggleFav, fetch: fetchFavs, loaded: favsLoaded } = useFavoritesStore();

  // Data states
  const [categories, setCategories] = useState<TagWithCount[]>([]);
  const [cuisines, setCuisines] = useState<TagWithCount[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [seasonal, setSeasonal] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const browseCursorRef = useRef<string | null>(null);

  // URL Import state
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const isVideoUrl = (url: string): boolean => {
    return /tiktok\.com|instagram\.com\/reel|instagram\.com\/p|youtube\.com\/shorts|youtu\.be/i.test(url);
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const url = importUrl.trim();
      const endpoint = isVideoUrl(url) ? '/recipes/import-video' : '/recipes/import-url';
      const res = await api.post<any>(endpoint, { url });
      const recipe = (res as any).recipe;
      const importType = (res as any).parsed?.importType;
      setShowImport(false);
      setImportUrl('');
      const source = importType === 'video-ai' ? ' (AI ile video tarifinden)' : '';
      const msg = `"${recipe.title}" başarıyla içe aktarıldı${source}!`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('İçe Aktarıldı!', msg);
      if (recipe.id) router.push(`/recipe/${recipe.id}`);
    } catch (err: any) {
      const msg = err.message || 'İçe aktarma başarısız.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Hata', msg);
    } finally {
      setImporting(false);
    }
  };

  const season = getCurrentSeason();

  // ===== DATA FETCHING =====
  const fetchTags = async () => {
    try {
      const [catRes, cuisRes] = await Promise.all([
        api.get<any>('/tags?type=CATEGORY'),
        api.get<any>('/tags?type=CUISINE'),
      ]);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setCuisines(Array.isArray(cuisRes) ? cuisRes : []);
    } catch {}
  };

  const fetchTrending = async () => {
    try {
      const res = await api.get<any>('/recipes/trending?limit=6');
      setTrending(Array.isArray(res) ? res : []);
    } catch {}
  };

  const fetchSeasonal = async () => {
    try {
      const res = await api.get<any>('/recipes/seasonal?limit=10');
      setSeasonal(Array.isArray(res) ? res : []);
    } catch {}
  };

  const fetchCollections = async () => {
    try {
      const res = await api.get<any>('/collections?curated=true');
      setCollections(Array.isArray(res) ? res : []);
    } catch {}
  };

  const fetchRecommendations = async () => {
    if (!user) return;
    try {
      const res = await api.post<any>(`/users/${user.id}/recipe-recommendations`, { limit: 10 });
      const recs = (res as any).recommendations;
      const all = [
        ...(recs?.canMakeNow || []),
        ...(recs?.almostCanMake || []),
      ];
      setRecommendations(all.slice(0, 10));
    } catch {}
  };

  const fetchAllRecipes = async (reset = true, catFilter?: string | null, cuisFilter?: string | null) => {
    if (reset) {
      browseCursorRef.current = null;
      setHasMore(true);
    }
    const cursor = reset ? null : browseCursorRef.current;
    const cat = catFilter !== undefined ? catFilter : activeCategory;
    const cuis = cuisFilter !== undefined ? cuisFilter : activeCuisine;

    let params = 'status=PUBLISHED&limit=20';
    if (cat) params += `&tag=${encodeURIComponent(cat)}`;
    if (cuis) params += `&cuisine=${encodeURIComponent(cuis)}`;
    if (cursor) params += `&cursor=${cursor}`;

    try {
      const res = await api.get<any>(`/recipes?${params}`);
      const items = (res as any).items || res || [];
      const arr = Array.isArray(items) ? items : [];
      if (reset) setAllRecipes(arr);
      else setAllRecipes((prev) => [...prev, ...arr]);
      browseCursorRef.current = (res as any).nextCursor || null;
      if (!(res as any).hasMore) setHasMore(false);
    } catch {}
  };

  const loadMoreRecipes = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchAllRecipes(false).finally(() => setLoadingMore(false));
  };

  const initData = async () => {
    setLoading(true);
    await Promise.all([fetchTags(), fetchTrending(), fetchSeasonal(), fetchCollections(), fetchRecommendations(), fetchAllRecipes()]);
    setLoading(false);
  };

  useEffect(() => {
    initData();
    if (!favsLoaded) fetchFavs();
  }, [user]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchTags(), fetchTrending(), fetchSeasonal(), fetchCollections(), fetchRecommendations(), fetchAllRecipes()])
      .finally(() => setRefreshing(false));
  };

  // ===== SEARCH =====
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/recipes?search=${encodeURIComponent(text.trim())}&limit=30`);
        const items = (res as any).items || res || [];
        setSearchResults(Array.isArray(items) ? items : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  // ===== FILTER HANDLERS =====
  const onCategoryPress = (slug: string) => {
    hapticSelection();
    const next = activeCategory === slug ? null : slug;
    setActiveCategory(next);
    fetchAllRecipes(true, next, activeCuisine);
  };

  const onCuisinePress = (slug: string) => {
    hapticSelection();
    const next = activeCuisine === slug ? null : slug;
    setActiveCuisine(next);
    fetchAllRecipes(true, activeCategory, next);
  };

  // ===== LOADING STATE =====
  if (loading) {
    return <HomePageSkeleton />;
  }

  // ===== SEARCH RESULTS VIEW =====
  if (searchResults !== null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {renderHeader()}
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <RecipeCard item={item} onFavToggle={toggleFav} isFav={isFavorite(item.id)} />
            </View>
          )}
          numColumns={isWeb ? 2 : 1}
          key={isWeb ? 'web-search' : 'mobile-search'}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={
            searching ? null : (
              <EmptyState
                icon="search-off"
                title="Sonuç bulunamadı"
                message={`"${searchQuery}" için tarif bulunamadı. Farklı kelimeler deneyin.`}
                ctaLabel="Aramayı Temizle"
                onCta={() => handleSearch('')}
              />
            )
          }
        />
      </View>
    );
  }

  // ===== HEADER RENDERER =====
  function renderHeader() {
    return (
      <View>
        {/* Glass Header */}
        <View style={styles.glassHeader}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerLogo}>ChefMate</Text>
              <Text style={styles.headerGreeting}>
                {user?.displayName
                  ? `Merhaba ${user.displayName.split(' ')[0]}, bugün ne pişirmek istersin?`
                  : 'Bugün ne pişirmek istersin?'}
              </Text>
            </View>
          </View>
        </View>

        {/* Smart Search Bar — search + import merged */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ara veya link yapıştır..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              // Detect URL paste → open import modal
              if (text.startsWith('http://') || text.startsWith('https://')) {
                setImportUrl(text);
                setShowImport(true);
                return;
              }
              handleSearch(text);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Popular searches (Talabat pattern) */}
        {searchFocused && !searchQuery && (
          <View style={styles.popularSearches}>
            <Text style={styles.popularLabel}>Popüler Aramalar</Text>
            <View style={styles.popularChips}>
              {popularSearches.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={styles.popularChip}
                  onPress={() => handleSearch(term)}
                >
                  <Text style={styles.popularChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  // Merged recommendation stream (recommendations + trending + seasonal deduplicated)
  const mergedStream = useMemo(() => {
    const seen = new Set<string>();
    const stream: any[] = [];
    // First: recommendations (highest priority)
    for (const rec of recommendations) {
      if (!seen.has(rec.recipe.id)) { seen.add(rec.recipe.id); stream.push({ ...rec.recipe, _score: rec.finalScore }); }
    }
    // Then: trending
    for (const r of trending) {
      if (!seen.has(r.id)) { seen.add(r.id); stream.push(r); }
    }
    // Then: seasonal
    for (const r of seasonal) {
      if (!seen.has(r.id)) { seen.add(r.id); stream.push(r); }
    }
    return stream.slice(0, 12);
  }, [recommendations, trending, seasonal]);

  // Hero card: top recommendation that matches inventory
  const heroRecipe = mergedStream[0] || null;

  // ===== MAIN SCROLLABLE CONTENT =====
  const renderListHeader = () => (
    <View>
      {renderHeader()}

      {/* ===== Hero Card: "Bugün Bunu Pişir" ===== */}
      {heroRecipe && !activeCategory && (
        <TouchableOpacity
          style={styles.heroCard}
          onPress={() => router.push(`/recipe/${heroRecipe.id}`)}
          activeOpacity={0.9}
        >
          {heroRecipe.imageUrl ? (
            <Image source={{ uri: heroRecipe.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroImageFallback]}>
              <Text style={{ fontSize: 48 }}>{getCategoryTag(heroRecipe)?.emoji || '🍽️'}</Text>
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.heroGradient} />
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>Bugün bunu pişir</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{heroRecipe.title}</Text>
            <Text style={styles.heroMeta}>
              {heroRecipe.totalTimeMinutes || 0}dk · {difficultyLabel[heroRecipe.difficulty] || heroRecipe.difficulty}
              {heroRecipe._score ? ` · %${Math.round(heroRecipe._score > 1 ? heroRecipe._score : heroRecipe._score * 100)} eşleşme` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ===== Category Pills (single row) ===== */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, activeCategory === cat.slug && styles.categoryPillActive]}
              onPress={() => onCategoryPress(cat.slug)}
            >
              <Text style={styles.categoryPillEmoji}>{cat.emoji || '🍽️'}</Text>
              <Text style={[styles.categoryPillText, activeCategory === cat.slug && styles.categoryPillTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ===== Sana Özel (merged stream) ===== */}
      {!activeCategory && mergedStream.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sana Özel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {mergedStream.slice(1, 8).map((r) => (
              <View key={r.id} style={styles.horizontalCard}>
                <RecipeCard item={r} onFavToggle={toggleFav} isFav={isFavorite(r.id)} size="small" />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ===== Browse Header ===== */}
      <View style={styles.allRecipesHeader}>
        <Text style={styles.sectionTitle}>
          {activeCategory
            ? `${categories.find(c => c.slug === activeCategory)?.emoji || '🔍'} ${categories.find(c => c.slug === activeCategory)?.name || ''}`
            : 'Keşfet'
          }
        </Text>
        {activeCategory && (
          <TouchableOpacity
            onPress={() => { setActiveCategory(null); fetchAllRecipes(true, null, null); }}
            style={styles.clearFilterBtn}
          >
            <Text style={styles.clearFilterText}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <>
    {Platform.OS === 'web' && (
      <Head>
        <title>ChefMate — Tarif Keşfet, Pişir, Paylaş</title>
        <meta name="description" content="577+ tarif, 10 mutfak, AI önerileri — ChefMate ile yemek yapmak çok kolay." />
        <meta property="og:title" content="ChefMate — Tarif Keşfet, Pişir, Paylaş" />
        <meta property="og:description" content="577+ tarif, 10 mutfak, AI önerileri — ChefMate ile yemek yapmak çok kolay." />
        <meta property="og:url" content="https://chefmate-sand.vercel.app" />
      </Head>
    )}
    <FlatList
      data={allRecipes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <RecipeCard item={item} onFavToggle={toggleFav} isFav={isFavorite(item.id)} />
        </View>
      )}
      numColumns={isWeb ? 2 : 1}
      key={isWeb ? 'web-grid' : 'mobile-grid'}
      ListHeaderComponent={renderListHeader}
      contentContainerStyle={styles.mainList}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      onEndReached={loadMoreRecipes}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        <>
          {loadingMore && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
          )}
          {!hasMore && allRecipes.length > 0 && <WebFooter />}
        </>
      }
      ListEmptyComponent={
        <EmptyState
          icon="restaurant-menu"
          title="Tarif bulunamadı"
          message="Bu filtre kombinasyonunda tarif yok. Filtreleri değiştirmeyi deneyin."
          ctaLabel="Filtreleri Temizle"
          onCta={() => { setActiveCategory(null); setActiveCuisine(null); fetchAllRecipes(true, null, null); }}
        />
      }
    />

    {/* URL Import Modal */}
    <Modal visible={showImport} animationType="slide" transparent>
      <View style={styles.importOverlay}>
        <View style={styles.importContent}>
          <Text style={styles.importTitle}>Tarif İçe Aktar</Text>
          <Text style={styles.importSubtitle}>
            Yemek sitesi, TikTok, Instagram Reel veya YouTube Shorts linki yapıştır
          </Text>
          <TextInput
            style={styles.importInput}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            value={importUrl}
            onChangeText={setImportUrl}
            keyboardType="url"
            autoFocus
            autoCapitalize="none"
          />
          {importUrl.trim() && isVideoUrl(importUrl) && (
            <View style={styles.importVideoHint}>
              <MaterialIcons name="smart-display" size={16} color="#7C3AED" />
              <Text style={styles.importVideoHintText}>
                Video linki algılandı — AI ile tarif çıkarılacak
              </Text>
            </View>
          )}
          <View style={styles.importSourceRow}>
            <Text style={styles.importSourceLabel}>Desteklenen:</Text>
            <Text style={styles.importSourceChip}>🌐 Yemek siteleri</Text>
            <Text style={styles.importSourceChip}>📱 TikTok</Text>
            <Text style={styles.importSourceChip}>📷 Instagram</Text>
            <Text style={styles.importSourceChip}>▶️ YouTube</Text>
          </View>
          <View style={styles.importActions}>
            <TouchableOpacity style={styles.importCancelBtn} onPress={() => { setShowImport(false); setImportUrl(''); }}>
              <Text style={styles.importCancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importConfirmBtn, (importing || !importUrl.trim()) && { opacity: 0.5 }]}
              onPress={handleImportUrl}
              disabled={importing || !importUrl.trim()}
            >
              {importing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <Text style={styles.importConfirmText}>
                    {isVideoUrl(importUrl) ? 'AI analiz ediyor...' : 'İçe aktarılıyor...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.importConfirmText}>İçe Aktar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ===================== STYLES =====================
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSize.sm, fontFamily: 'Manrope-Regular' },

  // Glass Header
  glassHeader: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'web' ? 16 : 54,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  headerLogo: {
    fontSize: fontSize.xxl,
    fontFamily: 'Jakarta-ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  headerGreeting: {
    fontSize: fontSize.sm,
    fontFamily: 'Jakarta-SemiBold',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    paddingVertical: 0,
  },

  // Popular searches (Talabat)
  popularSearches: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  popularLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popularChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  popularChip: {
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  popularChipText: {
    fontSize: fontSize.sm,
    fontFamily: 'Manrope-Medium',
    color: colors.text,
  },

  // Hero Card
  heroCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    height: 200,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  heroImage: {
    width: '100%',
    height: 200,
    position: 'absolute',
  },
  heroImageFallback: {
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  heroLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-Bold',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontFamily: 'Jakarta-ExtraBold',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: fontSize.sm,
    fontFamily: 'Jakarta-SemiBold',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Category Pills
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillEmoji: { fontSize: 14 },
  categoryPillText: {
    fontSize: fontSize.sm,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: colors.onPrimary,
  },

  // Clear filter
  clearFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.primary + '15',
    borderRadius: 16,
  },
  clearFilterText: {
    color: colors.primary,
    fontFamily: 'Jakarta-SemiBold',
    fontSize: fontSize.xs,
  },

  // Sections
  section: {
    marginTop: spacing.lg,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  // Circular categories (Talabat pattern)
  categoryScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  categoryCircle: {
    alignItems: 'center',
    width: 72,
  },
  categoryCircleActive: {},
  categoryIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryIconWrapActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  categoryEmoji: {
    fontSize: 26,
  },
  categoryLabel: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-Medium',
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  categoryLabelActive: {
    color: colors.primary,
    fontFamily: 'Manrope-SemiBold',
  },

  // Cuisine tab bar
  cuisineScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  cuisineChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cuisineChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cuisineChipText: {
    fontSize: fontSize.sm,
    fontFamily: 'Manrope-SemiBold',
    color: colors.textSecondary,
  },
  cuisineChipTextActive: {
    color: colors.onPrimary,
  },

  // Horizontal scroll
  horizontalScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },

  // "Picks for you" cards
  pickCard: {
    width: 170,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pickImageWrap: {
    width: '100%' as any,
    height: 120,
    position: 'relative',
  },
  pickImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
  pickImageFallback: {
    width: '100%' as any,
    height: '100%' as any,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  matchBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-Bold',
  },
  pickTitle: {
    fontSize: fontSize.sm,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.text,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  pickMeta: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textMuted,
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginTop: 2,
  },

  // Bento grid
  bentoGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  bentoLarge: {
    flex: 1.2,
  },
  bentoSmallCol: {
    flex: 1,
    gap: spacing.md,
  },
  horizontalCard: {
    width: 260,
  },

  // Seasonal cards
  seasonalCard: {
    width: 260,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  seasonalImageWrap: {
    width: '100%' as any,
    height: 180,
    position: 'relative',
  },
  seasonalImage: {
    width: '100%' as any,
    height: '100%' as any,
    borderRadius: borderRadius.lg,
  },
  seasonalImageFallback: {
    width: '100%' as any,
    height: '100%' as any,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  seasonalGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  seasonalBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  seasonalBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: colors.text,
  },
  seasonalTitle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    fontSize: fontSize.lg,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },

  // Collection cards
  collectionCard: {
    width: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  collectionImageWrap: {
    width: '100%' as any,
    height: 130,
    position: 'relative',
    backgroundColor: colors.surfaceContainerHigh,
  },
  collectionImage: {
    width: '100%' as any,
    height: '100%' as any,
    borderRadius: borderRadius.lg,
  },
  collectionImageFallback: {
    width: '100%' as any,
    height: '100%' as any,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  collectionGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  collectionInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  collectionName: {
    fontSize: fontSize.md,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
    letterSpacing: -0.2,
  },
  collectionCount: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-SemiBold',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },

  // All Recipes Header
  allRecipesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },

  // Main list
  mainList: {
    backgroundColor: colors.background,
    paddingBottom: 100,
  },

  // Grid
  gridContainer: {
    padding: spacing.md,
    paddingBottom: 100,
    ...(isWeb ? { maxWidth: 960, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  gridItem: {
    flex: 1,
    padding: spacing.xs,
    ...(isWeb ? { maxWidth: '50%' as any } : {}),
  },

  // Recipe Card
  recipeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#302F2A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '50',
    marginBottom: spacing.sm,
  },
  recipeCardLarge: {},
  cardImageWrap: {
    width: '100%' as any,
    position: 'relative',
    backgroundColor: colors.surfaceContainerHigh,
  },
  cardImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
  cardImageFallback: {
    width: '100%' as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
  },
  fallbackEmoji: {
    fontSize: 42,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(230,107,61,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  categoryBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: '#fff',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRatedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  topRatedText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  newBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-Bold',
    color: '#fff',
  },

  // Card content
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  ratingText: {
    fontSize: fontSize.xs,
    fontFamily: 'Jakarta-SemiBold',
    color: '#F5A623',
  },
  metaDot: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-Medium',
    color: colors.textMuted,
  },
  cuisineText: {
    fontSize: fontSize.xs,
    fontFamily: 'Manrope-SemiBold',
    color: colors.primary,
  },

  // Empty
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontFamily: 'Manrope-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Import modal
  importOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  importContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    minHeight: 220,
  },
  importTitle: { fontSize: fontSize.xl, fontFamily: fonts.headingBold, color: colors.text },
  importSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },
  importInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  importActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  importCancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  importCancelText: { color: colors.textSecondary, fontWeight: '600' },
  importConfirmBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  importConfirmText: { color: colors.textInverse, fontWeight: '700' },
  importVideoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED' + '14',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  importVideoHintText: {
    fontSize: fontSize.xs,
    color: '#7C3AED',
    fontWeight: '600',
    flex: 1,
  },
  importSourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  importSourceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  importSourceChip: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
});
