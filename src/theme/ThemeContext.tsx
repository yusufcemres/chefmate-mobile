import { createContext, useContext, useState, useEffect, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { colors as lightColors, darkColors } from './index';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof lightColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  colors: lightColors,
  setMode: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const themeColors = isDark ? { ...lightColors, ...darkColors } : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors: themeColors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
