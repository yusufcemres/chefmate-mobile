import { useEffect, useState, useCallback } from 'react';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
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
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMealPlanStore } from '../src/stores/meal-plans';
import { api } from '../src/api/client';
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

function MealPlansScreen() {
  const { plans, currentPlan, loading, fetchPlans, fetchPlan, createPlan, toggleCooked, removeItem, deletePlan, generateShoppingList } = useMealPlanStore();

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDays, setPlanDays] = useState('7');

  // AI plan generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDays, setAiDays] = useState('7');
  const [aiServings, setAiServings] = useState('2');
  const [aiCalories, setAiCalories] = useState('');
  const [aiMeals, setAiMeals] = useState<string[]>(['BREAKFAST', 'LUNCH', 'DINNER']);
  const [aiPreferences, setAiPreferences] = useState('');
  const [aiUseInventory, setAiUseInventory] = useState(true);

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

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    try {
      const body: any = {
        days: parseInt(aiDays) || 7,
        servings: parseInt(aiServings) || 2,
        mealTypes: aiMeals,
        useInventory: aiUseInventory,
      };
      if (aiCalories) body.dailyCalorieTarget = parseInt(aiCalories);
      if (aiPreferences.trim()) body.preferences = aiPreferences.trim();

      const res = await api.post<any>('/meal-plans/ai-generate', body);
      const plan = (res as any).plan;
      setShowAiModal(false);
      await fetchPlans();
      if (plan?.id) {
        await fetchPlan(plan.id);
        setViewMode('detail');
      }
      const msg = `${(res as any).summary?.totalMeals || 0} öğünlük AI plan oluşturuldu!`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('AI Plan Hazır!', msg);
    } catch (err: any) {
      const msg = err.message || 'AI plan oluşturulamadı.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleAiMeal = (meal: string) => {
    setAiMeals((prev) =>
      prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal],
    );
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
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Geri dön">
            <Text style={styles.backBtn}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Yemek Planlarım</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.createBtn, { flex: 1 }]} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ Yeni Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.aiBtn]} onPress={() => setShowAiModal(true)}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.textInverse} />
            <Text style={styles.aiBtnText}>AI Plan</Text>
          </TouchableOpacity>
        </View>

        {/* AI Plan Modal */}
        <Modal visible={showAiModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.aiModal}>
              <View style={styles.aiModalHeader}>
                <MaterialIcons name="auto-awesome" size={22} color={colors.primary} />
                <Text style={styles.aiModalTitle}>AI Haftalık Plan</Text>
                <TouchableOpacity onPress={() => setShowAiModal(false)}>
                  <MaterialIcons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {/* Days */}
                <Text style={styles.aiLabel}>Kaç gün?</Text>
                <View style={styles.daysRow}>
                  {['3', '5', '7', '14'].map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, aiDays === d && styles.dayChipActive]}
                      onPress={() => setAiDays(d)}
                    >
                      <Text style={[styles.dayChipText, aiDays === d && styles.dayChipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Servings */}
                <Text style={styles.aiLabel}>Kişi sayısı</Text>
                <View style={styles.daysRow}>
                  {['1', '2', '3', '4', '6'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.dayChip, aiServings === s && styles.dayChipActive]}
                      onPress={() => setAiServings(s)}
                    >
                      <Text style={[styles.dayChipText, aiServings === s && styles.dayChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Meal types */}
                <Text style={styles.aiLabel}>Öğünler</Text>
                <View style={styles.daysRow}>
                  {(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.dayChip, aiMeals.includes(m) && styles.dayChipActive]}
                      onPress={() => toggleAiMeal(m)}
                    >
                      <Text style={[styles.dayChipText, aiMeals.includes(m) && styles.dayChipTextActive]}>
                        {MEAL_TYPE_ICONS[m]} {MEAL_TYPE_LABELS[m]?.slice(0, 6)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Calorie target */}
                <Text style={styles.aiLabel}>Günlük kalori hedefi (isteğe bağlı)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ör. 2000"
                  placeholderTextColor={colors.textMuted}
                  value={aiCalories}
                  onChangeText={setAiCalories}
                  keyboardType="numeric"
                />

                {/* Preferences */}
                <Text style={styles.aiLabel}>Tercihler (isteğe bağlı)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  placeholder="ör. Akdeniz mutfağı, hafif tarifler..."
                  placeholderTextColor={colors.textMuted}
                  value={aiPreferences}
                  onChangeText={setAiPreferences}
                  multiline
                />

                {/* Use inventory toggle */}
                <TouchableOpacity
                  style={styles.aiToggleRow}
                  onPress={() => setAiUseInventory(!aiUseInventory)}
                >
                  <MaterialIcons
                    name={aiUseInventory ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={aiUseInventory ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.aiToggleText}>Stoktaki malzemeleri öncelikle kullan</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmBtn, { marginTop: spacing.md }, aiGenerating && { opacity: 0.5 }]}
                onPress={handleAiGenerate}
                disabled={aiGenerating}
              >
                {aiGenerating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color={colors.textInverse} size="small" />
                    <Text style={styles.confirmBtnText}>AI plan oluşturuyor...</Text>
                  </View>
                ) : (
                  <Text style={styles.confirmBtnText}>AI ile Plan Oluştur</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
                  <TouchableOpacity onPress={() => handleDeletePlan(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Planı sil">
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
  const [detailMode, setDetailMode] = useState<'grid' | 'list'>('grid');
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

  const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
  const DAY_LABELS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const renderGridView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Column headers (days) */}
      <View style={styles.gridHeaderRow}>
        <View style={styles.gridMealLabel} />
        {sortedDates.map((date) => {
          const d = new Date(date);
          const dayIdx = (d.getDay() + 6) % 7; // Monday = 0
          const isToday = new Date().toISOString().split('T')[0] === date;
          return (
            <View key={date} style={[styles.gridDayHeader, isToday && styles.gridDayHeaderToday]}>
              <Text style={[styles.gridDayName, isToday && { color: colors.primary }]}>{DAY_LABELS_SHORT[dayIdx]}</Text>
              <Text style={[styles.gridDayNum, isToday && { color: colors.primary }]}>{d.getDate()}</Text>
            </View>
          );
        })}
      </View>

      {/* Rows (meal types) */}
      {MEAL_ORDER.map((meal) => (
        <View key={meal} style={styles.gridRow}>
          <View style={styles.gridMealLabel}>
            <Text style={styles.gridMealEmoji}>{MEAL_TYPE_ICONS[meal]}</Text>
            <Text style={styles.gridMealText}>{MEAL_TYPE_LABELS[meal]?.substring(0, 6)}</Text>
          </View>
          {sortedDates.map((date) => {
            const items = (byDate[date] || []).filter((i) => i.mealType === meal);
            return (
              <View key={date} style={styles.gridCell}>
                {items.length > 0 ? items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.gridCellCard, item.isCooked && styles.gridCellCardCooked]}
                    onPress={() => { if (item.recipeId) router.push(`/recipe/${item.recipeId}`); }}
                    onLongPress={() => handleToggle(item)}
                  >
                    <Text style={styles.gridCellTitle} numberOfLines={2}>
                      {item.recipe?.title || 'Tarif'}
                    </Text>
                    {item.isCooked && (
                      <MaterialIcons name="check-circle" size={12} color={colors.success} style={{ marginTop: 2 }} />
                    )}
                  </TouchableOpacity>
                )) : (
                  <View style={styles.gridCellEmpty}>
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>·</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );

  const renderListView = () => (
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
        <View style={styles.dateHeader} accessibilityRole="header">
          <Text style={styles.dateHeaderText}>{formatDate(section.title)}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={[styles.mealItem, item.isCooked && styles.mealItemCooked]} accessibilityLabel={(MEAL_TYPE_LABELS[item.mealType] || item.mealType) + ' - ' + (item.recipe?.title || 'Tarif')}>
          <TouchableOpacity style={styles.cookCheckbox} onPress={() => handleToggle(item)} accessibilityRole="checkbox" accessibilityState={{ checked: item.isCooked }} accessibilityLabel={item.isCooked ? 'Pişirildi olarak işaretli' : 'Pişirilmedi olarak işaretli'}>
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
          <TouchableOpacity onPress={() => handleRemoveItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Tarifi plandan kaldır">
            <Text style={{ fontSize: 14, color: colors.error }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setViewMode('list')} accessibilityRole="button" accessibilityLabel="Planlara dön">
          <Text style={styles.backBtn}>← Planlar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{currentPlan?.name}</Text>
        <TouchableOpacity onPress={handleGenerateShoppingList} accessibilityRole="button" accessibilityLabel="Alışveriş listesi oluştur">
          <Text style={{ fontSize: 22 }}>🛒</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar + view toggle */}
      <View style={styles.statsBar}>
        {totalItems > 0 && (
          <>
            <Text style={styles.statsText}>
              {cookedTotal}/{totalItems} pişirildi
            </Text>
            <View style={styles.progressBarWide}>
              <View style={[styles.progressFill, { width: `${(cookedTotal / totalItems) * 100}%` }]} />
            </View>
          </>
        )}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, detailMode === 'grid' && styles.viewToggleBtnActive]}
            onPress={() => setDetailMode('grid')}
          >
            <MaterialIcons name="grid-view" size={18} color={detailMode === 'grid' ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, detailMode === 'list' && styles.viewToggleBtnActive]}
            onPress={() => setDetailMode('list')}
          >
            <MaterialIcons name="view-list" size={18} color={detailMode === 'list' ? colors.primary : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {sortedDates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>Plana henüz tarif eklenmemiş</Text>
          <Text style={styles.emptySubtitle}>Tarifler ekranından bir tarife git ve plana ekle</Text>
        </View>
      ) : detailMode === 'grid' ? renderGridView() : renderListView()}
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

  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  createBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  createBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
  aiBtn: {
    backgroundColor: '#7C3AED',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  aiBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },

  // AI Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aiModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  aiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  aiModalTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
  },
  aiLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  aiToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  aiToggleText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },

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

  // Grid view
  gridHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  gridMealLabel: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  gridDayHeaderToday: {
    backgroundColor: colors.primary + '18',
  },
  gridDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  gridDayNum: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    minHeight: 64,
    marginBottom: 2,
  },
  gridMealEmoji: {
    fontSize: 16,
  },
  gridMealText: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  gridCell: {
    flex: 1,
    padding: 2,
    minHeight: 56,
  },
  gridCellCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: 4,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellCardCooked: {
    backgroundColor: colors.success + '14',
    borderColor: colors.success + '40',
  },
  gridCellTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  gridCellEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },

  // View toggle
  viewToggle: {
    flexDirection: 'row',
    marginLeft: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    padding: 6,
    backgroundColor: colors.background,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.primary + '18',
  },
});

export default withScreenErrorBoundary(MealPlansScreen, 'Yemek Planı');
