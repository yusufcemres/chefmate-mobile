import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useShoppingStore } from '../../src/stores/shopping';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { ShoppingList, ShoppingListItem } from '../../src/types';

export default function ShoppingScreen() {
  const { lists, currentList, loading, error, fetchLists, fetchList, createList, addItem, toggleItem, removeItem, deleteList } = useShoppingStore();
  const { user } = useAuthStore();

  const [viewMode, setViewMode] = useState<'lists' | 'detail'>('lists');
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('adet');

  useEffect(() => {
    fetchLists();
  }, []);

  const onRefresh = useCallback(() => {
    if (viewMode === 'lists') fetchLists();
    else if (currentList) fetchList(currentList.id);
  }, [viewMode, currentList]);

  const handleCreateList = async () => {
    const alertPrompt = Platform.OS === 'web' ? window.prompt : null;
    if (alertPrompt) {
      const name = alertPrompt('Liste adı:', 'Alışveriş Listem');
      if (name) {
        const list = await createList(name);
        await fetchList(list.id);
        setViewMode('detail');
      }
    } else {
      const list = await createList();
      await fetchList(list.id);
      setViewMode('detail');
    }
  };

  const handleOpenList = async (list: ShoppingList) => {
    await fetchList(list.id);
    setViewMode('detail');
  };

  const handleDeleteList = (listId: string) => {
    const doDelete = async () => {
      await deleteList(listId);
      setViewMode('lists');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Bu listeyi silmek istediğinize emin misiniz?')) doDelete();
    } else {
      Alert.alert('Listeyi Sil', 'Bu listeyi silmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleAddItem = async () => {
    if (!currentList || !newItemName.trim()) return;
    await addItem(currentList.id, {
      customName: newItemName.trim(),
      quantity: parseFloat(newItemQty) || 1,
      unit: newItemUnit || 'adet',
    });
    setNewItemName('');
    setNewItemQty('1');
    setShowAddItem(false);
  };

  const handleToggle = async (item: ShoppingListItem) => {
    if (!currentList) return;
    await toggleItem(currentList.id, item.id, !item.isChecked);
  };

  const handleRemoveItem = async (item: ShoppingListItem) => {
    if (!currentList) return;
    await removeItem(currentList.id, item.id);
  };

  // ===== LIST VIEW =====
  if (viewMode === 'lists') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateList}>
          <Text style={styles.createBtnText}>+ Yeni Liste</Text>
        </TouchableOpacity>

        {loading && lists.length === 0 && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {!loading && lists.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Henüz alışveriş listen yok</Text>
            <Text style={styles.emptySubtitle}>Yeni bir liste oluştur veya tariften otomatik oluştur</Text>
          </View>
        )}

        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const checkedCount = item.items?.filter((i) => i.isChecked).length || 0;
            const totalCount = item.items?.length || 0;
            return (
              <TouchableOpacity style={styles.listCard} onPress={() => handleOpenList(item)}>
                <View style={styles.listCardLeft}>
                  <Text style={styles.listName}>{item.name}</Text>
                  <Text style={styles.listMeta}>
                    {checkedCount}/{totalCount} tamamlandı
                  </Text>
                </View>
                <View style={styles.listCardRight}>
                  {totalCount > 0 && (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(checkedCount / totalCount) * 100}%` }]} />
                    </View>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteList(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // ===== DETAIL VIEW =====
  const sortedItems = [...(currentList?.items || [])].sort((a, b) => {
    // Unchecked first, then by sortOrder
    if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => { setViewMode('lists'); setShowAddItem(false); }}>
          <Text style={styles.backBtn}>← Listeler</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>{currentList?.name}</Text>
        <TouchableOpacity onPress={() => setShowAddItem(!showAddItem)}>
          <Text style={styles.addBtnIcon}>➕</Text>
        </TouchableOpacity>
      </View>

      {/* Add item form */}
      {showAddItem && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.addInput}
            placeholder="Ürün adı..."
            placeholderTextColor={colors.textMuted}
            value={newItemName}
            onChangeText={setNewItemName}
            autoFocus
          />
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { flex: 1 }]}
              placeholder="Miktar"
              placeholderTextColor={colors.textMuted}
              value={newItemQty}
              onChangeText={setNewItemQty}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.addInput, { flex: 1, marginLeft: spacing.sm }]}
              placeholder="Birim"
              placeholderTextColor={colors.textMuted}
              value={newItemUnit}
              onChangeText={setNewItemUnit}
            />
            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddItem}>
              <Text style={styles.addConfirmText}>Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Items */}
      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>Liste boş</Text>
            <Text style={styles.emptySubtitle}>➕ butonuna basarak ürün ekle</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}>
            <TouchableOpacity style={styles.checkbox} onPress={() => handleToggle(item)}>
              <Text style={{ fontSize: 20 }}>{item.isChecked ? '☑️' : '⬜'}</Text>
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
                {item.customName || item.productId || 'Ürün'}
              </Text>
              <Text style={styles.itemQty}>
                {item.quantity} {item.unit}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 16, color: colors.error }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Create button
  createBtn: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  createBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },

  // List cards
  listCard: {
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
  listCardLeft: { flex: 1 },
  listCardRight: { alignItems: 'flex-end', gap: 6 },
  listName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  listMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  deleteIcon: { fontSize: 16 },

  // Detail header
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },
  detailTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: fontSize.lg, color: colors.text },
  addBtnIcon: { fontSize: 22 },

  // Add form
  addForm: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  addInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addRow: { flexDirection: 'row', marginTop: spacing.sm, alignItems: 'center' },
  addConfirmBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  addConfirmText: { color: colors.textInverse, fontWeight: '700' },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemRowChecked: { opacity: 0.55 },
  checkbox: { marginRight: spacing.sm },
  itemInfo: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  itemQty: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
