import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';

// The asset's own pixel size (1462x900) -- used to derive a correct height
// from whatever width we pick, instead of letting the image size itself.
const CARD_ASPECT_RATIO = 1462 / 900;
const CARD_WIDTH_RATIO = 0.78; // ~78% of screen width -- prominent but not dominant, since it sits below the copy rather than leading the screen
const CARD_MAX_WIDTH = 360;

export default function WelcomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);
  // Captured once so the banner doesn't disappear mid-render the instant the
  // effect below clears the store flag for next time.
  const [showSessionExpiredNotice] = useState(sessionExpiredNotice);

  // Explicit pixel dimensions, not a percentage width -- the card's direct
  // parent (the Animated.View below) has no defined width of its own since
  // cardSection centers rather than stretches its children, so a percentage
  // width here would have nothing definite to resolve against (this is what
  // previously let the image render at its native intrinsic size).
  const cardWidth = Math.min(windowWidth * CARD_WIDTH_RATIO, CARD_MAX_WIDTH);
  const cardHeight = cardWidth / CARD_ASPECT_RATIO;

  // A single soft ambient shape bleeding off the top edge, behind the
  // headline -- gives the top of the screen a designed, intentional feel
  // instead of flat empty space, without competing with the card's own
  // glow lower down. Positioned with explicit pixel values (not a `left:
  // '50%'`) to sidestep any doubt about percentage resolution on an
  // absolutely-positioned child -- same reasoning as the card sizing above.
  const ambientSize = windowWidth * 1.6;
  const ambientLeft = (windowWidth - ambientSize) / 2;

  // One-time entrance choreography, sequenced to match the on-screen reading
  // order (copy, then card, then actions) -- each value is seeded at its
  // hidden state unconditionally (never gated on an async condition) so this
  // can't freeze mid-visible the way a conditionally-seeded Animated.Value
  // did for the Analytics Paid-state animation elsewhere in this app.
  const copyAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sessionExpiredNotice) {
      clearSessionExpiredNotice();
    }
    Animated.stagger(110, [
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 560,
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
      <View
        style={[
          styles.ambientShape,
          {
            width: ambientSize,
            height: ambientSize,
            top: -ambientSize * 0.62,
            left: ambientLeft,
            borderRadius: ambientSize / 2,
            backgroundColor: colors.primaryActionSoft,
          },
        ]}
        pointerEvents="none"
      />
      <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingTop: spacing.md }]}>
        {showSessionExpiredNotice ? (
          <View
            style={{
              backgroundColor: colors.softRed,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <Text style={[typography.bodyMedium, { color: colors.softRedText }]}>Your session expired</Text>
            <Text style={[typography.caption, { color: colors.softRedText, marginTop: spacing.xs / 2 }]}>
              Sign in again to continue.
            </Text>
          </View>
        ) : null}

        <Animated.View
          style={{
            opacity: copyAnim,
            transform: [{ translateY: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <Text style={[typography.display, { color: colors.textPrimary }]}>Spero</Text>
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            Request. Share. Get Paid.
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.base, maxWidth: 320 }]}
          >
            Simple crypto payments for modern businesses.
          </Text>
        </Animated.View>

        <View style={[styles.cardSection, { marginTop: spacing.xxl + spacing.sm }]}>
          <View
            style={[
              styles.glow,
              {
                width: cardWidth * 0.9,
                height: cardWidth * 0.9,
                backgroundColor: colors.primaryActionSoft,
                borderRadius: radius.full,
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.cardShadow,
              {
                width: cardWidth,
                height: cardHeight,
                opacity: cardAnim,
                transform: [
                  { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
                  { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/images/welcome-card.webp')}
              style={{ width: cardWidth, height: cardHeight }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>
      </View>

      <Animated.View
        style={{
          opacity: actionsAnim,
          transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
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
  content: { flex: 1, justifyContent: 'flex-start' },
  cardSection: { alignItems: 'center', justifyContent: 'center' },
  ambientShape: { position: 'absolute', opacity: 0.5 },
  glow: { position: 'absolute', opacity: 0.7 },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
});
