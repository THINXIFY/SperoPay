import '../src/lib/solanaPolyfills';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useTheme } from '../src/theme/useTheme';
import { initializeAuthListener, useAuthStore } from '../src/store/authStore';
import { useProfileStore } from '../src/store/profileStore';
import { useWalletStore } from '../src/store/walletStore';
import { useCustomerStore } from '../src/store/customerStore';
import { useTemplateStore } from '../src/store/templateStore';
import { useRequestStore } from '../src/store/requestStore';
import { useRequestEventStore } from '../src/store/requestEventStore';
import { useTransactionStore } from '../src/store/transactionStore';
import { useNotificationsFeedStore } from '../src/store/notificationsFeedStore';
import { resetAllUserData } from '../src/store/dataLifecycle';
import { assertRealPaymentConfigured } from '../src/services/blockchain/solana/paymentMode';
import { isWebPubliclyAllowedPath } from '../src/utils/webRouteGuard';
import { WebLandingScreen } from '../src/components/WebLandingScreen';

// Phase 5A payment hardening: fails loudly and immediately at startup, not
// just silently on whichever payment gets verified first, if a build is
// ever configured for real (mainnet) payments without also explicitly
// targeting mainnet-beta -- see paymentMode.ts. A no-op on every build that
// exists today (EXPO_PUBLIC_PAYMENT_MODE is unset everywhere in this repo,
// so getPaymentMode() reads 'mock' and this returns immediately).
assertRealPaymentConfigured();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { mode, colors } = useTheme();
  // usePathname() is only ever consulted on web (the check below), so this
  // never affects native navigation timing or re-renders -- expo-router
  // still updates it on every native navigation regardless, but nothing
  // here reads it there.
  const pathname = usePathname();

  // Phase 5B web-surface guard: Spero's real product is the native Android
  // app -- the web deployment exists only to let a customer open a payment
  // link or client portal without installing anything (see
  // webRouteGuard.ts for the exact allowed paths and why). Native
  // Android/iOS builds never take this branch at all; every other route on
  // web renders WebLandingScreen instead of the actual merchant app.
  if (Platform.OS === 'web' && !isWebPubliclyAllowedPath(pathname)) {
    return (
      <>
        <StatusBar style="dark" />
        <WebLandingScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reports" />
        <Stack.Screen name="p" />
        <Stack.Screen name="c" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return unsubscribe;
  }, []);

  const userId = useAuthStore((state) => state.user?.id);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const fullName = useAuthStore((state) => state.user?.fullName);
  const lastLoadedUserId = useRef<string | null>(null);

  // Hidden only once BOTH fonts and the auth session are ready, not fonts
  // alone -- the native splash's background (#050505, app.json) matches
  // the app's near-black hero surfaces, but not the default light theme's
  // background (#F5F6F4). Hiding on fontsLoaded alone left a brief window
  // where AuthGate was still returning null (waiting on hasHydrated) and
  // the Stack's own contentStyle background showed through underneath --
  // a visible black-to-off-white flash for a light-theme user, right
  // before the real first screen (which may itself require a redirect)
  // ever rendered.
  useEffect(() => {
    if (fontsLoaded && authHasHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authHasHydrated]);

  useEffect(() => {
    if (!authHasHydrated) return;

    if (!userId) {
      if (lastLoadedUserId.current !== null) {
        resetAllUserData();
        lastLoadedUserId.current = null;
      }
      return;
    }

    if (lastLoadedUserId.current === userId) return;
    resetAllUserData();
    lastLoadedUserId.current = userId;
    useProfileStore.getState().loadForUser(userId, fullName);
    useWalletStore.getState().loadForUser(userId);
    useCustomerStore.getState().loadForUser(userId);
    useTemplateStore.getState().loadForUser(userId);
    useRequestStore.getState().loadForUser(userId);
    useRequestEventStore.getState().loadForUser(userId);
    useTransactionStore.getState().loadForUser(userId);
    useNotificationsFeedStore.getState().loadForUser(userId);
  }, [authHasHydrated, userId, fullName]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
