import { Platform } from 'react-native';

// Lazy-load expo-haptics only on native platforms
let Haptics: typeof import('expo-haptics') | null = null;

async function getHaptics() {
  if (Platform.OS === 'web') return null;
  if (!Haptics) {
    try {
      Haptics = await import('expo-haptics');
    } catch {
      return null;
    }
  }
  return Haptics;
}

/** Light tap — favorite toggle, filter chip select */
export async function hapticLight() {
  const h = await getHaptics();
  h?.impactAsync(h.ImpactFeedbackStyle.Light);
}

/** Medium tap — cooking step change, timer actions */
export async function hapticMedium() {
  const h = await getHaptics();
  h?.impactAsync(h.ImpactFeedbackStyle.Medium);
}

/** Selection — toggle, checkbox */
export async function hapticSelection() {
  const h = await getHaptics();
  h?.selectionAsync();
}

/** Success — timer done, recipe complete */
export async function hapticSuccess() {
  const h = await getHaptics();
  h?.notificationAsync(h.NotificationFeedbackType.Success);
}

/** Warning — expiry alert */
export async function hapticWarning() {
  const h = await getHaptics();
  h?.notificationAsync(h.NotificationFeedbackType.Warning);
}
