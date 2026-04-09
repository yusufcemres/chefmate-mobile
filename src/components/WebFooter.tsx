import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius, fonts } from '../theme';

// Only renders on web
export function WebFooter() {
  if (Platform.OS !== 'web') return null;

  return (
    <View style={s.container}>
      <View style={s.inner}>
        {/* Brand */}
        <View style={s.brand}>
          <Text style={s.logo}>ChefMate</Text>
          <Text style={s.tagline}>577+ tarif, 10 mutfak, AI destekli öneriler</Text>
        </View>

        {/* Links */}
        <View style={s.linksRow}>
          <View style={s.linkCol}>
            <Text style={s.linkTitle}>Keşfet</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)')}>
              <Text style={s.link}>Tüm Tarifler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
              <Text style={s.link}>Mutfak Stoğum</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shopping')}>
              <Text style={s.link}>Alışveriş Listesi</Text>
            </TouchableOpacity>
          </View>
          <View style={s.linkCol}>
            <Text style={s.linkTitle}>Mutfaklar</Text>
            <Text style={s.link}>🇹🇷 Türk Mutfağı</Text>
            <Text style={s.link}>🇮🇹 İtalyan Mutfağı</Text>
            <Text style={s.link}>🇯🇵 Japon Mutfağı</Text>
          </View>
          <View style={s.linkCol}>
            <Text style={s.linkTitle}>Hakkımızda</Text>
            <Text style={s.link}>ChefMate v2.0</Text>
            <Text style={s.link}>AI Destekli Tarifler</Text>
          </View>
        </View>

        {/* Copyright */}
        <View style={s.bottom}>
          <View style={s.divider} />
          <Text style={s.copyright}>
            © {new Date().getFullYear()} ChefMate — Tüm hakları saklıdır.
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    marginTop: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  inner: {
    maxWidth: 960,
    marginHorizontal: 'auto' as any,
    width: '100%' as any,
  },
  brand: {
    marginBottom: spacing.lg,
  },
  logo: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.headingExtraBold,
    color: colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyRegular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linksRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  linkCol: {
    gap: spacing.xs,
    minWidth: 150,
  },
  linkTitle: {
    fontSize: fontSize.xs,
    fontFamily: fonts.headingBold,
    color: colors.text,
    textTransform: 'uppercase' as any,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  link: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bodyMedium,
    color: colors.textSecondary,
    paddingVertical: 2,
  },
  bottom: {
    marginTop: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  copyright: {
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyRegular,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
