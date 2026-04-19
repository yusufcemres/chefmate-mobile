import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, fontSize, borderRadius, fonts, type ThemeColors } from '../../src/theme';
import { useScanHandoffStore } from '../../src/stores/scan-handoff';

interface Step {
  key: string;
  title: string;
  hint: string;
  icon: 'kitchen' | 'ac-unit' | 'shopping-basket';
}

const STEPS: Step[] = [
  { key: 'pantry', title: 'Dolap Rafları', hint: 'Dolabını aç, tüm rafları çerçeveye al', icon: 'kitchen' },
  { key: 'fridge', title: 'Buzdolabı', hint: 'Buzdolabını aç, iç rafları göster', icon: 'ac-unit' },
  { key: 'counter', title: 'Tezgah & Sepet', hint: 'Tezgahtaki veya sepetteki malzemeleri çek', icon: 'shopping-basket' },
];

const STABILITY_THRESHOLD = 0.04;

export default function DiscoverScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [stable, setStable] = useState(false);
  const [stabilityWarning, setStabilityWarning] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const lastValuesRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const stableSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const last = lastValuesRef.current;
      if (last) {
        const delta = Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z);
        if (delta < STABILITY_THRESHOLD) {
          if (!stableSinceRef.current) stableSinceRef.current = Date.now();
          else if (Date.now() - stableSinceRef.current > 400) setStable(true);
        } else {
          stableSinceRef.current = null;
          setStable(false);
        }
      }
      lastValuesRef.current = { x, y, z };
    });
    return () => sub.remove();
  }, []);

  const step = STEPS[stepIndex];
  const isReview = stepIndex >= STEPS.length;

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    if (!stable) {
      setStabilityWarning(true);
      setTimeout(() => setStabilityWarning(false), 1500);
      return;
    }
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (photo?.uri) {
        const next = [...photos, photo.uri];
        setPhotos(next);
        setStepIndex((i) => i + 1);
        stableSinceRef.current = null;
        setStable(false);
      }
    } catch {
    } finally {
      setCapturing(false);
    }
  };

  const retakeStep = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setStepIndex(idx);
  };

  const sendForAnalysis = () => {
    useScanHandoffStore.getState().setPending(photos, true);
    router.replace('/(tabs)/scan');
  };

  const cancel = () => {
    router.back();
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Mutfağımı Keşfet', headerShown: true }} />
        <MaterialIcons name="no-photography" size={56} color={colors.textMuted} />
        <Text style={styles.permTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permBody}>Mutfağını taramak için kameraya erişim iste.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isReview) {
    return (
      <View style={styles.reviewRoot}>
        <Stack.Screen options={{ title: 'Önizleme', headerShown: true, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text }} />
        <ScrollView contentContainerStyle={styles.reviewScroll}>
          <Text style={styles.reviewTitle}>3 kare yakaladın</Text>
          <Text style={styles.reviewSubtitle}>Hepsini birlikte AI'ya gönderip stok çıkaracağız. Sorunlu bir kare varsa tekrar çek.</Text>
          {photos.map((uri, idx) => (
            <View key={`${idx}-${uri}`} style={styles.reviewCard}>
              <Image source={{ uri }} style={styles.reviewImg} />
              <View style={styles.reviewInfo}>
                <Text style={styles.reviewStepTitle}>
                  {idx + 1}. {STEPS[idx].title}
                </Text>
                <TouchableOpacity onPress={() => retakeStep(idx)} style={styles.retakeBtn}>
                  <MaterialIcons name="refresh" size={16} color={colors.primary} />
                  <Text style={styles.retakeText}>Tekrar Çek</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={cancel}>
            <Text style={styles.secondaryBtnText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={sendForAnalysis}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.onPrimary} />
            <Text style={styles.primaryBtnText}>Analiz Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS !== 'web' ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      )}

      <View style={styles.topBar}>
        <TouchableOpacity onPress={cancel} style={styles.iconBtn}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.stepIndicator}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i < stepIndex && styles.stepDotDone,
                i === stepIndex && styles.stepDotActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.iconBtn} />
      </View>

      <View pointerEvents="none" style={styles.frameOverlay}>
        <View style={styles.frameBox} />
      </View>

      <View style={styles.bottomOverlay}>
        <View style={styles.hintBadge}>
          <MaterialIcons name={step.icon} size={18} color={colors.onPrimary} />
          <Text style={styles.stepTitle}>
            {stepIndex + 1}/{STEPS.length} — {step.title}
          </Text>
        </View>
        <Text style={styles.hint}>{step.hint}</Text>
        {stabilityWarning && <Text style={styles.warningText}>Sabit tut, tekrar dene</Text>}
        <TouchableOpacity
          style={[styles.shutter, !stable && styles.shutterDisabled]}
          onPress={capture}
          disabled={capturing}
          activeOpacity={0.8}
        >
          {capturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
        <Text style={styles.stabilityText}>
          {stable ? 'Hazır — dokun' : 'Telefonu sabit tut'}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    permTitle: {
      fontFamily: fonts.headingBold,
      fontSize: fontSize.lg,
      color: colors.text,
      marginTop: spacing.md,
    },
    permBody: {
      fontFamily: fonts.bodyRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: borderRadius.full,
    },
    stepIndicator: {
      flexDirection: 'row',
      gap: 6,
    },
    stepDot: {
      width: 24,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    stepDotActive: { backgroundColor: '#fff' },
    stepDotDone: { backgroundColor: colors.primary },
    frameOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameBox: {
      width: '80%',
      aspectRatio: 3 / 4,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.9)',
      borderRadius: borderRadius.lg,
      borderStyle: 'dashed',
    },
    bottomOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.lg,
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
    },
    hintBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      marginBottom: spacing.sm,
    },
    stepTitle: {
      fontFamily: fonts.headingBold,
      fontSize: fontSize.sm,
      color: colors.onPrimary,
    },
    hint: {
      fontFamily: fonts.bodyRegular,
      fontSize: fontSize.sm,
      color: '#fff',
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    warningText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSize.sm,
      color: colors.warning,
      marginBottom: spacing.sm,
    },
    shutter: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 4,
      borderColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterDisabled: { borderColor: 'rgba(255,255,255,0.4)' },
    shutterInner: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: '#fff',
    },
    stabilityText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.xs,
      color: '#fff',
      marginTop: spacing.sm,
      opacity: 0.85,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      flex: 1,
    },
    primaryBtnText: {
      fontFamily: fonts.headingBold,
      fontSize: fontSize.md,
      color: colors.onPrimary,
    },
    secondaryBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceContainerLow,
    },
    secondaryBtnText: {
      fontFamily: fonts.headingBold,
      fontSize: fontSize.md,
      color: colors.text,
    },
    reviewRoot: { flex: 1, backgroundColor: colors.background },
    reviewScroll: { padding: spacing.lg, gap: spacing.md },
    reviewTitle: {
      fontFamily: fonts.headingExtraBold,
      fontSize: fontSize.xl,
      color: colors.text,
    },
    reviewSubtitle: {
      fontFamily: fonts.bodyRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    reviewCard: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
    },
    reviewImg: {
      width: 88,
      height: 88,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceContainer,
    },
    reviewInfo: { flex: 1 },
    reviewStepTitle: {
      fontFamily: fonts.headingBold,
      fontSize: fontSize.md,
      color: colors.text,
      marginBottom: 6,
    },
    retakeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
    },
    retakeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSize.sm,
      color: colors.primary,
    },
    reviewActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
  });
