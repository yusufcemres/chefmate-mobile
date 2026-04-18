import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { api } from '../../src/api/client';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';
import { EmptyState } from '../../src/components/EmptyState';
import type { InventoryItem, Product, Category } from '../../src/types';

// Category emoji mapping for inventory items
const inventoryCategoryEmoji: Record<string, string> = {
  'sebze': '\u{1F955}', 'meyve': '\u{1F34E}', 'et': '\u{1F969}', 'tavuk': '\u{1F357}',
  'balik': '\u{1F41F}', 'balık': '\u{1F41F}', 'sut': '\u{1F95B}', 'süt': '\u{1F95B}',
  'peynir': '\u{1F9C0}', 'baharat': '\u{1F336}', 'tahil': '\u{1F33E}', 'tahıl': '\u{1F33E}',
  'baklagil': '\u{1FAD8}', 'yag': '\u{1FAD2}', 'yağ': '\u{1FAD2}', 'icecek': '\u{1F379}',
  'içecek': '\u{1F379}', 'konserve': '\u{1F96B}', 'dondurulmus': '\u{1F9CA}',
};
const getItemEmoji = (item: InventoryItem): string => {
  const catName = ((item as any).product?.category?.name || '').toLowerCase();
  const prodName = ((item.product as any)?.productName || item.product?.name || '').toLowerCase();
  for (const [key, emoji] of Object.entries(inventoryCategoryEmoji)) {
    if (catName.includes(key) || prodName.includes(key)) return emoji;
  }
  return '\u{1F4E6}'; // package emoji default
};

export default function InventoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const { items, loading, fetchItems } = useInventoryStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('adet');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) fetchItems(user.id);
  }, [user]);

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchItems(user.id);
    setRefreshing(false);
  }, [user]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get<any>(`/products/search?q=${encodeURIComponent(q)}`);
      const items: any[] = Array.isArray(res) ? res : (res?.data || []);
      const mapped = items.map((p: any) => ({ ...p, name: p.productName || p.name }));
      setSearchResults(mapped);
    } catch {
      setSearchResults([]);
    }
  };

  const handleAdd = async () => {
    if (!user || !selectedProduct) return;
    setAdding(true);
    try {
      await useInventoryStore.getState().addItem(user.id, {
        productId: selectedProduct.id,
        quantityDisplay: parseFloat(qty) || 1,
        displayUnit: unit,
      });
      await fetchItems(user.id);
      setShowAdd(false);
      setSelectedProduct(null);
      setSearch('');
      setQty('1');
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Hata oluştu');
      } else {
        Alert.alert('Hata', err.message);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!user) return;
    const name = (item.product as any)?.productName || item.product?.name || 'Bu ürünü';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`${name} stoğunuzdan silinsin mi?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Stoğu Sil', `${name} stoğunuzdan silmek istiyor musunuz?`, [
            { text: 'İptal', onPress: () => resolve(false) },
            { text: 'Sil', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (confirmed) {
      await useInventoryStore.getState().removeItem(user.id, item.id);
      fetchItems(user.id);
    }
  };

  const daysUntilExpiry = (date: string | null) => {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const days = daysUntilExpiry(item.expirationDate);
    const expiryColor = days === null ? colors.textMuted : days <= 0 ? colors.error : days <= 3 ? colors.warning : colors.success;
    // Expiry progress: 30 days = full green, 0 = red
    const expiryPercent = days === null ? 100 : Math.max(0, Math.min(100, (days / 30) * 100));
    const emoji = getItemEmoji(item);

    return (
      <TouchableOpacity style={styles.itemCard} onLongPress={() => handleDelete(item)} activeOpacity={0.8}>
        <Text style={styles.itemEmoji}>{emoji}</Text>
        <View style={styles.itemLeft}>
          <Text style={styles.itemName}>{(item.product as any)?.productName || item.product?.name || 'Ürün'}</Text>
          <Text style={styles.itemDetail}>
            {item.quantityDisplay ?? item.quantity} {item.displayUnit} - {item.storageLocation || 'Mutfak'}
          </Text>
          {days !== null && (
            <View style={styles.expiryBarContainer}>
              <View style={[styles.expiryBarFill, { width: `${expiryPercent}%`, backgroundColor: expiryColor }]} />
            </View>
          )}
        </View>
        <View style={styles.itemRight}>
          {days !== null && (
            <View style={[styles.expiryBadge, { backgroundColor: expiryColor + '18' }]}>
              <MaterialIcons
                name={days <= 0 ? 'error' : days <= 3 ? 'warning' : 'check-circle'}
                size={14}
                color={expiryColor}
              />
              <Text style={[styles.expiryText, { color: expiryColor }]}>
                {days <= 0 ? 'Doldu' : `${days}g`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const activeItems = items.filter((i) => i.status === 'ACTIVE');
  const expiringCount = activeItems.filter((i) => {
    const days = daysUntilExpiry(i.expirationDate);
    return days !== null && days >= 0 && days <= 3;
  }).length;
  const expiredCount = activeItems.filter((i) => {
    const days = daysUntilExpiry(i.expirationDate);
    return days !== null && days < 0;
  }).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={activeItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {(expiringCount > 0 || expiredCount > 0) && (
              <View style={styles.expiryAlert}>
                <MaterialIcons name="notifications-active" size={20} color={expiredCount > 0 ? colors.error : colors.warning} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  {expiredCount > 0 && (
                    <Text style={[styles.expiryAlertText, { color: colors.error }]}>
                      {expiredCount} ürünün tarihi geçti!
                    </Text>
                  )}
                  {expiringCount > 0 && (
                    <Text style={[styles.expiryAlertText, { color: colors.warning }]}>
                      {expiringCount} ürün 3 gün içinde sona erecek
                    </Text>
                  )}
                </View>
              </View>
            )}
            <Text style={styles.count}>
              {activeItems.length} ürün stoğunuzda
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <EmptyState
              icon="kitchen"
              title="Mutfağını Doldur!"
              message="Stok ekleyerek başla. Malzemelerine göre tarif önerisi alabilirsin."
              ctaLabel="Ürün Ekle"
              onCta={() => setShowAdd(true)}
            />
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <MaterialIcons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Stok Ekle</Text>
            <TextInput
              style={styles.input}
              placeholder="Ürün ara (ör: domates, süt)..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchResults.length > 0 && !selectedProduct && (
              <FlatList
                data={searchResults.slice(0, 8)}
                keyExtractor={(p) => p.id}
                style={styles.searchList}
                renderItem={({ item: p }) => (
                  <TouchableOpacity
                    style={styles.searchItem}
                    onPress={() => { setSelectedProduct(p); setSearch(p.name); setSearchResults([]); }}
                  >
                    <Text style={styles.searchItemText}>{p.name}</Text>
                    <Text style={styles.searchItemCat}>{p.category?.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            {selectedProduct && (
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numeric"
                  value={qty}
                  onChangeText={setQty}
                  placeholder="Miktar"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="Birim"
                />
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setSelectedProduct(null); setSearch(''); }}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, (!selectedProduct || adding) && styles.disabled]}
                onPress={handleAdd}
                disabled={!selectedProduct || adding}
              >
                <Text style={styles.addText}>{adding ? 'Ekleniyor...' : 'Ekle'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: 100,
    ...(Platform.OS === 'web' ? { maxWidth: 900, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  count: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, fontFamily: fonts.bodySemiBold },
  expiryAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '14',
    borderWidth: 1,
    borderColor: colors.warning + '30',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  expiryAlertText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodySemiBold,
  },
  itemCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#302F2A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '60',
  },
  itemEmoji: { fontSize: 28 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },
  itemDetail: { fontSize: fontSize.xs, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 2 },
  expiryBarContainer: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  expiryBarFill: {
    height: 4,
    borderRadius: 2,
  },
  itemRight: { marginLeft: spacing.sm },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  expiryText: { fontSize: fontSize.xs, fontFamily: fonts.headingBold },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
  fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, minHeight: 300 },
  modalTitle: { fontSize: fontSize.xl, fontFamily: fonts.headingBold, color: colors.text, marginBottom: spacing.md },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, color: colors.text, marginBottom: spacing.sm },
  searchList: { maxHeight: 200, marginBottom: spacing.sm },
  searchItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  searchItemText: { fontSize: fontSize.md, color: colors.text },
  searchItemCat: { fontSize: fontSize.xs, color: colors.textMuted },
  qtyRow: { flexDirection: 'row', gap: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '600' },
  addBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  addText: { color: colors.textInverse, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
