import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../theme';

// Shimmer animation skeleton component
function SkeletonBlock({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { backgroundColor: colors.surfaceContainerHigh, borderRadius: borderRadius.sm, opacity },
        style,
      ]}
    />
  );
}

// Recipe card skeleton
export function RecipeCardSkeleton() {
  return (
    <View style={s.card}>
      <SkeletonBlock style={s.cardImage} />
      <View style={s.cardBody}>
        <SkeletonBlock style={s.cardTitle} />
        <SkeletonBlock style={s.cardTitleShort} />
        <View style={s.cardMeta}>
          <SkeletonBlock style={s.cardMetaItem} />
          <SkeletonBlock style={s.cardMetaItem} />
          <SkeletonBlock style={s.cardMetaItem} />
        </View>
      </View>
    </View>
  );
}

// Circular category skeleton
export function CategorySkeleton() {
  return (
    <View style={s.catRow}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={s.catItem}>
          <SkeletonBlock style={s.catCircle} />
          <SkeletonBlock style={s.catLabel} />
        </View>
      ))}
    </View>
  );
}

// Cuisine chip skeleton
export function CuisineChipSkeleton() {
  return (
    <View style={s.chipRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBlock key={i} style={s.chip} />
      ))}
    </View>
  );
}

// Section title skeleton
function SectionTitleSkeleton() {
  return <SkeletonBlock style={s.sectionTitle} />;
}

// Horizontal card row skeleton
function HorizontalCardsSkeleton() {
  return (
    <View style={s.hRow}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={s.hCard}>
          <SkeletonBlock style={s.hCardImage} />
          <SkeletonBlock style={s.hCardTitle} />
          <SkeletonBlock style={s.hCardMeta} />
        </View>
      ))}
    </View>
  );
}

// Full home page skeleton
export function HomePageSkeleton() {
  return (
    <View style={s.container}>
      {/* Header skeleton */}
      <View style={s.header}>
        <SkeletonBlock style={s.headerLogo} />
        <SkeletonBlock style={s.headerGreeting} />
      </View>

      {/* Search bar */}
      <SkeletonBlock style={s.searchBar} />

      {/* Category circles */}
      <CategorySkeleton />

      {/* Cuisine chips */}
      <CuisineChipSkeleton />

      {/* Section: Picks for you */}
      <View style={s.section}>
        <SectionTitleSkeleton />
        <HorizontalCardsSkeleton />
      </View>

      {/* Section: Trending */}
      <View style={s.section}>
        <SectionTitleSkeleton />
        <View style={s.bentoRow}>
          <View style={s.bentoLarge}>
            <SkeletonBlock style={s.bentoLargeImg} />
          </View>
          <View style={s.bentoSmallCol}>
            <SkeletonBlock style={s.bentoSmallImg} />
            <SkeletonBlock style={s.bentoSmallImg} />
          </View>
        </View>
      </View>

      {/* Grid skeleton */}
      <View style={s.section}>
        <SectionTitleSkeleton />
        <View style={s.gridRow}>
          <RecipeCardSkeleton />
          <RecipeCardSkeleton />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 100,
  },

  // Header
  header: {
    backgroundColor: colors.primary,
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
  },
  headerLogo: {
    width: 140,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerGreeting: {
    width: 240,
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 6,
  },

  // Search
  searchBar: {
    height: 44,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
  },

  // Categories
  catRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  catItem: {
    alignItems: 'center',
    width: 60,
  },
  catCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  catLabel: {
    width: 48,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    width: 80,
    height: 34,
    borderRadius: borderRadius.full,
  },

  // Sections
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    width: 180,
    height: 22,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },

  // Horizontal cards
  hRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  hCard: {
    width: 170,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  hCardImage: {
    width: 170,
    height: 120,
    borderRadius: borderRadius.md,
  },
  hCardTitle: {
    width: 130,
    height: 14,
    borderRadius: 7,
    marginTop: 8,
  },
  hCardMeta: {
    width: 80,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },

  // Bento
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bentoLarge: {
    flex: 1.2,
  },
  bentoLargeImg: {
    height: 200,
    borderRadius: borderRadius.lg,
  },
  bentoSmallCol: {
    flex: 1,
    gap: spacing.md,
  },
  bentoSmallImg: {
    height: 92,
    borderRadius: borderRadius.lg,
  },

  // Grid
  gridRow: {
    gap: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  cardImage: {
    width: '100%' as any,
    height: 180,
  },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    width: '80%' as any,
    height: 16,
    borderRadius: 8,
  },
  cardTitleShort: {
    width: '50%' as any,
    height: 14,
    borderRadius: 7,
    marginTop: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 8,
  },
  cardMetaItem: {
    width: 50,
    height: 12,
    borderRadius: 6,
  },
});
