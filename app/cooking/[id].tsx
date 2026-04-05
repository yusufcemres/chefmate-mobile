import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';

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

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<CookingData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get<{ data: CookingData }>(`/recipes/${id}/cooking-mode`)
      .then((res) => setData(res as any))
      .catch(() => {});
  }, [id]);

  // Timer logic
  useEffect(() => {
    if (timerRunning && timer !== null && timer > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev && prev <= 1) {
            setTimerRunning(false);
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleComplete = async () => {
    if (!user || !id) return;
    try {
      await api.post(`/users/${user.id}/recipes/${id}/complete`, {});
    } catch {
      // ignore
    }
    router.back();
  };

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const step = data.steps[currentStep];
  const isLast = step.isLast;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.recipeTitle}>{data.title}</Text>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${step.progress}%` }]} />
      </View>

      {/* Step Counter */}
      <Text style={styles.stepCounter}>
        Adım {step.stepNumber} / {data.totalSteps}
      </Text>

      {/* Instruction */}
      <View style={styles.instructionCard}>
        <Text style={styles.instruction}>{step.instruction}</Text>
      </View>

      {/* Timer */}
      {step.durationMinutes ? (
        <View style={styles.timerSection}>
          {timer !== null ? (
            <>
              <Text style={[styles.timerText, timer === 0 && { color: colors.success }]}>
                {timer === 0 ? 'Süre doldu!' : formatTime(timer)}
              </Text>
              {!timerRunning && timer > 0 && (
                <TouchableOpacity style={styles.timerBtn} onPress={() => setTimerRunning(true)}>
                  <Text style={styles.timerBtnText}>Devam</Text>
                </TouchableOpacity>
              )}
              {timerRunning && (
                <TouchableOpacity style={[styles.timerBtn, { backgroundColor: colors.warning }]} onPress={() => setTimerRunning(false)}>
                  <Text style={styles.timerBtnText}>Durdur</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={styles.timerBtn} onPress={() => startTimer(step.durationMinutes!)}>
              <Text style={styles.timerBtnText}>{step.durationMinutes} dk zamanlayıcı başlat</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentStep === 0 && styles.navBtnDisabled]}
          onPress={() => { setCurrentStep((s) => s - 1); setTimer(null); setTimerRunning(false); }}
          disabled={currentStep === 0}
        >
          <Text style={styles.navBtnText}>Önceki</Text>
        </TouchableOpacity>

        {isLast ? (
          <TouchableOpacity style={[styles.navBtn, styles.completeBtn]} onPress={handleComplete}>
            <Text style={[styles.navBtnText, { color: colors.textInverse }]}>Tamamla</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.nextBtn]}
            onPress={() => { setCurrentStep((s) => s + 1); setTimer(null); setTimerRunning(false); }}
          >
            <Text style={[styles.navBtnText, { color: colors.textInverse }]}>Sonraki</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recipeTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  progressBar: { height: 6, backgroundColor: colors.borderLight, borderRadius: 3, marginBottom: spacing.md },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  stepCounter: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600', textAlign: 'center', marginBottom: spacing.md },
  instructionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  instruction: { fontSize: fontSize.xl, color: colors.text, lineHeight: 30 },
  timerSection: { alignItems: 'center', marginBottom: spacing.lg },
  timerText: { fontSize: 48, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  timerBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.sm },
  timerBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.md },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto', paddingBottom: spacing.lg },
  navBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontWeight: '700', fontSize: fontSize.md, color: colors.text },
  nextBtn: { backgroundColor: colors.primary, borderColor: colors.primary },
  completeBtn: { backgroundColor: colors.success, borderColor: colors.success },
});
