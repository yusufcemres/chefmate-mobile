import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';

interface DetectedItem {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
}

interface DetectionJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'DETECTED' | 'APPLIED' | 'FAILED';
  detectedItems: DetectedItem[];
  errorMessage?: string;
}

export default function ScanScreen() {
  const user = useAuthStore((s) => s.user);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionJob | null>(null);
  const [editedItems, setEditedItems] = useState<DetectedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else {
      const { Alert } = require('react-native');
      Alert.alert(title, msg);
    }
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('İzin Gerekli', 'Kamera izni verilmedi.');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setDetection(null);
      setEditedItems([]);
      setError(null);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setDetection(null);
      setEditedItems([]);
      setError(null);
    }
  };

  const getBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      // Web: fetch blob and convert
      const res = await fetch(uri);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:image/...;base64, prefix
          resolve(result.split(',')[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // Native: use FileSystem
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  };

  const startDetection = async () => {
    if (!imageUri) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = await getBase64(imageUri);

      // Start detection job with base64 image
      const res = await api.post<{ data: DetectionJob }>('/ai/inventory-detections', {
        imageBase64: base64,
      });
      const jobId = res.data.id;

      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await api.get<{ data: DetectionJob }>(
          `/ai/inventory-detections/${jobId}`,
        );
        if (status.data.status === 'DETECTED') {
          setDetection(status.data);
          setEditedItems(status.data.detectedItems || []);
          break;
        }
        if (status.data.status === 'FAILED') {
          setDetection(status.data);
          setError(status.data.errorMessage || 'Tespit başarısız oldu.');
          break;
        }
        attempts++;
      }
      if (attempts >= 30) {
        setError('Zaman aşımı. Lütfen tekrar deneyin.');
      }
    } catch (err: any) {
      setError(err.message || 'Tespit başlatılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof DetectedItem, value: any) => {
    const updated = [...editedItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditedItems(updated);
  };

  const removeItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index));
  };

  const applyToInventory = async () => {
    if (!detection || !user || editedItems.length === 0) return;
    setApplying(true);
    try {
      // Submit corrections if user edited items
      await api.post(`/ai/inventory-detections/${detection.id}/manual-corrections`, {
        items: editedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });

      // Apply to inventory
      const result = await api.post<{
        data: { applied: number; skipped: number };
      }>(`/ai/inventory-detections/${detection.id}/apply`);

      await useInventoryStore.getState().fetchItems(user.id);
      showAlert(
        'Tamamlandı',
        `${result.data.applied} ürün stoğunuza eklendi!${result.data.skipped > 0 ? `\n${result.data.skipped} ürün eşleştirilemedi.` : ''}`,
      );
      setDetection(null);
      setImageUri(null);
      setEditedItems([]);
    } catch (err: any) {
      showAlert('Hata', err.message);
    } finally {
      setApplying(false);
    }
  };

  const resetAll = () => {
    setImageUri(null);
    setDetection(null);
    setEditedItems([]);
    setError(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!imageUri ? (
        <View style={styles.pickSection}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.title}>Mutfağını Tara</Text>
          <Text style={styles.subtitle}>
            Fotoğraf çek veya galeriden seç, AI malzemelerini tanısın
          </Text>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={pickImage}>
              <Text style={styles.primaryBtnText}>Fotoğraf Çek</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery}>
            <Text style={styles.secondaryBtnText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultSection}>
          <Image source={{ uri: imageUri }} style={styles.preview} />

          {!detection && !loading && !error && (
            <TouchableOpacity style={styles.primaryBtn} onPress={startDetection}>
              <Text style={styles.primaryBtnText}>AI ile Tara</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>AI analiz ediyor...</Text>
              <Text style={styles.loadingSubtext}>Bu birkaç saniye sürebilir</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={startDetection}>
                <Text style={styles.retryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}

          {detection && detection.status === 'DETECTED' && editedItems.length > 0 && (
            <View style={styles.detectionResults}>
              <Text style={styles.resultTitle}>
                {editedItems.length} ürün tespit edildi
              </Text>
              {editedItems.map((item, i) => (
                <View key={i} style={styles.detectedItem}>
                  <View style={styles.detectedMain}>
                    <TextInput
                      style={styles.nameInput}
                      value={item.name}
                      onChangeText={(v) => updateItem(i, 'name', v)}
                    />
                    <View style={styles.qtyRow}>
                      <TextInput
                        style={styles.qtyInput}
                        value={String(item.quantity)}
                        keyboardType="numeric"
                        onChangeText={(v) =>
                          updateItem(i, 'quantity', parseFloat(v) || 0)
                        }
                      />
                      <TextInput
                        style={styles.unitInput}
                        value={item.unit}
                        onChangeText={(v) => updateItem(i, 'unit', v)}
                      />
                      <View
                        style={[
                          styles.confidenceBadge,
                          {
                            backgroundColor:
                              item.confidence > 0.8
                                ? colors.success
                                : item.confidence > 0.5
                                  ? colors.warning
                                  : colors.error,
                          },
                        ]}
                      >
                        <Text style={styles.confidenceText}>
                          %{Math.round(item.confidence * 100)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeItem(i)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.primaryBtn, applying && styles.disabled]}
                onPress={applyToInventory}
                disabled={applying}
              >
                <Text style={styles.primaryBtnText}>
                  {applying ? 'Ekleniyor...' : `Stoğuma Ekle (${editedItems.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={resetAll}>
            <Text style={styles.secondaryBtnText}>Yeni Fotoğraf</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  pickSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    minHeight: 400,
  },
  icon: { fontSize: 64, textAlign: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  resultSection: { padding: spacing.md },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  loadingBox: { alignItems: 'center', paddingVertical: spacing.xl },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  detectionResults: { marginBottom: spacing.md },
  resultTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
    color: colors.text,
  },
  detectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  detectedMain: { flex: 1 },
  nameInput: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 2,
    marginBottom: 4,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyInput: {
    width: 50,
    fontSize: fontSize.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
  },
  unitInput: {
    width: 50,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
  },
  confidenceBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 4,
  },
  confidenceText: {
    color: colors.textInverse,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  removeBtn: {
    marginLeft: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBox: {
    padding: spacing.md,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  retryBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
