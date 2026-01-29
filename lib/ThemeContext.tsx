import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  effectiveTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@OneMind:theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadThemePreference();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  // Calculate effective theme based on mode and system preference
  // Use useMemo to ensure it updates when dependencies change
  // Use current themeMode even if not loaded yet (will update once loaded)
  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    return themeMode === 'system' 
      ? (systemColorScheme ?? 'light') 
      : themeMode;
  }, [themeMode, systemColorScheme]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    themeMode,
    setThemeMode,
    effectiveTheme,
  }), [themeMode, setThemeMode, effectiveTheme]);

  // Always render - don't return null to avoid hooks order issues
  // The theme will update once AsyncStorage loads
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper hook that returns the effective color scheme
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const { effectiveTheme } = useTheme();
  return effectiveTheme;
}
