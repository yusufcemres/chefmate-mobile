import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { useShoppingStore } from '../../src/stores/shopping';
import { useMealPlanStore } from '../../src/stores/meal-plans';
import { useTheme } from '../../src/theme/ThemeContext';
import { fonts } from '../../src/theme';
import { PressableScale } from '../../src/components/PressableScale';
import { hapticSelection } from '../../src/utils/haptics';

const H_PAD = 24;
type Segment = 'stock' | 'plan' | 'list';

function KitchenScreen() {
  const { colors: c } = useTheme();
  const { user } = useAuthStore();
  const { items: inventory, fetchItems, loading } = useInventoryStore();
  const { lists, fetchLists } = useShoppingStore();
  const { plans, fetchPlans } = useMealPlanStore();

  const [segment, setSegment] = useState<Segment>('stock');
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      fetchItems(user.id),
      fetchLists().catch(() => {}),
      fetchPlans().catch(() => {}),
    ]);
  }, [user?.id, fetchItems, fetchLists, fetchPlans]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const active = useMemo(
    () => inventory.filter((i) => i.status === 'ACTIVE'),
    [inventory]
  );

  const expiring = useMemo(() => {
    const withExp = active
      .filter((i) => i.expirationDate)
      .sort(
        (a, b) =>
          new Date(a.expirationDate!).getTime() -
          new Date(b.expirationDate!).getTime()
      );
    return withExp[0];
  }, [active]);

  const otherItems = useMemo(
    () => active.filter((i) => i.id !== expiring?.id).slice(0, 2),
    [active, expiring]
  );

  const daysUntilExpiration = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil(
      (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const styles = makeStyles(c);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.brandRow}>
            <MaterialIcons name="restaurant-menu" size={22} color={c.primaryContainer} />
            <Text style={[styles.brandText, { color: c.primaryContainer }]}>CHEFMATE</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/notifications')}>
            <MaterialIcons name="notifications-none" size={24} color={c.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        <View style={[styles.segmentContainer, { backgroundColor: c.surfaceContainerLow }]}>
          {(['stock', 'plan', 'list'] as Segment[]).map((key) => {
            const isActive = segment === key;
            const label = key === 'stock' ? 'Stok' : key === 'plan' ? 'Plan' : 'Liste';
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.segmentButton,
                  isActive && { backgroundColor: c.surfaceContainerHighest },
                ]}
                onPress={() => {
                  hapticSelection();
                  setSegment(key);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: isActive ? c.primary : c.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {segment === 'stock' && (
          <StockView
            inventory={active}
            expiring={expiring}
            otherItems={otherItems}
            daysUntilExpiration={daysUntilExpiration}
            loading={loading}
            c={c}
            styles={styles}
            plans={plans}
          />
        )}

        {segment === 'plan' && <PlanView c={c} styles={styles} plans={plans} />}
        {segment === 'list' && <ListView c={c} styles={styles} lists={lists} />}
      </ScrollView>

      <View style={styles.fabGroup}>
        <PressableScale
          style={[styles.fabSecondary, { backgroundColor: c.text }]}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <MaterialIcons name="document-scanner" size={20} color={c.background} />
          <Text style={[styles.fabSecondaryText, { color: c.background }]}>AI Tara</Text>
        </PressableScale>
        <PressableScale
          style={[styles.fabPrimary, { backgroundColor: c.primaryContainer }]}
          onPress={() => router.push('/(tabs)/inventory')}
        >
          <MaterialIcons name="add" size={32} color={c.onPrimaryContainer} />
        </PressableScale>
      </View>
    </View>
  );
}

function StockView({ inventory, expiring, otherItems, daysUntilExpiration, loading, c, styles, plans }: any) {
  const todayPlan = plans?.[0]?.items?.[0];

  if (loading && inventory.length === 0) {
    return (
      <View style={{ padding: 60, alignItems: 'center' }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (inventory.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <MaterialIcons name="kitchen" size={56} color={c.textMuted} />
        <Text style={{ color: c.textSecondary, marginTop: 14, fontFamily: fonts.bodyMedium }}>
          Stokta ürün yok — AI Tara ile başlayın.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.stockHeader}>
        <View>
          <Text style={[styles.overline, { color: c.primary + 'B3' }]}>MEVCUT DURUM</Text>
          <Text style={[styles.stockTitle, { color: c.text }]}>Mutfak Stoğu</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.stockCount, { color: c.text }]}>{inventory.length}</Text>
          <Text style={[styles.stockCountLabel, { color: c.textMuted }]}>KALEM ÜRÜN</Text>
        </View>
      </View>

      {expiring && (
        <View style={[styles.bentoFeatured, { backgroundColor: c.surfaceContainerLow }]}>
          <View style={[styles.warningBadge, { backgroundColor: c.errorContainer }]}>
            <Text style={[styles.warningBadgeText, { color: '#FFDAD6' }]}>TAZELİK RİSKİ</Text>
          </View>
          <Text style={[styles.bentoFeaturedTitle, { color: c.text }]}>
            {expiring.product?.productName || expiring.product?.name || 'Ürün'}
          </Text>
          <Text style={[styles.bentoFeaturedMeta, { color: c.textSecondary }]}>
            {expiring.quantityDisplay} {expiring.displayUnit} kaldı •{' '}
            {(() => {
              const d = daysUntilExpiration(expiring.expirationDate);
              if (d === null) return '';
              if (d < 0) return 'SKT geçmiş';
              if (d === 0) return 'SKT: Bugün';
              if (d === 1) return 'SKT: Yarın';
              return `SKT: ${d} gün`;
            })()}
          </Text>
          <TouchableOpacity style={styles.bentoCTA} onPress={() => router.push('/(tabs)')}>
            <Text style={[styles.bentoCTAText, { color: c.primary }]}>Tarif Bul</Text>
            <MaterialIcons name="arrow-forward" size={16} color={c.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.smallsRow}>
        {otherItems.map((item: any) => {
          const d = daysUntilExpiration(item.expirationDate);
          const freshRatio = d === null ? 0.75 : Math.max(0.1, Math.min(1, d / 14));
          return (
            <PressableScale
              key={item.id}
              style={[styles.bentoSmall, { backgroundColor: c.surfaceContainerLow }]}
              onPress={() => router.push('/(tabs)/inventory')}
            >
              <MaterialIcons name="eco" size={22} color={c.secondary} />
              <View style={{ flex: 1 }} />
              <Text style={[styles.smallTitle, { color: c.text }]} numberOfLines={1}>
                {item.product?.productName || item.product?.name || 'Ürün'}
              </Text>
              <Text style={[styles.smallMeta, { color: c.textSecondary }]}>
                {item.quantityDisplay} {item.displayUnit}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: c.surfaceContainerHighest }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${freshRatio * 100}%`,
                      backgroundColor: freshRatio < 0.3 ? c.primaryContainer : c.secondary,
                    },
                  ]}
                />
              </View>
            </PressableScale>
          );
        })}
      </View>

      {todayPlan && (
        <View style={{ marginTop: 40 }}>
          <Text style={[styles.overline, { color: c.primary + 'B3' }]}>BUGÜNKÜ PLAN</Text>
          <PressableScale
            style={[styles.planPreview, { backgroundColor: c.surfaceContainerLow }]}
            onPress={() => router.push('/meal-plans')}
          >
            <View style={[styles.planThumb, { backgroundColor: c.surfaceContainer }]}>
              <MaterialIcons name="restaurant" size={28} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planTitle, { color: c.text }]} numberOfLines={1}>
                {todayPlan.recipe?.title || 'Plan'}
              </Text>
              <Text style={[styles.planSubtitle, { color: c.textSecondary }]}>
                Akşam Yemeği • {todayPlan.recipe?.totalTimeMinutes || 30} dk
              </Text>
            </View>
            <View style={[styles.planArrow, { backgroundColor: c.surfaceContainerHighest }]}>
              <MaterialIcons name="chevron-right" size={22} color={c.text} />
            </View>
          </PressableScale>
        </View>
      )}
    </>
  );
}

function PlanView({ c, styles, plans }: any) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 40 }}>
      <MaterialIcons name="calendar-month" size={56} color={c.textMuted} />
      <Text style={[styles.emptyText, { color: c.text }]}>Yemek Planın</Text>
      <Text style={[styles.emptySub, { color: c.textSecondary }]}>{plans.length} aktif plan</Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: c.primaryContainer }]}
        onPress={() => router.push('/meal-plans')}
      >
        <Text style={[styles.emptyButtonText, { color: c.onPrimaryContainer }]}>Detayları Aç</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListView({ c, styles, lists }: any) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 40 }}>
      <MaterialIcons name="shopping-cart" size={56} color={c.textMuted} />
      <Text style={[styles.emptyText, { color: c.text }]}>Alışveriş Listen</Text>
      <Text style={[styles.emptySub, { color: c.textSecondary }]}>{lists.length} liste</Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: c.primaryContainer }]}
        onPress={() => router.push('/(tabs)/shopping')}
      >
        <Text style={[styles.emptyButtonText, { color: c.onPrimaryContainer }]}>Detayları Aç</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      paddingTop: Platform.OS === 'ios' ? 50 : 30,
      backgroundColor: 'rgba(14,14,14,0.85)',
    },
    headerInner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: H_PAD,
      paddingBottom: 16,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandText: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -1,
      fontFamily: fonts.headingExtraBold,
    },
    scrollContent: {
      paddingTop: Platform.OS === 'ios' ? 100 : 80,
      paddingBottom: 180,
      paddingHorizontal: H_PAD,
    },
    segmentContainer: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 14,
      marginBottom: 32,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: fonts.bodySemiBold,
    },
    stockHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 24,
    },
    overline: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      fontFamily: fonts.headingSemiBold,
      marginBottom: 4,
    },
    stockTitle: {
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1,
      fontFamily: fonts.headingExtraBold,
    },
    stockCount: {
      fontSize: 22,
      fontWeight: '800',
      fontFamily: fonts.headingBold,
    },
    stockCountLabel: {
      fontSize: 10,
      letterSpacing: 0.5,
      fontFamily: fonts.bodyMedium,
    },
    bentoFeatured: {
      padding: 24,
      borderRadius: 22,
      minHeight: 160,
      marginBottom: 16,
    },
    warningBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    warningBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      fontFamily: fonts.bodySemiBold,
    },
    bentoFeaturedTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontFamily: fonts.headingBold,
      marginBottom: 4,
    },
    bentoFeaturedMeta: {
      fontSize: 13,
      fontFamily: fonts.bodyMedium,
      marginBottom: 12,
    },
    bentoCTA: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    bentoCTAText: {
      fontSize: 13,
      fontWeight: '800',
      fontFamily: fonts.bodySemiBold,
    },
    smallsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    bentoSmall: {
      flex: 1,
      aspectRatio: 1,
      padding: 18,
      borderRadius: 22,
    },
    smallTitle: {
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 2,
      fontFamily: fonts.headingBold,
    },
    smallMeta: {
      fontSize: 11,
      fontFamily: fonts.bodyMedium,
      marginBottom: 10,
    },
    progressTrack: {
      height: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    planPreview: {
      marginTop: 14,
      padding: 16,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    planThumb: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planTitle: {
      fontSize: 15,
      fontWeight: '800',
      fontFamily: fonts.headingBold,
      marginBottom: 2,
    },
    planSubtitle: {
      fontSize: 11,
      fontFamily: fonts.bodyMedium,
    },
    planArrow: {
      width: 38,
      height: 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabGroup: {
      position: 'absolute',
      bottom: 110,
      right: 24,
      alignItems: 'flex-end',
      gap: 14,
      zIndex: 40,
    },
    fabSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 999,
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabSecondaryText: {
      fontSize: 13,
      fontWeight: '800',
      fontFamily: fonts.bodySemiBold,
    },
    fabPrimary: {
      width: 62,
      height: 62,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '800',
      marginTop: 16,
      fontFamily: fonts.headingBold,
    },
    emptySub: {
      fontSize: 13,
      marginTop: 4,
      fontFamily: fonts.bodyMedium,
    },
    emptyButton: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 999,
    },
    emptyButtonText: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.5,
      fontFamily: fonts.bodySemiBold,
    },
  });
}

export default withScreenErrorBoundary(KitchenScreen, 'Mutfağım');
