import { useEffect, useState, useRef, useCallback } from 'react';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius, fonts } from '../../src/theme';
import { hapticMedium, hapticSuccess, hapticSelection } from '../../src/utils/haptics';

const { width: SCREEN_W } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface CookingStep {
  stepNumber: number;
  instruction: string;
  durationMinutes: number | null;
  cumulativeMinutes: number;
  isLast: boolean;
  progress: number;
}

interface CookingData {
  recipeId: string;
  title: string;
  servingSize: number;
  totalTimeMinutes: number;
  totalSteps: number;
  ingredientChecklist: { name: string; quantity: string; checked: boolean }[];
  steps: CookingStep[];
}

function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<CookingData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const isSpeakingRef = useRef(false);

  // Load voice preference from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('cooking_voice_enabled').then((val) => {
      if (val === 'true') setVoiceEnabled(true);
    });
  }, []);

  // Persist voice preference
  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => {
      const next = !v;
      AsyncStorage.setItem('cooking_voice_enabled', next ? 'true' : 'false');
      return next;
    });
    hapticSelection();
  }, []);

  const speakStep = useCallback((text: string) => {
    if (!voiceEnabled) return;
    Speech.stop();
    isSpeakingRef.current = true;
    Speech.speak(text, {
      language: 'tr-TR',
      rate: 0.9,
      onDone: () => { isSpeakingRef.current = false; },
      onStopped: () => { isSpeakingRef.current = false; },
    });
  }, [voiceEnabled]);

  const speakAnnouncement = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'tr-TR', rate: 1.0 });
  }, []);

  useEffect(() => {
    api.get<{ data: CookingData }>(`/recipes/${id}/cooking-mode`)
      .then((res) => setData(res as any))
      .catch(() => {});
  }, [id]);

  // Auto-read step when navigating or voice toggled on
  useEffect(() => {
    if (data && voiceEnabled && data.steps[currentStep]) {
      const s = data.steps[currentStep];
      const prefix = `Adım ${s.stepNumber}.`;
      const timerNote = s.durationMinutes ? ` Bu adım ${s.durationMinutes} dakika sürüyor.` : '';
      speakStep(`${prefix} ${s.instruction}${timerNote}`);
    }
    if (!voiceEnabled) Speech.stop();
  }, [currentStep, voiceEnabled, data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerRunning && timer !== null && timer > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev && prev <= 1) {
            setTimerRunning(false);
            hapticSuccess();
            if (voiceEnabled) speakAnnouncement('Süre doldu! Bir sonraki adıma geçebilirsiniz.');
            return 0;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  const startTimer = (minutes: number) => {
    setTimer(minutes * 60);
    setTimerRunning(true);
  };

  const resetTimer = () => {
    setTimer(null);
    setTimerRunning(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const goToStep = (idx: number) => {
    setCurrentStep(idx);
    setTimer(null);
    setTimerRunning(false);
    hapticMedium();
  };

  // Swipe gestures: left = next, right = prev
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 30 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80) {
          // Swipe left → next step
          setCurrentStep((prev) => {
            if (data && prev < data.totalSteps - 1) {
              hapticMedium();
              setTimer(null);
              setTimerRunning(false);
              return prev + 1;
            }
            return prev;
          });
        } else if (gs.dx > 80) {
          // Swipe right → prev step
          setCurrentStep((prev) => {
            if (prev > 0) {
              hapticMedium();
              setTimer(null);
              setTimerRunning(false);
              return prev - 1;
            }
            return prev;
          });
        }
      },
    })
  ).current;

  const handleComplete = async () => {
    if (!user || !id) return;
    hapticSuccess();
    try {
      await api.post(`/users/${user.id}/recipes/${id}/complete`, {});
    } catch {}
    router.back();
  };

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Pişirme modu hazırlanıyor...</Text>
      </View>
    );
  }

  const step = data.steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = step.isLast;
  const progressPercent = ((currentStep + 1) / data.totalSteps) * 100;

  return (
    <View style={styles.container}>
      {/* ===== Top Bar ===== */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} accessibilityLabel="Pişirme modundan çık" accessibilityRole="button">
          <MaterialIcons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarBrand}>CHEFMATE</Text>
          <View style={styles.topProgressPill}>
            <View style={styles.topProgressTrack}>
              <View style={[styles.topProgressFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.topProgressLabel}>
              STEP {String(currentStep + 1).padStart(2, '0')} / {String(data.totalSteps).padStart(2, '0')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleActive]}
          onPress={toggleVoice}
          accessibilityLabel={voiceEnabled ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}
          accessibilityRole="switch"
          accessibilityState={{ checked: voiceEnabled }}
        >
          <MaterialIcons
            name={voiceEnabled ? 'volume-up' : 'volume-off'}
            size={20}
            color={voiceEnabled ? colors.onPrimary : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ingredientToggle}
          onPress={() => setShowIngredients(!showIngredients)}
        >
          <MaterialIcons name="checklist" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ===== Progress Bar ===== */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        {/* Step dots */}
        <View style={styles.stepDots}>
          {data.steps.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.stepDot,
                idx < currentStep && styles.stepDotCompleted,
                idx === currentStep && styles.stepDotActive,
              ]}
              onPress={() => goToStep(idx)}
            >
              {idx < currentStep ? (
                <MaterialIcons name="check" size={10} color="#fff" />
              ) : (
                <Text style={[
                  styles.stepDotText,
                  idx === currentStep && styles.stepDotTextActive,
                ]}>{idx + 1}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ===== Ingredient Checklist Overlay ===== */}
      {showIngredients && (
        <View style={styles.ingredientOverlay}>
          <View style={styles.ingredientHeader}>
            <MaterialIcons name="checklist" size={18} color={colors.primary} />
            <Text style={styles.ingredientTitle}>Malzemeler</Text>
            <TouchableOpacity onPress={() => setShowIngredients(false)}>
              <MaterialIcons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {data.ingredientChecklist.map((ing, idx) => {
            const isChecked = checkedIngredients.has(idx);
            return (
              <TouchableOpacity
                key={idx}
                style={styles.ingredientRow}
                onPress={() => {
                  hapticSelection();
                  setCheckedIngredients((prev) => {
                    const next = new Set(prev);
                    if (next.has(idx)) next.delete(idx);
                    else next.add(idx);
                    return next;
                  });
                }}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                  {isChecked && <MaterialIcons name="check" size={12} color="#fff" />}
                </View>
                <Text style={[styles.ingredientName, isChecked && styles.ingredientChecked]}>
                  {ing.name}
                </Text>
                <Text style={[styles.ingredientQty, isChecked && styles.ingredientChecked]}>
                  {ing.quantity}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ===== Main Step Content (swipeable) ===== */}
      <View style={styles.stepMain} {...panResponder.panHandlers}>
        {/* Big step number */}
        <View style={styles.stepNumberContainer} accessibilityLabel={'Adım ' + step.stepNumber + ' / ' + data.totalSteps}>
          <Text style={styles.stepNumberBig}>{step.stepNumber}</Text>
          <Text style={styles.stepNumberLabel}>/ {data.totalSteps}</Text>
        </View>

        {/* Instruction card */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>{step.instruction}</Text>
          {voiceEnabled && (
            <TouchableOpacity
              style={styles.repeatVoiceBtn}
              onPress={() => speakStep(step.instruction)}
            >
              <MaterialIcons name="replay" size={16} color={colors.primary} />
              <Text style={styles.repeatVoiceText}>Tekrar oku</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Swipe hint */}
        {currentStep === 0 && (
          <View style={styles.swipeHint}>
            <MaterialIcons name="swipe" size={16} color={colors.textMuted} />
            <Text style={styles.swipeHintText}>Kaydırarak adımlar arası geç</Text>
          </View>
        )}

        {/* Timer section */}
        {step.durationMinutes ? (
          <View style={styles.timerSection}>
            {timer !== null ? (
              <View style={styles.timerActive}>
                <Text style={[
                  styles.timerDisplay,
                  timer === 0 && styles.timerDone,
                ]}>
                  {timer === 0 ? 'Süre doldu!' : formatTime(timer)}
                </Text>
                <View style={styles.timerControls}>
                  {timer > 0 && (
                    <TouchableOpacity
                      style={[styles.timerControlBtn, timerRunning && styles.timerPauseBtn]}
                      onPress={() => setTimerRunning(!timerRunning)}
                      accessibilityRole="button"
                      accessibilityLabel={timerRunning ? 'Zamanlayıcıyı durdur' : 'Zamanlayıcıyı başlat'}
                    >
                      <MaterialIcons
                        name={timerRunning ? 'pause' : 'play-arrow'}
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.timerResetBtn}
                    onPress={resetTimer}
                    accessibilityRole="button"
                    accessibilityLabel="Zamanlayıcıyı sıfırla"
                  >
                    <MaterialIcons name="refresh" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {/* Timer progress ring (simple bar) */}
                {timer > 0 && step.durationMinutes && (
                  <View style={styles.timerProgress}>
                    <View style={[
                      styles.timerProgressFill,
                      { width: `${(1 - timer / (step.durationMinutes * 60)) * 100}%` },
                    ]} />
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.startTimerBtn}
                onPress={() => startTimer(step.durationMinutes!)}
                accessibilityRole="button"
                accessibilityLabel="Zamanlayıcıyı başlat"
              >
                <MaterialIcons name="timer" size={20} color={colors.onPrimary} />
                <Text style={styles.startTimerText}>
                  {step.durationMinutes} dk zamanlayıcı başlat
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* ===== Bottom Navigation ===== */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.prevBtn, isFirst && styles.navBtnDisabled]}
          onPress={() => goToStep(currentStep - 1)}
          disabled={isFirst}
          accessibilityRole="button"
          accessibilityLabel="Önceki adım"
        >
          <MaterialIcons name="arrow-back" size={22} color={isFirst ? colors.textMuted : colors.text} />
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleComplete}
            accessibilityRole="button"
            accessibilityLabel="Tarifi tamamla"
          >
            <Text style={styles.completeBtnText}>TAMAMLA</Text>
            <MaterialIcons name="check-circle" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => goToStep(currentStep + 1)}
            accessibilityRole="button"
            accessibilityLabel="Sonraki adım"
          >
            <Text style={styles.nextBtnText}>DEVAM ET</Text>
            <MaterialIcons name="arrow-forward" size={22} color={colors.onPrimaryContainer} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 54,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarBrand: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingExtraBold,
    color: colors.primaryContainer,
    letterSpacing: 2,
  },
  topProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  topProgressTrack: {
    width: 80,
    height: 3,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 2,
    overflow: 'hidden',
  },
  topProgressFill: {
    height: 3,
    backgroundColor: colors.primaryContainer,
    borderRadius: 2,
  },
  topProgressLabel: {
    fontSize: 9,
    fontFamily: fonts.headingExtraBold,
    color: colors.textSecondary,
    letterSpacing: 1.2,
  },
  voiceToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceToggleActive: {
    backgroundColor: colors.primary,
  },
  ingredientToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress
  progressContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    ...(isWeb ? { maxWidth: 700, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  stepDotCompleted: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 10,
    fontFamily: fonts.headingBold,
    color: colors.textMuted,
  },
  stepDotTextActive: {
    color: '#fff',
  },

  // Ingredient overlay
  ingredientOverlay: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 80 : 110,
    right: spacing.md,
    width: Math.min(320, SCREEN_W - 40),
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    maxHeight: 400,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  ingredientTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.headingBold,
    color: colors.text,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ingredientName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  ingredientQty: {
    fontSize: fontSize.sm,
    fontFamily: fonts.headingSemiBold,
    color: colors.primary,
  },
  ingredientChecked: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },

  // Main Step
  stepMain: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    ...(isWeb ? { maxWidth: 700, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  stepNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  stepNumberBig: {
    fontSize: 72,
    fontFamily: fonts.headingExtraBold,
    color: colors.primary,
    lineHeight: 80,
  },
  stepNumberLabel: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    marginLeft: 4,
  },

  // Instruction
  instructionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%' as any,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHigh + '50',
  },
  instructionText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bodyRegular,
    color: colors.text,
    lineHeight: 28,
    textAlign: 'center',
  },
  repeatVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  repeatVoiceText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    opacity: 0.5,
  },
  swipeHintText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
  },

  // Timer
  timerSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    width: '100%' as any,
  },
  timerActive: {
    alignItems: 'center',
    width: '100%' as any,
  },
  timerDisplay: {
    fontSize: 56,
    fontFamily: fonts.headingExtraBold,
    color: colors.primary,
    letterSpacing: 2,
  },
  timerDone: {
    color: colors.success,
    fontSize: fontSize.xxl,
  },
  timerControls: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  timerControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerPauseBtn: {
    backgroundColor: colors.warning,
  },
  timerResetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerProgress: {
    width: '80%' as any,
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  timerProgressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  startTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  startTimerText: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingBold,
    color: colors.onPrimary,
  },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'web' ? spacing.md : spacing.lg + 8,
    backgroundColor: 'transparent',
    ...(isWeb ? { maxWidth: 700, marginHorizontal: 'auto' as any, width: '100%' as any } : {}),
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  prevBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primaryContainer,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  nextBtnText: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingExtraBold,
    color: colors.onPrimaryContainer,
    letterSpacing: 1.5,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: 28,
    backgroundColor: colors.secondary,
  },
  completeBtnText: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingExtraBold,
    color: '#fff',
    letterSpacing: 1.5,
  },
});

export default withScreenErrorBoundary(CookingModeScreen, 'Pişirme Modu');
