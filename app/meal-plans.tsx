import { useEffect, useState, useCallback } from 'react';
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
  SectionList,
} from 'react-native';
import { router } from 'expo-router';
import { useMealPlanStore } from '../src/stores/meal-plans';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';
import type { MealPlan, MealPlanItem } from '../src/types';

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Kahvaltı',
  LUNCH: 'Öğle Yemeği',
  DINNER: 'Akşam Yemeği',
  SNACK: 'Atıştırmalık',
};

const MEAL_TYPE_ICONS: Record<string, string> = {
  BREAKFAST: '🌅',
  LUNCH: '☀️',
  DINNER: '🌙',
  SNACK: '🍿',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDateRange(days: number): { start: string; end: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days - 1);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function MealPlansScreen() {
  const { plans, currentPlan, loading, fetchPlans, fetchPlan, createPlan, toggleCooked, removeItem, deletePlan, generateShoppingList } = useMealPlanStore();

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDays, setPlanDays] = useState('7');

  useEffect(() => {
    fetchPlans();
  }, []);

  const onRefresh = useCallback(() => {
    if (viewMode === 'list') fetchPlans();
    else if (currentPlan) fetchPlan(currentPlan.id);
  }, [viewMode, currentPlan]);

  const handleCreate = async () => {
    const name = planName.trim() || 'Haftalık Plan';
    const days = Math.min(14, Math.max(1, parseInt(planDays) || 7));
    const { start, end } = getDateRange(days);
    try {
      const plan = await createPlan(name, start, end);
      setPlanName('');
      setPlanDays('7');
      setShowCreate(false);
      await fetchPlan(plan.id);
      setViewMode('detail');
    } catch (err: any) {
      const msg = err.message || 'Hata';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    }
  };

  const handleOpenPlan = async (plan: MealPlan) => {
    await fetchPlan(plan.id);
    setViewMode('detail');
  };

  const handleDeletePlan = (planId: string) => {
    const doDelete = async () => {
      await deletePlan(planId);
      setViewMode('list');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Bu planı silmek istediğinize emin misiniz?')) doDelete();
    } else {
      Alert.alert('Planı Sil', 'Bu planı silmek istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Sil', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleToggle = async (item: MealPlanItem) => {
    if (!currentPlan) return;
    await toggleCooked(currentPlan.id, item.id);
  };

  const handleRemoveItem = async (item: MealPlanItem) => {
    if (!currentPlan) return;
    const doRemove = () => removeItem(currentPlan.id, item.id);
    if (Platform.OS === 'web') {
      if (window.confirm('Bu öğeyi kaldırmak istiyor musunuz?')) doRemove();
    } else {
      Alert.alert('Kaldır', 'Bu tarifi plandan kaldırmak istiyor musunuz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kaldır', style: 'destructive', onPress: doRemove },
      ]);
    }
  };

  const handleGenerateShoppingList = async () => {
    if (!currentPlan) return;
    try {
      await generateShoppingList(currentPlan.id);
      const msg = 'Eksik malzemeler alışveriş listesine eklendi!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Başarılı', msg);
    } catch (err: any) {
      const msg = err.message || 'Hata';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    }
  };

  // ===== LIST VIEW =====
  if (viewMode === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yemek Planlarım</Text>
          <View style={{ width: 60 }} />
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Yeni Plan</Text>
        </TouchableOpacity>

        {showCreate && (
          <View style={styles.createForm}>
            <TextInput
              style={styles.input}
              placeholder="Plan adı (ör. Haftalık Plan)"
              placeholderTextColor={colors.textMuted}
              value={planName}
              onChangeText={setPlanName}
              autoFocus
            />
            <View style={styles.daysRow}>
              <Text style={styles.daysLabel}>Kaç gün?</Text>
              {['3', '5', '7', '14'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayChip, planDays === d && styles.dayChipActive]}
                  onPress={() => setPlanDays(d)}
                >
                  <Text style={[styles.dayChipText, planDays === d && styles.dayChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.createActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
                <Text style={styles.confirmBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && plans.length === 0 && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {!loading && plans.length === 0 && !showCreate && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Henüz yemek planın yok</Text>
            <Text style={styles.emptySubtitle}>Haftalık plan oluştur, her gün ne pişireceğini bil</Text>
          </View>
        )}

        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const itemCount = item._count?.items || item.items?.length || 0;
            const cookedCount = item.items?.filter((i) => i.isCooked).length || 0;
            return (
              <TouchableOpacity style={styles.planCard} onPress={() => handleOpenPlan(item)}>
                <View style={styles.planCardLeft}>
                  <Text style={styles.planName}>{item.name}</Text>
                  <Text style={styles.planMeta}>
                    {formatDateShort(item.startDate)} — {formatDateShort(item.endDate)}
                  </Text>
                  <Text style={styles.planStats}>
                    {itemCount} tarif{itemCount > 0 ? ` · ${cookedCount} pişirildi` : ''}
                  </Text>
                </View>
                <View style={styles.planCardRight}>
                  {itemCount > 0 && (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${(cookedCount / itemCount) * 100}%` }]} />
                    </View>
                  )}
                  <TouchableOpacity onPress={() => handleDeletePlan(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
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
  const byDate = currentPlan?.byDate || {};
  const sortedDates = Object.keys(byDate).sort();

  const sections = sortedDates.map((date) => ({
    title: date,
    data: byDate[date].sort((a, b) => {
      const order = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
      return order.indexOf(a.mealType) - order.indexOf(b.mealType);
    }),
  }));

  const cookedTotal = currentPlan?.items?.filter((i) => i.isCooked).length || 0;
  const totalItems = currentPlan?.items?.length || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setViewMode('list')}>
          <Text style={styles.backBtn}>← Planlar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{currentPlan?.name}</Text>
        <TouchableOpacity onPress={handleGenerateShoppingList}>
          <Text style={{ fontSize: 22 }}>🛒</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      {totalItems > 0 && (
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {cookedTotal}/{totalItems} pişirildi
          </Text>
          <View style={styles.progressBarWide}>
            <View style={[styles.progressFill, { width: `${(cookedTotal / totalItems) * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Day sections */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Plana henüz tarif eklenmemiş</Text>
            <Text style={styles.emptySubtitle}>Tarifler ekranından bir tarife git ve plana ekle</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDate(section.title)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.mealItem, item.isCooked && styles.mealItemCooked]}>
            <TouchableOpacity style={styles.cookCheckbox} onPress={() => handleToggle(item)}>
              <Text style={{ fontSize: 20 }}>{item.isCooked ? '✅' : '⬜'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mealInfo}
              onPress={() => {
                if (item.recipeId) router.push(`/recipe/${item.recipeId}`);
              }}
            >
              <View style={styles.mealTypeRow}>
                <Text style={styles.mealTypeIcon}>{MEAL_TYPE_ICONS[item.mealType] || '🍽️'}</Text>
                <Text style={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[item.mealType] || item.mealType}</Text>
              </View>
              <Text style={[styles.mealTitle, item.isCooked && styles.mealTitleCooked]} numberOfLines={1}>
                {item.recipe?.title || 'Tarif'}
              </Text>
              <View style={styles.mealMeta}>
                {item.recipe?.totalTimeMinutes ? (
                  <Text style={styles.mealMetaText}>⏱ {item.recipe.totalTimeMinutes} dk</Text>
                ) : null}
                {item.recipe?.difficulty ? (
                  <Text style={styles.mealMetaText}>
                    {item.recipe.difficulty === 'Kolay' ? '🟢' : item.recipe.difficulty === 'Orta' ? '🟡' : '🔴'} {item.recipe.difficulty}
                  </Text>
                ) : null}
                {item.servings > 1 && (
                  <Text style={styles.mealMetaText}>👥 {item.servings} kişilik</Text>
                )}
                {item.recipe?.totalCalories ? (
                  <Text style={styles.mealMetaText}>🔥 {Math.round(item.recipe.totalCalories)} kcal</Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 14, color: colors.error }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
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

  // Create button
  createBtn: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  createBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },

  // Create form
  createForm: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  daysLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.xs },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dayChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '22' },
  dayChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  dayChipTextActive: { color: colors.primary, fontWeight: '700' },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  confirmBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  confirmBtnText: { color: colors.textInverse, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },

  // Plan cards
  planCard: {
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
  planCardLeft: { flex: 1 },
  planCardRight: { alignItems: 'flex-end', gap: 6 },
  planName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  planMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  planStats: { fontSize: fontSize.xs, color: colors.primary, marginTop: 2 },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
  },
  progressBarWide: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    marginLeft: spacing.sm,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.success,
    borderRadius: 2,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  statsText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, minWidth: 90 },

  // Date headers
  dateHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dateHeaderText: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },

  // Meal items
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  mealItemCooked: { opacity: 0.55 },
  cookCheckbox: { marginRight: spacing.sm },
  mealInfo: { flex: 1 },
  mealTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  mealTypeIcon: { fontSize: 14 },
  mealTypeLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '600' },
  mealTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  mealTitleCooked: { textDecorationLine: 'line-through', color: colors.textMuted },
  mealMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  mealMetaText: { fontSize: fontSize.xs, color: colors.textSecondary },
});
