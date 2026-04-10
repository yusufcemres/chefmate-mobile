import { useEffect, useState, useCallback } from 'react';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useNotificationStore } from '../src/stores/notifications';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryLabel(dateStr: string | null): { text: string; color: string } {
  const days = daysUntil(dateStr);
  if (days <= 0) return { text: 'Bugün sona eriyor!', color: colors.error };
  if (days === 1) return { text: 'Yarın sona eriyor', color: colors.error };
  if (days <= 3) return { text: `${days} gün kaldı`, color: colors.warning };
  return { text: `${days} gün kaldı`, color: colors.success };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const STORAGE_ICONS: Record<string, string> = {
  FRIDGE: '🧊',
  FREEZER: '❄️',
  PANTRY: '🏠',
  OTHER: '📦',
};

function NotificationsScreen() {
  const { expiringItems, loading, pushEnabled, fetchExpiringItems, requestPermissionAndRegister, removePushToken } = useNotificationStore();
  const [daysAhead, setDaysAhead] = useState(3);

  useEffect(() => {
    fetchExpiringItems(daysAhead);
  }, [daysAhead]);

  const onRefresh = useCallback(() => {
    fetchExpiringItems(daysAhead);
  }, [daysAhead]);

  const handleTogglePush = async (value: boolean) => {
    try {
      if (value) {
        const success = await requestPermissionAndRegister();
        if (!success) {
          const msg = 'Bildirim izni reddedildi. Ayarlardan etkinleştirebilirsiniz.';
          Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Bildirimler', msg);
          return;
        }
        const msg = 'Bildirimler etkinleştirildi!';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Bildirimler', msg);
      } else {
        await removePushToken();
      }
    } catch (err: any) {
      const msg = err.message || 'Hata';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Geri dön">
          <Text style={styles.backBtn}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Push Toggle */}
      <View style={styles.pushCard}>
        <View style={styles.pushInfo}>
          <Text style={styles.pushTitle}>Push Bildirimleri</Text>
          <Text style={styles.pushDesc}>SKT yaklaşan ürünler için bildirim al</Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={handleTogglePush}
          trackColor={{ true: colors.primaryLight, false: colors.border }}
          thumbColor={pushEnabled ? colors.primary : '#f4f3f4'}
          accessibilityLabel="Push bildirimleri"
          accessibilityRole="switch"
          accessibilityState={{ checked: pushEnabled }}
        />
      </View>

      {/* Days filter */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Son kullanma:</Text>
        {[1, 3, 7, 14].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.filterChip, daysAhead === d && styles.filterChipActive]}
            onPress={() => setDaysAhead(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: daysAhead === d }}
            accessibilityLabel={d + ' gün filtresi'}
          >
            <Text style={[styles.filterChipText, daysAhead === d && styles.filterChipTextActive]}>
              {d} gün
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      {!loading && expiringItems.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {expiringItems.length} ürünün son kullanma tarihi {daysAhead} gün içinde doluyor
          </Text>
        </View>
      )}

      {loading && expiringItems.length === 0 && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      )}

      {!loading && expiringItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>Her şey yolunda!</Text>
          <Text style={styles.emptySubtitle}>
            Önümüzdeki {daysAhead} gün içinde sona erecek ürün yok
          </Text>
        </View>
      )}

      <FlatList
        data={expiringItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const expiry = expiryLabel(item.expirationDate);
          return (
            <View style={styles.itemCard}>
              <Text style={styles.itemIcon}>{STORAGE_ICONS[item.storageLocation] || '📦'}</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{(item.product as any)?.productName || 'Ürün'}</Text>
                <Text style={styles.itemQty}>
                  {item.quantityDisplay} {item.displayUnit}
                </Text>
                <Text style={styles.itemExpDate}>SKT: {formatDate(item.expirationDate)}</Text>
              </View>
              <View style={styles.itemBadge}>
                <View style={[styles.badge, { backgroundColor: expiry.color + '20' }]}>
                  <Text style={[styles.badgeText, { color: expiry.color }]}>{expiry.text}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: fontSize.lg, color: colors.text },

  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pushInfo: { flex: 1 },
  pushTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  pushDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.xs },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.warning, backgroundColor: colors.warning + '20' },
  filterChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  filterChipTextActive: { color: colors.warning, fontWeight: '700' },

  summary: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  summaryText: { fontSize: fontSize.sm, color: colors.warning, fontWeight: '600' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemIcon: { fontSize: 28, marginRight: spacing.sm },
  itemInfo: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemQty: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  itemExpDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  itemBadge: { marginLeft: spacing.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
});

export default withScreenErrorBoundary(NotificationsScreen, 'Bildirimler');
