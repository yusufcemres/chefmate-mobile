import { useEffect, useState, useCallback } from 'react';
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
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { api } from '../../src/api/client';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { InventoryItem, Product, Category } from '../../src/types';

export default function InventoryScreen() {
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
      const res = await api.get<{ data: any[] }>(`/products/search?q=${encodeURIComponent(q)}`);
      // API returns productName, normalize to name
      const mapped = (res.data || []).map((p: any) => ({ ...p, name: p.productName || p.name }));
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
    const expiryColor = days === null ? undefined : days <= 0 ? colors.error : days <= 3 ? colors.warning : colors.success;

    return (
      <TouchableOpacity style={styles.itemCard} onLongPress={() => handleDelete(item)} activeOpacity={0.8}>
        <View style={styles.itemLeft}>
          <Text style={styles.itemName}>{(item.product as any)?.productName || item.product?.name || 'Ürün'}</Text>
          <Text style={styles.itemDetail}>
            {item.quantityDisplay ?? item.quantity} {item.displayUnit} - {item.storageLocation || 'Mutfak'}
          </Text>
        </View>
        <View style={styles.itemRight}>
          {days !== null && (
            <Text style={[styles.expiryText, { color: expiryColor }]}>
              {days <= 0 ? 'Süresi doldu' : `${days} gün`}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items.filter((i) => i.status === 'ACTIVE')}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <Text style={styles.count}>
            {items.filter((i) => i.status === 'ACTIVE').length} ürün stoğunuzda
          </Text>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🧊</Text>
              <Text style={styles.emptyTitle}>Stoğunuz boş</Text>
              <Text style={styles.emptyText}>Malzeme ekleyerek başlayın</Text>
            </View>
          )
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  count: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  itemCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  itemRight: { marginLeft: spacing.sm },
  expiryText: { fontSize: fontSize.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  fabText: { fontSize: 28, color: colors.textInverse, fontWeight: '300', lineHeight: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, minHeight: 300 },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.md },
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
