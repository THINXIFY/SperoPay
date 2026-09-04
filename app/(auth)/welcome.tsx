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
const CARD_WIDTH_RATIO = 0.8; // prominent hero, not overpowering
const CARD_MAX_WIDTH = 380;

export default function WelcomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);
  // Captured once so the banner doesn't disappear mid-render the instant the
  // effect below clears the store flag for next time.
  const [showSessionExpiredNotice] = useState(sessionExpiredNotice);

  // Explicit pixel dimensions, not a percentage width -- avoids the layout
  // instability percentage widths hit inside a centered (non-stretching)
  // flex parent, and keeps sizing predictable across devices.
  const cardWidth = Math.min(windowWidth * CARD_WIDTH_RATIO, CARD_MAX_WIDTH);
  const cardHeight = cardWidth / CARD_ASPECT_RATIO;
  const glowSize = cardWidth * 0.98;

  // One-time entrance choreography, sequenced to match the on-screen reading
  // order (copy, then the hero card, then the actions) -- each value is
  // seeded at its hidden state unconditionally (never gated on an async
  // condition) so this can't freeze mid-visible the way a conditionally-
  // seeded Animated.Value did for the Analytics Paid-state animation
  // elsewhere in this app.
  const copyAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sessionExpiredNotice) {
      clearSessionExpiredNotice();
    }
    Animated.stagger(120, [
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // Intentionally runs once on mount only.
    // eslint-disable-next-line
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Text block -- left-aligned, anchored near the top with breathing
          room, natural height (not flex) so it never competes with the
          hero card for vertical space. */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
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
            transform: [{ translateY: copyAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          <Text style={[typography.display, { color: colors.textPrimary, letterSpacing: -0.6 }]}>Spero</Text>
          <Text
            style={[
              typography.h3,
              { color: colors.textPrimary, marginTop: spacing.sm, letterSpacing: 0.1 },
            ]}
          >
            Request. Share. Get Paid.
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.base, maxWidth: 320 }]}
          >
            Simple crypto payments for modern businesses.
          </Text>
        </Animated.View>
      </View>

      {/* Hero zone -- the only flexible region, so the card is genuinely
          centered in whatever vertical space remains between the text block
          and the buttons (not just placed under the text with a fixed
          margin). This is what keeps the composition balanced across
          device heights instead of top- or bottom-heavy. */}
      <View style={[styles.heroZone, { paddingHorizontal: spacing.xl }]}>
        <View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: colors.primaryActionSoft,
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
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
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

      {/* CTA section -- fixed at the bottom, never part of the flexible
          middle zone, so it's unaffected by hero sizing and always fully
          visible with no scrolling. */}
      <Animated.View
        style={{
          opacity: actionsAnim,
          transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
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
  container: { flex: 1 },
  heroZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', opacity: 0.55 },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
});
