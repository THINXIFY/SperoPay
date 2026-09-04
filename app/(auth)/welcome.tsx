import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';

// The asset's own pixel size (1462x900) -- keeps the card crisp at any
// screen width instead of guessing a fixed aspect ratio.
const CARD_ASPECT_RATIO = 1462 / 900;

export default function WelcomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);
  // Captured once so the banner doesn't disappear mid-render the instant the
  // effect below clears the store flag for next time.
  const [showSessionExpiredNotice] = useState(sessionExpiredNotice);

  // One-time entrance choreography: the card leads, then the headline copy,
  // then the actions -- each value is seeded at its hidden state
  // unconditionally (never gated on an async condition) so this can't
  // freeze mid-visible the way a conditionally-seeded Animated.Value did
  // for the Analytics Paid-state animation elsewhere in this app.
  const cardAnim = useRef(new Animated.Value(0)).current;
  const copyAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sessionExpiredNotice) {
      clearSessionExpiredNotice();
    }
    Animated.stagger(110, [
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // Intentionally runs once on mount only.
    // eslint-disable-next-line
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        {showSessionExpiredNotice ? (
          <View
            style={{ backgroundColor: colors.softRed, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}
          >
            <Text style={[typography.bodyMedium, { color: colors.softRedText }]}>Your session expired</Text>
            <Text style={[typography.caption, { color: colors.softRedText, marginTop: spacing.xs / 2 }]}>
              Sign in again to continue.
            </Text>
          </View>
        ) : null}
        <View style={styles.visualWrap}>
          <View
            style={[styles.glow, { backgroundColor: colors.primaryActionSoft, borderRadius: radius.full }]}
            pointerEvents="none"
          />
          <Animated.View
            style={{
              opacity: cardAnim,
              transform: [
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            }}
          >
            <Image
              source={require('../../assets/images/welcome-card.webp')}
              style={[styles.cardImage, { aspectRatio: CARD_ASPECT_RATIO }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
        <Animated.View
          style={{
            opacity: copyAnim,
            transform: [{ translateY: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            marginTop: spacing.xxl,
          }}
        >
          <Text style={[typography.display, { color: colors.textPrimary }]}>Spero</Text>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            Request. Share. Get Paid.
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Simple crypto payments for modern businesses.
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        style={{
          opacity: actionsAnim,
          transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          paddingHorizontal: spacing.xl,
          gap: spacing.sm,
          paddingBottom: spacing.lg,
        }}
      >
        <PrimaryButton label="Create Account" onPress={() => router.push('/(auth)/sign-up')} />
        <SecondaryButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  visualWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: '78%', aspectRatio: 1, opacity: 0.7 },
  cardImage: { width: '100%' },
});
