import { useRef, type PropsWithChildren } from 'react';
import { Animated, Pressable, type ViewStyle, Platform } from 'react-native';

interface Props extends PropsWithChildren {
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  scaleDown?: number;
  disabled?: boolean;
}

/**
 * A pressable wrapper that scales down slightly on press for micro-interaction.
 * Uses native driver for smooth 60fps animation.
 */
export function PressableScale({
  onPress,
  style,
  children,
  scaleDown = 0.97,
  disabled,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
