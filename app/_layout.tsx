import 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useMemo } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import AnimatedSplash from '@/components/AnimatedSplash';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { NavigationProvider } from '@/lib/navigationContext';
import { 
  requestNotificationPermissions, 
  checkAndNotify,
  updateBadgeCount,
} from '@/lib/notificationService';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [splashComplete, setSplashComplete] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Show animated splash first
  if (!splashComplete) {
    return <AnimatedSplash onAnimationComplete={() => setSplashComplete(true)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationProvider>
          <RootLayoutNav />
        </NavigationProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  // Initialize notifications on app start
  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    try {
      // Request permissions
      await requestNotificationPermissions();
      // Check for expiring items and todos
      await checkAndNotify();
      // Update badge count
      await updateBadgeCount();
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  // Customize themes with OneMind colors - memoize to ensure proper updates
  const customLightTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.primary,
      background: Colors.light.background,
      card: Colors.light.surface,
      text: Colors.light.text,
      border: Colors.light.border,
    },
  }), []);

  const customDarkTheme = useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.primary,
      background: Colors.dark.background,
      card: Colors.dark.surface,
      text: Colors.dark.text,
      border: Colors.dark.border,
    },
  }), []);

  // Memoize the selected theme to ensure NavigationThemeProvider updates
  const navigationTheme = useMemo(() => 
    isDark ? customDarkTheme : customLightTheme,
    [isDark, customDarkTheme, customLightTheme]
  );

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="camera"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="record/[id]"
          options={{
            headerTitle: '记录详情',
            headerBackTitle: '返回',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </NavigationThemeProvider>
  );
}
