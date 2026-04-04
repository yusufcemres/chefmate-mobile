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
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../src/api/client';
import { colors, spacing, fontSize, borderRadius } from '../src/theme';
import type { Household, InventoryItem } from '../src/types';

export default function HouseholdsScreen() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'inventory'>('list');
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [sharedInventory, setSharedInventory] = useState<InventoryItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [addEmail, setAddEmail] = useState('');

  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/households');
      setHouseholds(res.data || res || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchHouseholds(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/households', { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      await fetchHouseholds();
    } catch (err: any) {
      const msg = err.message || 'Hata';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    }
  };

  const handleOpenHousehold = async (h: Household) => {
    try {
      const res = await api.get<any>(`/households/${h.id}`);
      setSelectedHousehold(res.data || res);
      setViewMode('detail');
    } catch { }
  };

  const handleViewInventory = async () => {
    if (!selectedHousehold) return;
    try {
      const res = await api.get<any>(`/households/${selectedHousehold.id}/inventory`);
      setSharedInventory(res.data || res || []);
      setViewMode('inventory');
    } catch { }
  };

  const handleAddMember = async () => {
    // In a real app we'd search by email, but API takes userId
    // For now show a simple prompt
    if (!addEmail.trim() || !selectedHousehold) return;
    try {
      await api.post(`/households/${selectedHousehold.id}/members`, { userId: addEmail.trim() });
      setAddEmail('');
      await handleOpenHousehold(selectedHousehold);
    } catch (err: any) {
      const msg = err.message || 'Kullanıcı eklenemedi';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedHousehold) return;
    const doRemove = async () => {
      try {
        await api.delete(`/households/${selectedHousehold.id}/members/${memberId}`);
        await handleOpenHousehold(selectedHousehold);
      } catch (err: any) {
        const msg = err.message || 'Hata';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
      }
    };
    Platform.OS === 'web'
      ? window.confirm('Üyeyi çıkarmak istediğinize emin misiniz?') && doRemove()
      : Alert.alert('Üyeyi Çıkar', 'Emin misiniz?', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Çıkar', style: 'destructive', onPress: doRemove },
        ]);
  };

  const handleDelete = async () => {
    if (!selectedHousehold) return;
    const doDelete = async () => {
      try {
        await api.delete(`/households/${selectedHousehold.id}`);
        setViewMode('list');
        await fetchHouseholds();
      } catch (err: any) {
        const msg = err.message || 'Hata';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Hata', msg);
      }
    };
    Platform.OS === 'web'
      ? window.confirm('Haneyi silmek istediğinize emin misiniz?') && doDelete()
      : Alert.alert('Haneyi Sil', 'Tüm üyeler çıkarılacak. Emin misiniz?', [
          { text: 'İptal', style: 'cancel' },
          { text: 'Sil', style: 'destructive', onPress: doDelete },
        ]);
  };

  // ===== SHARED INVENTORY =====
  if (viewMode === 'inventory') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('detail')}>
            <Text style={styles.backBtn}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ortak Stok</Text>
          <View style={{ width: 60 }} />
        </View>
        <FlatList
          data={sharedInventory}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40 }}>📦</Text>
              <Text style={styles.emptyTitle}>Stokta ürün yok</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={styles.invRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invName}>{item.product?.productName || 'Ürün'}</Text>
                <Text style={styles.invOwner}>{item.user?.displayName}</Text>
              </View>
              <Text style={styles.invQty}>{item.quantityDisplay} {item.displayUnit}</Text>
            </View>
          )}
        />
      </View>
    );
  }

  // ===== DETAIL =====
  if (viewMode === 'detail' && selectedHousehold) {
    const isOwner = selectedHousehold.myRole === 'OWNER';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('list')}>
            <Text style={styles.backBtn}>← Haneler</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedHousehold.name}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleViewInventory}>
          <Text style={styles.actionBtnText}>Ortak Stoğu Gör</Text>
        </TouchableOpacity>

        {/* Members */}
        <Text style={styles.sectionTitle}>Üyeler ({selectedHousehold.members?.length || 0})</Text>
        {selectedHousehold.members?.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{m.user.displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.user.displayName}</Text>
              <Text style={styles.memberRole}>{m.role === 'OWNER' ? 'Sahip' : 'Üye'}</Text>
            </View>
            {isOwner && m.role !== 'OWNER' && (
              <TouchableOpacity onPress={() => handleRemoveMember(m.userId)}>
                <Text style={{ color: colors.error, fontSize: 14 }}>Çıkar</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add Member */}
        {isOwner && (
          <View style={styles.addMemberRow}>
            <TextInput
              style={styles.addMemberInput}
              placeholder="Kullanıcı ID..."
              placeholderTextColor={colors.textMuted}
              value={addEmail}
              onChangeText={setAddEmail}
            />
            <TouchableOpacity style={styles.addMemberBtn} onPress={handleAddMember}>
              <Text style={styles.addMemberBtnText}>Ekle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete */}
        {isOwner && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Haneyi Sil</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ===== LIST =====
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Profil</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hanelerim</Text>
        <TouchableOpacity onPress={() => setShowCreate(!showCreate)}>
          <Text style={{ fontSize: 24 }}>➕</Text>
        </TouchableOpacity>
      </View>

      {showCreate && (
        <View style={styles.createForm}>
          <TextInput
            style={styles.createInput}
            placeholder="Hane adı (ör: Ev)"
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Oluştur</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      )}

      {!loading && households.length === 0 && !showCreate && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>🏠</Text>
          <Text style={styles.emptyTitle}>Henüz bir hane yok</Text>
          <Text style={styles.emptySubtitle}>Hane oluşturup aile üyelerini ekleyin, stoğu paylaşın</Text>
        </View>
      )}

      <FlatList
        data={households}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchHouseholds} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.householdCard} onPress={() => handleOpenHousehold(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.householdName}>{item.name}</Text>
              <Text style={styles.householdMeta}>
                {item.members?.length || 0} üye · {item.myRole === 'OWNER' ? 'Sahip' : 'Üye'}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.textMuted }}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  backBtn: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },

  // Create
  createForm: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  createInput: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.sm, fontSize: fontSize.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  createBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, justifyContent: 'center' },
  createBtnText: { color: colors.textInverse, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  emptySubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },

  // Household cards
  householdCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.borderLight },
  householdName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  householdMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  // Detail
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  actionBtn: { backgroundColor: colors.secondary, marginHorizontal: spacing.md, marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  actionBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.xs, padding: spacing.sm, borderRadius: borderRadius.sm },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  memberAvatarText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
  memberName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  memberRole: { fontSize: fontSize.xs, color: colors.textMuted },

  // Add member
  addMemberRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  addMemberInput: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.sm, padding: spacing.sm, fontSize: fontSize.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  addMemberBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, justifyContent: 'center' },
  addMemberBtnText: { color: colors.textInverse, fontWeight: '700' },

  // Delete
  deleteBtn: { marginHorizontal: spacing.md, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.error, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  deleteBtnText: { color: colors.error, fontWeight: '700' },

  // Shared inventory
  invRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.xs, padding: spacing.sm, borderRadius: borderRadius.sm },
  invName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  invOwner: { fontSize: fontSize.xs, color: colors.textMuted },
  invQty: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
});
