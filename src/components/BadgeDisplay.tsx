import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { api } from '../api/client';
import { spacing, fontSize, borderRadius, type ThemeColors } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  threshold: number;
  earnedAt?: string;
}

const categoryLabel: Record<string, string> = {
  cooking: 'Pişirme',
  exploration: 'Keşif',
  health: 'Sağlık',
  speed: 'Hız',
  social: 'Sosyal',
};

const getCategoryColor = (colors: ThemeColors, cat: string): string => {
  const map: Record<string, string> = {
    cooking: colors.primary,
    exploration: '#6C63FF',
    health: colors.secondary,
    speed: '#F5A623',
    social: '#FF6B9D',
  };
  return map[cat] || colors.primary;
};

export default function BadgeDisplay() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Badge[]>('/badges').catch(() => []),
      api.get<Badge[]>('/badges/me').catch(() => []),
    ]).then(([all, earned]) => {
      setAllBadges(Array.isArray(all) ? all : []);
      setEarnedBadges(Array.isArray(earned) ? earned : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (allBadges.length === 0) return null;

  const earnedSlugs = new Set(earnedBadges.map((b) => b.slug));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rozetler</Text>
        <Text style={styles.subtitle}>
          {earnedBadges.length}/{allBadges.length} kazanıldı
        </Text>
      </View>

      <FlatList
        data={allBadges}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => {
          const earned = earnedSlugs.has(item.slug);
          const isSelected = selectedBadge?.slug === item.slug;
          return (
            <TouchableOpacity
              style={[
                styles.badgeCard,
                earned && styles.badgeCardEarned,
                isSelected && styles.badgeCardSelected,
              ]}
              onPress={() => setSelectedBadge(isSelected ? null : item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                {item.emoji}
              </Text>
              <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={1}>
                {item.name}
              </Text>
              {earned && <View style={[styles.earnedDot, { backgroundColor: getCategoryColor(colors, item.category) }]} />}
              {!earned && <Text style={styles.lockedIcon}>🔒</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {selectedBadge && (
        <View style={styles.detailCard}>
          <Text style={styles.detailEmoji}>{selectedBadge.emoji}</Text>
          <View style={styles.detailInfo}>
            <Text style={styles.detailName}>{selectedBadge.name}</Text>
            <Text style={styles.detailDesc}>{selectedBadge.description}</Text>
            <View style={styles.detailMeta}>
              <View style={[styles.categoryPill, { backgroundColor: (getCategoryColor(colors, selectedBadge.category)) + '20' }]}>
                <Text style={[styles.categoryText, { color: getCategoryColor(colors, selectedBadge.category) }]}>
                  {categoryLabel[selectedBadge.category] || selectedBadge.category}
                </Text>
              </View>
              {earnedSlugs.has(selectedBadge.slug) && (
                <Text style={styles.earnedText}>Kazanıldı ✓</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { marginTop: spacing.md },
  loadingContainer: { padding: spacing.lg, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontFamily: 'Jakarta-Bold', color: colors.text },
  subtitle: { fontSize: fontSize.sm, fontFamily: 'Manrope-SemiBold', color: colors.textMuted },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  badgeCard: {
    width: 80,
    height: 96,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badgeCardEarned: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.primaryContainer,
  },
  badgeCardSelected: {
    borderColor: colors.primary,
  },
  badgeEmoji: { fontSize: 28 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeName: {
    fontSize: 10,
    fontFamily: 'Jakarta-Bold',
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  badgeNameLocked: { color: colors.textMuted },
  earnedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  lockedIcon: { fontSize: 10, marginTop: 2 },
  detailCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  detailEmoji: { fontSize: 40 },
  detailInfo: { flex: 1 },
  detailName: { fontSize: fontSize.lg, fontFamily: 'Jakarta-Bold', color: colors.text },
  detailDesc: { fontSize: fontSize.sm, fontFamily: 'Manrope-Regular', color: colors.textSecondary, marginTop: 2 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: { fontSize: 10, fontFamily: 'Jakarta-Bold', textTransform: 'uppercase' },
  earnedText: { fontSize: fontSize.xs, fontFamily: 'Jakarta-Bold', color: colors.secondary },
});
