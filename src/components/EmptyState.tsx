import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, fonts } from '../theme';

interface Props {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ icon, title, message, ctaLabel, onCta }: Props) {
  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <MaterialIcons name={icon} size={48} color={colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
      {ctaLabel && onCta && (
        <TouchableOpacity style={s.cta} onPress={onCta} activeOpacity={0.85}>
          <Text style={s.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryContainer + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontFamily: fonts.headingBold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: fontSize.md,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  ctaText: {
    fontSize: fontSize.md,
    fontFamily: fonts.headingBold,
    color: colors.onPrimary,
  },
});
