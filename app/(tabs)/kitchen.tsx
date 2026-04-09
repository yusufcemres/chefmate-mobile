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
  Modal,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { useShoppingStore } from '../../src/stores/shopping';
import { useMealPlanStore } from '../../src/stores/meal-plans';
import { api } from '../../src/api/client';
import { colors, spacing, fontSize, borderRadius, fonts } from '../../src/theme';
import { EmptyState } from '../../src/components/EmptyState';
import type { InventoryItem, Product, ShoppingList, ShoppingListItem, MealPlan, MealPlanItem } from '../../src/types';

type Segment = 'stok' | 'plan' | 'liste';

const CATEGORY_EMOJI: Record<string, string> = {
  sebze: '🥕', meyve: '🍎', et: '🥩', tavuk: '🍗',
  'balık': '🐟', balik: '🐟', 'süt': '🥛', sut: '🥛',
  peynir: '🧀', baharat: '🌶️', 'tahıl': '🌾', tahil: '🌾',
  baklagil: '🫘', 'yağ': '🫒', yag: '🫒', 'içecek': '🍹',
  icecek: '🍹', konserve: '🥫', 'dondurulmuş': '🧊',
};

const getCatEmoji = (name: string): string => {
  const l = name.toLowerCase();
  for (const [k, e] of Object.entries(CATEGORY_EMOJI)) {
    if (l.includes(k)) return e;
  }
  return '📦';
};

const MEAL_LABELS: Record<string, string> = { BREAKFAST: 'Kahvaltı', LUNCH: 'Öğle', DINNER: 'Akşam', SNACK: 'Atıştırmalık' };
const MEAL_ICONS: Record<string, string> = { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙', SNACK: '🍿' };

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function formatDateShort(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export default function KitchenScreen() {
  const user = useAuthStore((s) => s.user);
  const [segment, setSegment] = useState<Segment>('stok');

  // ===== STOK STATE =====
  const { items: invItems, loading: invLoading, fetchItems } = useInventoryStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'photo' | 'barcode'>('manual');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('adet');
  const [adding, setAdding] = useState(false);

  // ===== LİSTE STATE =====
  const { lists, currentList, loading: shopLoading, fetchLists, fetchList, createList, addItem: addShopItem, toggleItem, removeItem: removeShopItem, deleteList } = useShoppingStore();
  const [shopView, setShopView] = useState<'lists' | 'detail'>('lists');
  const [showAddShopItem, setShowAddShopItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('adet');

  // ===== PLAN STATE =====
  const { plans, currentPlan, loading: planLoading, fetchPlans, fetchPlan, createPlan, toggleCooked, removeItem: removePlanItem, deletePlan, generateShoppingList } = useMealPlanStore();
  const [planView, setPlanView] = useState<'list' | 'detail'>('list');
  const [aiGenerating, setAiGenerating] = useState(false);

  // ===== INIT =====
  useEffect(() => {
    if (user) {
      fetchItems(user.id);
      fetchLists();
      fetchPlans();
    }
  }, [user]);

  const onRefresh = useCallback(() => {
    if (!user) return;
    if (segment === 'stok') fetchItems(user.id);
    else if (segment === 'liste') {
      if (shopView === 'lists') fetchLists();
      else if (currentList) fetchList(currentList.id);
    } else if (segment === 'plan') {
      if (planView === 'list') fetchPlans();
      else if (currentPlan) fetchPlan(currentPlan.id);
    }
  }, [user, segment, shopView, planView, currentList, currentPlan]);

  // ===== STOK HANDLERS =====
  const handleProductSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await api.get<any>(`/products/search?q=${encodeURIComponent(q)}`);
      setSearchResults((res as any[] || []).map((p: any) => ({ ...p, name: p.productName || p.name })));
    } catch { setSearchResults([]); }
  };

  const handleAddToInventory = async () => {
    if (!user || !selectedProduct) return;
    setAdding(true);
    try {
      await useInventoryStore.getState().addItem(user.id, {
        productId: selectedProduct.id,
        quantityDisplay: parseFloat(qty) || 1,
        displayUnit: unit,
      });
      await fetchItems(user.id);
      closeAddModal();
    } catch (err: any) {
      Platform.OS === 'web' ? window.alert(err.message) : Alert.alert('Hata', err.message);
    } finally { setAdding(false); }
  };

  const handleDeleteInventory = async (item: InventoryItem) => {
    if (!user) return;
    const name = (item.product as any)?.productName || 'Bu ürün';
    const ok = Platform.OS === 'web'
      ? window.confirm(`${name} silinsin mi?`)
      : await new Promise<boolean>(r => Alert.alert('Sil', `${name} silinsin mi?`, [{ text: 'İptal', onPress: () => r(false) }, { text: 'Sil', style: 'destructive', onPress: () => r(true) }]));
    if (ok) {
      await useInventoryStore.getState().removeItem(user.id, item.id);
      fetchItems(user.id);
    }
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setSelectedProduct(null);
    setSearch('');
    setSearchResults([]);
    setQty('1');
    setUnit('adet');
  };

  // ===== LİSTE HANDLERS =====
  const handleCreateList = async () => {
    const list = await createList();
    await fetchList(list.id);
    setShopView('detail');
  };

  const handleAddShopItemSubmit = async () => {
    if (!currentList || !newItemName.trim()) return;
    await addShopItem(currentList.id, { customName: newItemName.trim(), quantity: parseFloat(newItemQty) || 1, unit: newItemUnit });
    setNewItemName('');
    setNewItemQty('1');
    setShowAddShopItem(false);
  };

  // ===== PLAN HANDLERS =====
  const handleAiPlan = async () => {
    setAiGenerating(true);
    try {
      const res = await api.post<any>('/meal-plans/ai-generate', { days: 7, servings: 2, mealTypes: ['BREAKFAST', 'LUNCH', 'DINNER'], useInventory: true });
      const plan = (res as any).plan;
      await fetchPlans();
      if (plan?.id) { await fetchPlan(plan.id); setPlanView('detail'); }
      const msg = `${(res as any).summary?.totalMeals || 0} öğünlük AI plan oluşturuldu!`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('AI Plan Hazır!', msg);
    } catch (err: any) {
      Platform.OS === 'web' ? window.alert(err.message) : Alert.alert('Hata', err.message);
    } finally { setAiGenerating(false); }
  };

  // ===== COMPUTED =====
  const activeItems = invItems.filter(i => i.status === 'ACTIVE');
  const expiringItems = activeItems.filter(i => { const d = daysUntil(i.expirationDate); return d !== null && d >= 0 && d <= 3; });
  const expiredItems = activeItems.filter(i => { const d = daysUntil(i.expirationDate); return d !== null && d < 0; });

  const isLoading = segment === 'stok' ? invLoading : segment === 'liste' ? shopLoading : planLoading;

  // ===== RENDER =====
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Mutfağım</Text>
        <TouchableOpacity style={s.addFab} onPress={() => setShowAdd(true)}>
          <MaterialIcons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Segment Control */}
      <View style={s.segmentBar}>
        {(['stok', 'plan', 'liste'] as Segment[]).map(seg => (
          <TouchableOpacity
            key={seg}
            style={[s.segBtn, segment === seg && s.segBtnActive]}
            onPress={() => setSegment(seg)}
          >
            <MaterialIcons
              name={seg === 'stok' ? 'kitchen' : seg === 'plan' ? 'calendar-today' : 'checklist'}
              size={16}
              color={segment === seg ? colors.onPrimary : colors.textSecondary}
            />
            <Text style={[s.segText, segment === seg && s.segTextActive]}>
              {seg === 'stok' ? `Stok (${activeItems.length})` : seg === 'plan' ? 'Plan' : 'Liste'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ============================== STOK ============================== */}
      {segment === 'stok' && (
        <FlatList
          data={activeItems}
          keyExtractor={i => i.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={invLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          windowSize={5}
          maxToRenderPerBatch={15}
          removeClippedSubviews={Platform.OS !== 'web'}
          initialNumToRender={10}
          ListHeaderComponent={
            <>
              {/* Expiry alert card */}
              {(expiringItems.length > 0 || expiredItems.length > 0) && (
                <View style={s.alertCard}>
                  <MaterialIcons name="notifications-active" size={20} color={expiredItems.length > 0 ? colors.error : colors.warning} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    {expiredItems.length > 0 && <Text style={[s.alertText, { color: colors.error }]}>{expiredItems.length} ürünün tarihi geçti</Text>}
                    {expiringItems.length > 0 && <Text style={[s.alertText, { color: colors.warning }]}>{expiringItems.length} ürün bu hafta sona eriyor</Text>}
                  </View>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            const days = daysUntil(item.expirationDate);
            const color = days === null ? colors.textMuted : days <= 0 ? colors.error : days <= 3 ? colors.warning : colors.success;
            const pct = days === null ? 100 : Math.max(0, Math.min(100, (days / 30) * 100));
            return (
              <TouchableOpacity style={s.invCard} onLongPress={() => handleDeleteInventory(item)} activeOpacity={0.8}>
                <Text style={s.invEmoji}>{getCatEmoji((item as any).product?.category?.name || '')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.invName}>{(item.product as any)?.productName || 'Ürün'}</Text>
                  <Text style={s.invDetail}>{item.quantityDisplay ?? item.quantity} {item.displayUnit}</Text>
                  {days !== null && (
                    <View style={s.expiryBar}><View style={[s.expiryFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
                  )}
                </View>
                {days !== null && (
                  <View style={[s.expiryBadge, { backgroundColor: color + '18' }]}>
                    <Text style={[s.expiryBadgeText, { color }]}>{days <= 0 ? 'Doldu' : `${days}g`}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            invLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
              <EmptyState icon="kitchen" title="Stok boş" message="Ürün ekleyerek başla." ctaLabel="Ürün Ekle" onCta={() => setShowAdd(true)} />
            )
          }
        />
      )}

      {/* ============================== PLAN ============================== */}
      {segment === 'plan' && planView === 'list' && (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={planLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* AI Generate hero */}
          <TouchableOpacity style={s.aiHeroCard} onPress={handleAiPlan} disabled={aiGenerating}>
            <MaterialIcons name="auto-awesome" size={28} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.aiHeroTitle}>{aiGenerating ? 'AI plan oluşturuyor...' : 'AI ile Haftalık Plan'}</Text>
              <Text style={s.aiHeroSub}>Stoğuna ve tercihlerine göre 7 günlük plan</Text>
            </View>
            {aiGenerating && <ActivityIndicator color="#fff" />}
          </TouchableOpacity>

          {plans.map(plan => {
            const count = plan._count?.items || plan.items?.length || 0;
            const cooked = plan.items?.filter(i => i.isCooked).length || 0;
            return (
              <TouchableOpacity key={plan.id} style={s.planCard} onPress={async () => { await fetchPlan(plan.id); setPlanView('detail'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{plan.name}</Text>
                  <Text style={s.planMeta}>{formatDateShort(plan.startDate)} — {formatDateShort(plan.endDate)} · {count} tarif</Text>
                </View>
                {count > 0 && (
                  <View style={s.miniProgress}><View style={[s.miniProgressFill, { width: `${(cooked / count) * 100}%` }]} /></View>
                )}
              </TouchableOpacity>
            );
          })}

          {!planLoading && plans.length === 0 && (
            <EmptyState icon="calendar-today" title="Henüz plan yok" message="AI ile otomatik plan oluştur." />
          )}
        </ScrollView>
      )}

      {segment === 'plan' && planView === 'detail' && currentPlan && (
        <View style={{ flex: 1 }}>
          <View style={s.subHeader}>
            <TouchableOpacity onPress={() => setPlanView('list')} style={s.backRow}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={s.backText}>Planlar</Text>
            </TouchableOpacity>
            <Text style={s.subTitle} numberOfLines={1}>{currentPlan.name}</Text>
            <TouchableOpacity onPress={async () => { await generateShoppingList(currentPlan.id); Platform.OS === 'web' ? window.alert('Alışveriş listesi oluşturuldu!') : Alert.alert('Tamam', 'Eksik malzemeler listeye eklendi.'); }}>
              <MaterialIcons name="shopping-cart" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={currentPlan.items || []}
            keyExtractor={i => i.id}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={planLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.mealCard, item.isCooked && { opacity: 0.5 }]}
                onPress={() => item.recipeId && router.push(`/recipe/${item.recipeId}`)}
                onLongPress={() => toggleCooked(currentPlan.id, item.id)}
              >
                <Text style={s.mealEmoji}>{item.isCooked ? '✅' : (MEAL_ICONS[item.mealType] || '🍽️')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.mealType}>{MEAL_LABELS[item.mealType] || item.mealType}</Text>
                  <Text style={[s.mealTitle, item.isCooked && { textDecorationLine: 'line-through' }]}>{item.recipe?.title || 'Tarif'}</Text>
                </View>
                <Text style={s.mealDate}>{formatDateShort(item.date)}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyState icon="restaurant-menu" title="Plan boş" message="Tariflerden plana ekle." />}
          />
        </View>
      )}

      {/* ============================== LİSTE ============================== */}
      {segment === 'liste' && shopView === 'lists' && (
        <ScrollView
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={shopLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <TouchableOpacity style={s.createListBtn} onPress={handleCreateList}>
            <MaterialIcons name="add-circle" size={18} color={colors.onPrimary} />
            <Text style={s.createListText}>Yeni Liste</Text>
          </TouchableOpacity>

          {lists.map(list => {
            const checked = list.items?.filter(i => i.isChecked).length || 0;
            const total = list.items?.length || 0;
            return (
              <TouchableOpacity key={list.id} style={s.shopCard} onPress={async () => { await fetchList(list.id); setShopView('detail'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.shopName}>{list.name}</Text>
                  <Text style={s.shopMeta}>{checked}/{total} tamamlandı</Text>
                </View>
                <TouchableOpacity onPress={() => deleteList(list.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          {!shopLoading && lists.length === 0 && (
            <EmptyState icon="shopping-cart" title="Henüz liste yok" message="Yeni bir alışveriş listesi oluştur." ctaLabel="Oluştur" onCta={handleCreateList} />
          )}
        </ScrollView>
      )}

      {segment === 'liste' && shopView === 'detail' && currentList && (
        <View style={{ flex: 1 }}>
          <View style={s.subHeader}>
            <TouchableOpacity onPress={() => { setShopView('lists'); setShowAddShopItem(false); }} style={s.backRow}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={s.backText}>Listeler</Text>
            </TouchableOpacity>
            <Text style={s.subTitle} numberOfLines={1}>{currentList.name}</Text>
            <TouchableOpacity onPress={() => setShowAddShopItem(!showAddShopItem)}>
              <MaterialIcons name="add" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {showAddShopItem && (
            <View style={s.addShopForm}>
              <TextInput style={s.input} placeholder="Ürün adı..." placeholderTextColor={colors.textMuted} value={newItemName} onChangeText={setNewItemName} autoFocus />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Miktar" keyboardType="numeric" value={newItemQty} onChangeText={setNewItemQty} />
                <TouchableOpacity style={s.addShopBtn} onPress={handleAddShopItemSubmit}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Ekle</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FlatList
            data={(currentList.items || []).sort((a, b) => (a.isChecked ? 1 : 0) - (b.isChecked ? 1 : 0))}
            keyExtractor={i => i.id}
            contentContainerStyle={s.listContent}
            refreshControl={<RefreshControl refreshing={shopLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <View style={[s.shopItem, item.isChecked && { opacity: 0.5 }]}>
                <TouchableOpacity onPress={() => toggleItem(currentList.id, item.id, !item.isChecked)}>
                  <MaterialIcons name={item.isChecked ? 'check-circle' : 'radio-button-unchecked'} size={24} color={item.isChecked ? colors.primary : colors.outlineVariant} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.shopItemName, item.isChecked && { textDecorationLine: 'line-through', color: colors.textMuted }]}>{item.customName || item.product?.productName || 'Ürün'}</Text>
                  <Text style={s.shopItemQty}>{item.quantity} {item.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => removeShopItem(currentList.id, item.id)}>
                  <MaterialIcons name="close" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<EmptyState icon="playlist-add" title="Liste boş" message="Ürün ekle." ctaLabel="Ekle" onCta={() => setShowAddShopItem(true)} />}
          />
        </View>
      )}

      {/* ============================== ADD MODAL ============================== */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Stok Ekle</Text>
              <TouchableOpacity onPress={closeAddModal}><MaterialIcons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>

            {/* Add mode selector */}
            <View style={s.addModeRow}>
              {[
                { mode: 'manual' as const, icon: 'edit' as const, label: 'Manuel' },
                { mode: 'photo' as const, icon: 'camera-alt' as const, label: 'Fotoğraf' },
                { mode: 'barcode' as const, icon: 'qr-code-scanner' as const, label: 'Barkod' },
              ].map(m => (
                <TouchableOpacity
                  key={m.mode}
                  style={[s.addModeBtn, addMode === m.mode && s.addModeBtnActive]}
                  onPress={() => {
                    if (m.mode === 'photo') { closeAddModal(); router.push('/(tabs)/scan'); return; }
                    if (m.mode === 'barcode') { closeAddModal(); router.push('/(tabs)/scan'); return; }
                    setAddMode(m.mode);
                  }}
                >
                  <MaterialIcons name={m.icon} size={20} color={addMode === m.mode ? colors.onPrimary : colors.textSecondary} />
                  <Text style={[s.addModeLabel, addMode === m.mode && { color: colors.onPrimary }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Manual add */}
            <TextInput style={s.input} placeholder="Ürün ara (ör: domates, süt)..." placeholderTextColor={colors.textMuted} value={search} onChangeText={handleProductSearch} autoFocus />
            {searchResults.length > 0 && !selectedProduct && (
              <FlatList
                data={searchResults.slice(0, 6)}
                keyExtractor={p => p.id}
                style={{ maxHeight: 180 }}
                renderItem={({ item: p }) => (
                  <TouchableOpacity style={s.searchItem} onPress={() => { setSelectedProduct(p); setSearch(p.name); setSearchResults([]); }}>
                    <Text style={s.searchItemText}>{p.name}</Text>
                    <Text style={s.searchItemCat}>{(p as any).category?.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            {selectedProduct && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} keyboardType="numeric" value={qty} onChangeText={setQty} placeholder="Miktar" />
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={unit} onChangeText={setUnit} placeholder="Birim" />
              </View>
            )}
            <TouchableOpacity
              style={[s.primaryBtn, (!selectedProduct || adding) && { opacity: 0.4 }]}
              onPress={handleAddToInventory}
              disabled={!selectedProduct || adding}
            >
              <Text style={s.primaryBtnText}>{adding ? 'Ekleniyor...' : 'Stoğa Ekle'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 54,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.headingExtraBold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  addFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Segment
  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segText: { fontSize: fontSize.sm, fontFamily: fonts.headingBold, color: colors.textSecondary },
  segTextActive: { color: colors.onPrimary },

  listContent: { padding: spacing.md, paddingBottom: 100, gap: spacing.sm },

  // Alert card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '14',
    borderWidth: 1,
    borderColor: colors.warning + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  alertText: { fontSize: fontSize.sm, fontFamily: fonts.bodySemiBold },

  // Inventory card
  invCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '60',
  },
  invEmoji: { fontSize: 28 },
  invName: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },
  invDetail: { fontSize: fontSize.xs, fontFamily: fonts.bodyRegular, color: colors.textSecondary, marginTop: 2 },
  expiryBar: { height: 3, backgroundColor: colors.surfaceContainerHigh, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  expiryFill: { height: 3, borderRadius: 2 },
  expiryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
  expiryBadgeText: { fontSize: fontSize.xs, fontFamily: fonts.headingBold },

  // Plan cards
  aiHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  aiHeroTitle: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: '#fff' },
  aiHeroSub: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  planName: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },
  planMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  miniProgress: { width: 50, height: 4, backgroundColor: colors.borderLight, borderRadius: 2, marginLeft: 8 },
  miniProgressFill: { height: 4, backgroundColor: colors.success, borderRadius: 2 },

  // Meal item
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mealEmoji: { fontSize: 24 },
  mealType: { fontSize: fontSize.xs, fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
  mealTitle: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },
  mealDate: { fontSize: fontSize.xs, color: colors.textMuted },

  // Shopping
  createListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  createListText: { color: colors.onPrimary, fontFamily: fonts.headingBold, fontSize: fontSize.md },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  shopName: { fontSize: fontSize.md, fontFamily: fonts.headingBold, color: colors.text },
  shopMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  shopItemName: { fontSize: fontSize.md, fontFamily: fonts.bodyMedium, color: colors.text },
  shopItemQty: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Sub-header for detail views
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: fontSize.sm },
  subTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.headingBold, fontSize: fontSize.md, color: colors.text },

  addShopForm: {
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  addShopBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    minHeight: 320,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.xl, fontFamily: fonts.headingBold, color: colors.text },

  addModeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  addModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  addModeBtnActive: { backgroundColor: colors.primary },
  addModeLabel: { fontSize: fontSize.sm, fontFamily: fonts.headingBold, color: colors.textSecondary },

  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  searchItem: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  searchItemText: { fontSize: fontSize.md, color: colors.text },
  searchItemCat: { fontSize: fontSize.xs, color: colors.textMuted },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.onPrimary, fontFamily: fonts.headingBold, fontSize: fontSize.md },
});
