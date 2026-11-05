import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogHost } from '@/components/DialogHost';
import { Launch } from '@/components/Launch';
import { initDatabase } from '@/db/init';
import { KeyboardProvider } from '@/lib/keyboard';
import { ProfileProvider, useProfile } from '@/state/profile';
import { colors } from '@/theme';

// A widget tap can open a screen deep in the stack (Start, Recap, an exercise) with the
// app closed. The anchor puts the tabs underneath it, so Back lands on Today, not out.
export const unstable_settings = { anchor: '(tabs)' };

// Keep the native splash up until fonts and the database are ready, so text never
// flashes in the system font. <Launch> hides it once it can take over.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Michroma_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // A font that fails to load shouldn't strand the user on the splash.
  useEffect(() => {
    if (error) SplashScreen.hideAsync();
  }, [error]);

  if (!loaded && !error) return null;

  // SQLiteProvider holds the screens back until migrations and the library seed have
  // run, so no screen ever reads a half-built database. KeyboardProvider lets pinned
  // buttons and scroll views move with the keyboard frame by frame, not after it.
  // The app draws edge to edge (safe-area insets keep content clear of the system bars),
  // so the provider is told so; without it, Expo Go reports no edge-to-edge and the
  // provider adds its own margin, leaving a black band over the tab bar.
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      <SQLiteProvider databaseName="spotter.db" onInit={initDatabase}>
        <ProfileProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.ground },
            }}
          >
            {/* Full-screen moments fade instead of sliding, and can't be swiped away. */}
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="start" options={{ animation: 'fade' }} />
            <Stack.Screen name="workout/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="done/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="recap" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
          <LaunchGate />
          <DialogHost />
        </ProfileProvider>
      </SQLiteProvider>
    </KeyboardProvider>
  );
}

// The launch animation leaves once we know whether to show Today or Onboarding.
function LaunchGate() {
  const { profile } = useProfile();
  return <Launch ready={profile !== undefined} />;
}
