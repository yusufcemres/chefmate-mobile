import { useState, useEffect, useRef, useMemo } from 'react';
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
  Alert,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { useInventoryStore } from '../../src/stores/inventory';
import { useScanHandoffStore } from '../../src/stores/scan-handoff';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeContext';

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

interface BarcodeResult {
  source: 'local' | 'openfoodfacts' | 'not_found' | 'error';
  product: {
    id: string;
    productName: string;
    barcode?: string;
    category?: { id: string; name: string };
    caloriesPer100?: number;
    proteinPer100?: number;
    carbsPer100?: number;
    fatPer100?: number;
  } | null;
}

export default function ScanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const [scanMode, setScanMode] = useState<'ai' | 'barcode'>('ai');

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeResult | null>(null);
  const [barcodeQty, setBarcodeQty] = useState('1');
  const [barcodeUnit, setBarcodeUnit] = useState('adet');
  const [barcodeAdding, setBarcodeAdding] = useState(false);

  // AI state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const [detection, setDetection] = useState<DetectionJob | null>(null);
  const [editedItems, setEditedItems] = useState<DetectedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState<'idle' | 'uploading' | 'analyzing' | 'matching'>('idle');
  const [showTips, setShowTips] = useState(true);
  const [quickAddInput, setQuickAddInput] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for scan step indicator
  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [loading]);

  // Consume handoff from "Mutfağımı Keşfet" flow
  const pendingPhotos = useScanHandoffStore((s) => s.pendingPhotos);
  const pendingAutoStart = useScanHandoffStore((s) => s.autoStart);
  useEffect(() => {
    if (pendingPhotos.length === 0) return;
    const first = pendingPhotos[0];
    const rest = pendingPhotos.slice(1);
    const shouldAuto = pendingAutoStart;
    setScanMode('ai');
    setImageUri(first);
    setAdditionalImages(rest);
    setDetection(null);
    setEditedItems([]);
    setError(null);
    useScanHandoffStore.getState().clear();
    if (shouldAuto) {
      setTimeout(() => startDetection(first, rest), 150);
    }
  }, [pendingPhotos]);

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
    // Works on web and native: fetch the local URI, convert blob → base64
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const addMorePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAdditionalImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const addMoreFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAdditionalImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const startDetection = async (overrideUri?: string, overrideExtra?: string[]) => {
    const primary = overrideUri ?? imageUri;
    const extras = overrideExtra ?? additionalImages;
    if (!primary) return;
    setLoading(true);
    setError(null);
    setScanStep('uploading');
    try {
      const base64 = await getBase64(primary);
      setScanStep('analyzing');

      // Start detection job with base64 image
      const res = await api.post<{ data: DetectionJob }>('/ai/inventory-detections', {
        imageBase64: base64,
      });
      const jobId = (res as any).id;

      // If there are additional images, submit them too
      for (const extra of extras) {
        const extraBase64 = await getBase64(extra);
        await api.post('/ai/inventory-detections/' + jobId + '/additional', {
          imageBase64: extraBase64,
        }).catch(() => {}); // best effort
      }

      setScanStep('matching');

      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await api.get<{ data: DetectionJob }>(
          `/ai/inventory-detections/${jobId}`,
        );
        if ((status as any).status === 'DETECTED') {
          setDetection(status as any);
          setEditedItems((status as any).detectedItems || []);
          break;
        }
        if ((status as any).status === 'FAILED') {
          setDetection(status as any);
          setError((status as any).errorMessage || 'Tespit başarısız oldu.');
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
      setScanStep('idle');
    }
  };

  const handleQuickAdd = () => {
    const name = quickAddInput.trim();
    if (!name) return;
    setEditedItems((prev) => [
      ...prev,
      { name, quantity: 1, unit: 'adet', confidence: 1 },
    ]);
    setQuickAddInput('');
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
        `${(result as any).applied} ürün stoğunuza eklendi!${(result as any).skipped > 0 ? `\n${(result as any).skipped} ürün eşleştirilemedi.` : ''}`,
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

  // ===== BARCODE FUNCTIONS =====
  const handleBarcodeLookup = async () => {
    const code = barcodeInput.trim();
    if (!code || code.length < 8) {
      showAlert('Hata', 'Geçerli bir barkod girin (en az 8 hane).');
      return;
    }
    setBarcodeLoading(true);
    setBarcodeResult(null);
    try {
      const res = await api.get<BarcodeResult>(`/products/barcode/${code}`);
      setBarcodeResult(res as any);
    } catch (err: any) {
      showAlert('Hata', err.message || 'Barkod araması başarısız.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleBarcodeAddToInventory = async () => {
    if (!user || !barcodeResult?.product) return;
    setBarcodeAdding(true);
    try {
      await useInventoryStore.getState().addItem(user.id, {
        productId: barcodeResult.product.id,
        quantityDisplay: parseFloat(barcodeQty) || 1,
        displayUnit: barcodeUnit,
      });
      await useInventoryStore.getState().fetchItems(user.id);
      showAlert('Eklendi!', `${barcodeResult.product.productName} stoğunuza eklendi.`);
      setBarcodeResult(null);
      setBarcodeInput('');
      setBarcodeQty('1');
      setBarcodeUnit('adet');
    } catch (err: any) {
      showAlert('Hata', err.message || 'Stoğa eklenemedi.');
    } finally {
      setBarcodeAdding(false);
    }
  };

  const resetBarcode = () => {
    setBarcodeResult(null);
    setBarcodeInput('');
    setBarcodeQty('1');
    setBarcodeUnit('adet');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === 'ai' && styles.modeBtnActive]}
          onPress={() => setScanMode('ai')}
        >
          <MaterialIcons name="photo-camera" size={18} color={scanMode === 'ai' ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, scanMode === 'ai' && styles.modeBtnTextActive]}>AI Tarama</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, scanMode === 'barcode' && styles.modeBtnActive]}
          onPress={() => setScanMode('barcode')}
        >
          <MaterialIcons name="qr-code-scanner" size={18} color={scanMode === 'barcode' ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, scanMode === 'barcode' && styles.modeBtnTextActive]}>Barkod</Text>
        </TouchableOpacity>
      </View>

      {/* ===== BARCODE MODE ===== */}
      {scanMode === 'barcode' && (
        <View style={styles.barcodeSection}>
          {!barcodeResult ? (
            <>
              <Text style={styles.barcodeIcon}>📊</Text>
              <Text style={styles.title}>Barkod ile Ekle</Text>
              <Text style={styles.subtitle}>
                Ürün barkodunu girin, veritabanımızda veya Open Food Facts'te arayalım
              </Text>
              <TextInput
                style={styles.barcodeInput}
                placeholder="Barkod numarası (EAN/UPC)..."
                placeholderTextColor={colors.textMuted}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                keyboardType="number-pad"
                maxLength={15}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, barcodeLoading && styles.disabled]}
                onPress={handleBarcodeLookup}
                disabled={barcodeLoading}
              >
                {barcodeLoading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.primaryBtnText}>Barkodu Ara</Text>
                )}
              </TouchableOpacity>
            </>
          ) : barcodeResult.source === 'not_found' ? (
            <>
              <Text style={styles.barcodeIcon}>🔍</Text>
              <Text style={styles.title}>Ürün Bulunamadı</Text>
              <Text style={styles.subtitle}>
                Bu barkod veritabanlarımızda kayıtlı değil. Manuel olarak ekleyebilirsiniz.
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetBarcode}>
                <Text style={styles.secondaryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </>
          ) : barcodeResult.product ? (
            <>
              <View style={styles.barcodeResultCard}>
                <View style={styles.barcodeSourceBadge}>
                  <Text style={styles.barcodeSourceText}>
                    {barcodeResult.source === 'local' ? '📦 Yerel DB' : '🌍 Open Food Facts'}
                  </Text>
                </View>
                <Text style={styles.barcodeProductName}>{barcodeResult.product.productName}</Text>
                {barcodeResult.product.category && (
                  <Text style={styles.barcodeCategory}>{barcodeResult.product.category.name}</Text>
                )}
                {barcodeResult.product.caloriesPer100 != null && (
                  <View style={styles.barcodeNutrition}>
                    <Text style={styles.barcodeNutText}>🔥 {Math.round(barcodeResult.product.caloriesPer100)} kcal</Text>
                    {barcodeResult.product.proteinPer100 != null && (
                      <Text style={styles.barcodeNutText}>💪 {barcodeResult.product.proteinPer100.toFixed(1)}g</Text>
                    )}
                    {barcodeResult.product.carbsPer100 != null && (
                      <Text style={styles.barcodeNutText}>🌾 {barcodeResult.product.carbsPer100.toFixed(1)}g</Text>
                    )}
                    {barcodeResult.product.fatPer100 != null && (
                      <Text style={styles.barcodeNutText}>🫒 {barcodeResult.product.fatPer100.toFixed(1)}g</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.barcodeQtyRow}>
                <TextInput
                  style={[styles.barcodeQtyInput, { flex: 1 }]}
                  placeholder="Miktar"
                  placeholderTextColor={colors.textMuted}
                  value={barcodeQty}
                  onChangeText={setBarcodeQty}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.barcodeQtyInput, { flex: 1 }]}
                  placeholder="Birim"
                  placeholderTextColor={colors.textMuted}
                  value={barcodeUnit}
                  onChangeText={setBarcodeUnit}
                />
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, barcodeAdding && styles.disabled]}
                onPress={handleBarcodeAddToInventory}
                disabled={barcodeAdding}
              >
                <Text style={styles.primaryBtnText}>
                  {barcodeAdding ? 'Ekleniyor...' : 'Stoğuma Ekle'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={resetBarcode}>
                <Text style={styles.secondaryBtnText}>Başka Barkod</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      )}

      {/* ===== AI MODE ===== */}
      {scanMode === 'ai' && !imageUri ? (
        <View style={styles.pickSection}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.title}>Mutfağını Tara</Text>
          <Text style={styles.subtitle}>
            Buzdolabı veya tezgah fotoğrafı çek, AI malzemelerini tanısın
          </Text>

          {/* Scan Tips */}
          {showTips && (
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeader}>
                <MaterialIcons name="lightbulb" size={18} color={colors.warning} />
                <Text style={styles.tipsTitle}>Daha iyi sonuç için</Text>
                <TouchableOpacity onPress={() => setShowTips(false)}>
                  <MaterialIcons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>💡</Text>
                <Text style={styles.tipText}>İyi aydınlatılmış ortamda çekin</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>📐</Text>
                <Text style={styles.tipText}>Buzdolabı kapağını tamamen açın</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>🔍</Text>
                <Text style={styles.tipText}>Etiketlerin görünmesine dikkat edin</Text>
              </View>
              <View style={styles.tipRow}>
                <Text style={styles.tipEmoji}>📸</Text>
                <Text style={styles.tipText}>Birden fazla raf için çoklu fotoğraf ekleyin</Text>
              </View>
            </View>
          )}

          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.discoverBtn} onPress={() => router.push('/scan/discover')}>
              <MaterialIcons name="auto-awesome" size={22} color={colors.textInverse} />
              <View style={styles.discoverTextWrap}>
                <Text style={styles.discoverTitle}>Mutfağımı Keşfet</Text>
                <Text style={styles.discoverSub}>3 adımda rehberli çekim — en iyi sonuç</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textInverse} />
            </TouchableOpacity>
          )}
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
              <MaterialIcons name="camera-alt" size={18} color={colors.textSecondary} />
              <Text style={styles.secondaryBtnText}> Tek Fotoğraf Çek</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery}>
            <MaterialIcons name="photo-library" size={18} color={colors.textSecondary} />
            <Text style={styles.secondaryBtnText}> Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      ) : scanMode === 'ai' ? (
        <View style={styles.resultSection}>
          {/* Photo preview row */}
          <View style={styles.photoRow}>
            <Image source={{ uri: imageUri || undefined }} style={styles.preview} />
            {additionalImages.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.previewSmall} />
            ))}
            {!detection && !loading && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={Platform.OS !== 'web' ? addMorePhoto : addMoreFromGallery}>
                <MaterialIcons name="add-a-photo" size={24} color={colors.primary} />
                <Text style={styles.addPhotoText}>Raf ekle</Text>
              </TouchableOpacity>
            )}
          </View>

          {!detection && !loading && !error && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => startDetection()}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.textInverse} />
              <Text style={styles.primaryBtnText}> AI ile Tara {additionalImages.length > 0 ? `(${1 + additionalImages.length} fotoğraf)` : ''}</Text>
            </TouchableOpacity>
          )}

          {/* Step-by-step progress */}
          {loading && (
            <View style={styles.scanProgress}>
              <View style={styles.scanStepRow}>
                <Animated.View style={[styles.scanStepDot, scanStep === 'uploading' && styles.scanStepDotActive, { opacity: scanStep === 'uploading' ? pulseAnim : 1 }]}>
                  <MaterialIcons name={scanStep === 'uploading' ? 'cloud-upload' : 'check'} size={16} color={scanStep === 'uploading' || scanStep === 'analyzing' || scanStep === 'matching' ? '#fff' : colors.textMuted} />
                </Animated.View>
                <Text style={[styles.scanStepLabel, scanStep === 'uploading' && styles.scanStepLabelActive]}>Fotoğraf yükleniyor</Text>
              </View>
              <View style={styles.scanStepRow}>
                <Animated.View style={[styles.scanStepDot, scanStep === 'analyzing' && styles.scanStepDotActive, { opacity: scanStep === 'analyzing' ? pulseAnim : 1 }]}>
                  <MaterialIcons name={scanStep === 'analyzing' ? 'psychology' : (scanStep === 'matching' ? 'check' : 'more-horiz')} size={16} color={scanStep === 'analyzing' || scanStep === 'matching' ? '#fff' : colors.textMuted} />
                </Animated.View>
                <Text style={[styles.scanStepLabel, scanStep === 'analyzing' && styles.scanStepLabelActive]}>AI analiz ediyor</Text>
              </View>
              <View style={styles.scanStepRow}>
                <Animated.View style={[styles.scanStepDot, scanStep === 'matching' && styles.scanStepDotActive, { opacity: scanStep === 'matching' ? pulseAnim : 1 }]}>
                  <MaterialIcons name={scanStep === 'matching' ? 'inventory' : 'more-horiz'} size={16} color={scanStep === 'matching' ? '#fff' : colors.textMuted} />
                </Animated.View>
                <Text style={[styles.scanStepLabel, scanStep === 'matching' && styles.scanStepLabelActive]}>Ürünler eşleştiriliyor</Text>
              </View>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => startDetection()}>
                <Text style={styles.retryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}

          {detection && detection.status === 'DETECTED' && (
            <View style={styles.detectionResults}>
              {/* Summary stats */}
              <View style={styles.scanSummary}>
                <View style={styles.scanSumItem}>
                  <Text style={styles.scanSumNum}>{editedItems.length}</Text>
                  <Text style={styles.scanSumLabel}>Ürün</Text>
                </View>
                <View style={styles.scanSumItem}>
                  <Text style={[styles.scanSumNum, { color: colors.success }]}>
                    {editedItems.filter((i) => i.confidence > 0.8).length}
                  </Text>
                  <Text style={styles.scanSumLabel}>Kesin</Text>
                </View>
                <View style={styles.scanSumItem}>
                  <Text style={[styles.scanSumNum, { color: colors.warning }]}>
                    {editedItems.filter((i) => i.confidence <= 0.8).length}
                  </Text>
                  <Text style={styles.scanSumLabel}>Kontrol</Text>
                </View>
              </View>

              {editedItems.map((item, i) => (
                <View key={i} style={[styles.detectedItem, item.confidence <= 0.5 && styles.detectedItemLow]}>
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

              {/* Quick add for missed items */}
              <View style={styles.quickAddRow}>
                <TextInput
                  style={styles.quickAddInput}
                  placeholder="AI kaçırdı mı? Ürün adı yazın..."
                  placeholderTextColor={colors.textMuted}
                  value={quickAddInput}
                  onChangeText={setQuickAddInput}
                  onSubmitEditing={handleQuickAdd}
                />
                <TouchableOpacity style={styles.quickAddBtn} onPress={handleQuickAdd}>
                  <MaterialIcons name="add" size={20} color={colors.onPrimary} />
                </TouchableOpacity>
              </View>

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

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { resetAll(); setAdditionalImages([]); }}>
            <Text style={styles.secondaryBtnText}>Yeni Fotoğraf</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    width: '100%',
    marginTop: spacing.sm,
  },
  discoverTextWrap: { flex: 1 },
  discoverTitle: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: fontSize.lg,
  },
  discoverSub: {
    color: colors.textInverse,
    opacity: 0.85,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  resultSection: { padding: spacing.md },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  preview: {
    width: 180,
    height: 220,
    borderRadius: borderRadius.lg,
  },
  previewSmall: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
  },
  addPhotoBtn: {
    width: 80,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary + '08',
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },

  // Tips
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tipsTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  tipEmoji: { fontSize: 14 },
  tipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Scan progress steps
  scanProgress: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  scanStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanStepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanStepDotActive: {
    backgroundColor: colors.primary,
  },
  scanStepLabel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  scanStepLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },

  // Scan summary
  scanSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  scanSumItem: {
    alignItems: 'center',
  },
  scanSumNum: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.primary,
  },
  scanSumLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Quick add
  quickAddRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  quickAddInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  quickAddBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  detectedItemLow: {
    borderWidth: 1,
    borderColor: colors.error + '40',
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

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.textInverse,
  },

  // Barcode
  barcodeSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  barcodeIcon: { fontSize: 64, textAlign: 'center' },
  barcodeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 2,
    width: '100%',
    marginBottom: spacing.sm,
  },
  barcodeResultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  barcodeSourceBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  barcodeSourceText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  barcodeProductName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  barcodeCategory: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  barcodeNutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  barcodeNutText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  barcodeQtyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginBottom: spacing.sm,
  },
  barcodeQtyInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'center',
  },
});
