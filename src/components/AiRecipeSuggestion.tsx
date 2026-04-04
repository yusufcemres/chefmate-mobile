import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '../api/client';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import type { AiSuggestionResult } from '../types';

interface Props {
  recipeId: string;
}

const SUGGESTION_TYPES = [
  { key: 'healthier', label: 'Daha Sağlıklı', icon: 'spa' as const },
  { key: 'cuisine', label: 'Mutfak Değiştir', icon: 'public' as const },
  { key: 'dietary', label: 'Vegan Yap', icon: 'eco' as const },
  { key: 'budget', label: 'Bütçe Dostu', icon: 'savings' as const },
  { key: 'quick', label: 'Daha Hızlı', icon: 'bolt' as const },
  { key: 'inventory', label: 'Elimdekilerle', icon: 'kitchen' as const },
  { key: 'custom', label: 'Serbest İstek', icon: 'edit' as const },
] as const;

const CUISINE_OPTIONS = [
  'Kore', 'Japon', 'İtalyan', 'Meksika', 'Hint', 'Çin', 'Tayland', 'Fransız', 'Türk (Ege)', 'Akdeniz',
];

export default function AiRecipeSuggestion({ recipeId }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCuisines, setShowCuisines] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    setResult(null);
    setError(null);

    if (key === selectedType) {
      setSelectedType(null);
      setShowCuisines(false);
      return;
    }

    setSelectedType(key);
    setShowCuisines(key === 'cuisine');

    // Auto-generate for types that don't need extra input
    if (!['cuisine', 'custom'].includes(key)) {
      generate(key);
    }
  };

  const generate = async (type?: string, prompt?: string) => {
    const t = type || selectedType;
    if (!t) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: { suggestionType: string; prompt?: string } = { suggestionType: t };
      if (prompt) body.prompt = prompt;
      else if (t === 'custom' && customPrompt.trim()) body.prompt = customPrompt.trim();

      const res = await api.post<{ data: AiSuggestionResult }>(
        `/recipes/${recipeId}/ai-suggest`,
        body,
      );
      // API might return { data: result } or result directly
      setResult((res as any).data || res);
    } catch (err: any) {
      const msg = err.message || 'AI öneri oluşturulamadı';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCuisineSelect = (cuisine: string) => {
    setShowCuisines(false);
    generate('cuisine', `${cuisine} mutfağı`);
  };

  const handleCustomSubmit = () => {
    if (!customPrompt.trim()) {
      const msg = 'Lütfen bir istek yazın';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Uyarı', msg);
      return;
    }
    generate('custom');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialIcons name="auto-awesome" size={22} color={colors.secondary} />
        <Text style={styles.headerTitle}>AI ile Kişiselleştir</Text>
      </View>
      <Text style={styles.headerDesc}>
        Tarifi ihtiyacına göre dönüştür
      </Text>

      {/* Chip Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {SUGGESTION_TYPES.map((t) => {
          const active = selectedType === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleSelect(t.key)}
              disabled={loading}
            >
              <MaterialIcons
                name={t.icon}
                size={16}
                color={active ? colors.onPrimaryContainer : colors.textSecondary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Cuisine Picker */}
      {showCuisines && (
        <View style={styles.cuisineGrid}>
          {CUISINE_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={styles.cuisineChip}
              onPress={() => handleCuisineSelect(c)}
              disabled={loading}
            >
              <Text style={styles.cuisineChipText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Custom Prompt */}
      {selectedType === 'custom' && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Ör: Glütensiz yap, protein artır..."
            placeholderTextColor={colors.textMuted}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.customBtn}
            onPress={handleCustomSubmit}
            disabled={loading}
          >
            <MaterialIcons name="send" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>AI tarifi dönüştürüyor...</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={styles.resultCard}>
          {/* Title */}
          <Text style={styles.resultTitle}>{result.title}</Text>
          {result.description ? (
            <Text style={styles.resultDesc}>{result.description}</Text>
          ) : null}

          {/* Changes Summary */}
          {result.changesSummary?.length > 0 && (
            <View style={styles.changesSection}>
              <View style={styles.changesBadge}>
                <MaterialIcons name="compare-arrows" size={14} color={colors.secondary} />
                <Text style={styles.changesTitle}>Değişiklikler</Text>
              </View>
              {result.changesSummary.map((change, i) => (
                <View key={i} style={styles.changeRow}>
                  <MaterialIcons name="check-circle" size={14} color={colors.primary} />
                  <Text style={styles.changeText}>{change}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ingredients Diff */}
          <View style={styles.ingredientsSection}>
            <Text style={styles.subTitle}>Malzemeler</Text>
            {result.ingredients.map((ing, i) => (
              <View
                key={i}
                style={[
                  styles.ingRow,
                  ing.isChanged && styles.ingRowChanged,
                ]}
              >
                <View style={styles.ingLeft}>
                  {ing.isChanged && (
                    <MaterialIcons name="swap-horiz" size={14} color={colors.secondary} />
                  )}
                  <Text style={[styles.ingName, ing.isChanged && styles.ingNameChanged]}>
                    {ing.name}
                  </Text>
                </View>
                <Text style={styles.ingQty}>
                  {ing.quantity} {ing.unit}
                </Text>
                {ing.changeNote ? (
                  <Text style={styles.ingNote}>{ing.changeNote}</Text>
                ) : null}
              </View>
            ))}
          </View>

          {/* Steps */}
          {result.steps?.length > 0 && (
            <View style={styles.stepsSection}>
              <Text style={styles.subTitle}>Adımlar</Text>
              {result.steps.map((step, i) => (
                <View key={i} style={styles.resultStepRow}>
                  <View style={styles.resultStepNum}>
                    <Text style={styles.resultStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.resultStepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Nutrition Estimate */}
          {result.nutritionEstimate && (
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionBadge}>
                <MaterialIcons name="local-fire-department" size={14} color={colors.tertiary} />
                <Text style={styles.nutritionText}>{result.nutritionEstimate.calories}</Text>
              </View>
              <View style={styles.nutritionBadge}>
                <MaterialIcons name="fitness-center" size={14} color={colors.tertiary} />
                <Text style={styles.nutritionText}>{result.nutritionEstimate.protein}</Text>
              </View>
            </View>
          )}

          {/* Processing time */}
          {result.processingTimeMs != null && (
            <Text style={styles.processingTime}>
              {(result.processingTimeMs / 1000).toFixed(1)}s
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },

  // Chips
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },

  // Cuisine Grid
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  cuisineChip: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cuisineChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.onSecondaryContainer,
  },

  // Custom Prompt
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  customInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    color: colors.text,
  },
  customBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    flex: 1,
  },

  // Result Card
  resultCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
  },
  resultTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
  },
  resultDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },

  // Changes
  changesSection: {
    marginTop: spacing.md,
    backgroundColor: colors.secondaryContainer + '30',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  changesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  changesTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.secondary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  changeText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },

  // Ingredients
  ingredientsSection: {
    marginTop: spacing.md,
  },
  subTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  ingRowChanged: {
    backgroundColor: colors.primaryContainer + '30',
  },
  ingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  ingName: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  ingNameChanged: {
    fontWeight: '700',
    color: colors.primary,
  },
  ingQty: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  ingNote: {
    width: '100%',
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontStyle: 'italic',
    marginTop: 2,
    paddingLeft: 20,
  },

  // Steps
  stepsSection: {
    marginTop: spacing.md,
  },
  resultStepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultStepNum: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  resultStepNumText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: colors.onPrimaryContainer,
  },
  resultStepText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },

  // Nutrition
  nutritionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  nutritionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tertiaryContainer + '40',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nutritionText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.tertiary,
  },

  // Processing Time
  processingTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
});
