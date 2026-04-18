import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useShoppingStore } from '../../src/stores/shopping';
import { useAuthStore } from '../../src/stores/auth';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';
import { EmptyState } from '../../src/components/EmptyState';
import type { ShoppingList, ShoppingListItem } from '../../src/types';

export default function ShoppingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          <MaterialIcons name="add-circle" size={20} color={colors.textInverse} />
          <Text style={styles.createBtnText}>Yeni Liste</Text>
        </TouchableOpacity>

        {loading && lists.length === 0 && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {!loading && lists.length === 0 && (
          <EmptyState
            icon="shopping-cart"
            title="Henüz alışveriş listen yok"
            message="Yeni bir liste oluştur veya tariften otomatik oluştur."
            ctaLabel="Yeni Liste"
            onCta={handleCreateList}
          />
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
                    <MaterialIcons name="delete-outline" size={20} color={colors.error} />
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
  const CATEGORY_EMOJI: Record<string, string> = {
    'sebze': '🥕', 'meyve': '🍎', 'et': '🥩', 'tavuk': '🍗',
    'balık': '🐟', 'balik': '🐟', 'süt': '🥛', 'sut': '🥛',
    'peynir': '🧀', 'baharat': '🌶️', 'tahıl': '🌾', 'tahil': '🌾',
    'baklagil': '🫘', 'yağ': '🫒', 'yag': '🫒', 'içecek': '🍹',
    'icecek': '🍹', 'konserve': '🥫', 'dondurulmuş': '🧊',
  };

  const getCategoryEmoji = (catName: string): string => {
    const lower = catName.toLowerCase();
    for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
      if (lower.includes(key)) return emoji;
    }
    return '📦';
  };

  const sections = useMemo(() => {
    const items = [...(currentList?.items || [])].sort((a, b) => {
      if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });

    const grouped = new Map<string, ShoppingListItem[]>();
    for (const item of items) {
      const catName = item.product?.category?.name || 'Diğer';
      const list = grouped.get(catName) || [];
      list.push(item);
      grouped.set(catName, list);
    }

    // "Diğer" always last
    const entries = [...grouped.entries()].sort((a, b) => {
      if (a[0] === 'Diğer') return 1;
      if (b[0] === 'Diğer') return -1;
      return a[0].localeCompare(b[0], 'tr');
    });

    return entries.map(([title, data]) => ({ title, data }));
  }, [currentList?.items]);

  const checkedCount = currentList?.items?.filter((i) => i.isChecked).length || 0;
  const totalCount = currentList?.items?.length || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => { setViewMode('lists'); setShowAddItem(false); }} style={styles.backBtnWrap}>
          <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtn}>Listeler</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>{currentList?.name}</Text>
        <TouchableOpacity onPress={() => setShowAddItem(!showAddItem)} style={styles.addIconBtn}>
          <MaterialIcons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Progress summary */}
      {totalCount > 0 && (
        <View style={styles.progressSummary}>
          <Text style={styles.progressText}>{checkedCount}/{totalCount} tamamlandı</Text>
          <View style={styles.progressBarDetail}>
            <View style={[styles.progressFill, { width: `${(checkedCount / totalCount) * 100}%` }]} />
          </View>
        </View>
      )}

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

      {/* Items grouped by category */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState
            icon="playlist-add"
            title="Liste boş"
            message="Ürün ekleyerek listeye başla."
            ctaLabel="Ürün Ekle"
            onCta={() => setShowAddItem(true)}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>{getCategoryEmoji(section.title)}</Text>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.filter((i) => i.isChecked).length}/{section.data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.itemRow, item.isChecked && styles.itemRowChecked]}>
            <TouchableOpacity style={styles.checkbox} onPress={() => handleToggle(item)}>
              <MaterialIcons
                name={item.isChecked ? 'check-circle' : 'radio-button-unchecked'}
                size={24}
                color={item.isChecked ? colors.primary : colors.outlineVariant}
              />
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, item.isChecked && styles.itemNameChecked]}>
                {item.customName || item.product?.productName || 'Ürün'}
              </Text>
              <Text style={styles.itemQty}>
                {item.quantity} {item.unit}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' ? { maxWidth: 900, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },

  // Create button
  createBtn: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: fontSize.md },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontFamily: fonts.headingBold, color: colors.text },
  emptySubtitle: { fontSize: fontSize.sm, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: spacing.xs },

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
  // (deleteIcon removed — using MaterialIcons now)

  // Detail header
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtnWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  detailTitle: { flex: 1, textAlign: 'center', fontWeight: '800', fontSize: fontSize.lg, color: colors.text },
  addIconBtn: { padding: 4 },

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

  // Progress summary
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  progressText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, minWidth: 90 },
  progressBarDetail: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    marginLeft: spacing.sm,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flex: 1 },
  sectionCount: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },

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
