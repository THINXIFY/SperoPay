import React from 'react';
import { View, Text, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Head from 'expo-router/head';
import { useTheme } from '../theme/useTheme';
import { Logo } from './Logo';
import { PrimaryButton } from './PrimaryButton';
import { getGooglePlayUrl } from '../utils/googlePlayUrl';

const MAX_CONTENT_WIDTH = 420;

// Phase 5B: what a browser visitor sees at pay.speropay.app for every route
// EXCEPT /p/<token> and /auth/callback|/reset-password (see
// webRouteGuard.ts and app/_layout.tsx, the only place this is rendered).
// Spero's real product is the native Android app -- this is deliberately
// not a marketing site, not a login form, and not a scaled-down dashboard;
// just enough to tell a visitor what Spero is and point them at the app,
// or back at the payment link they actually came for.
export function WebLandingScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const playUrl = getGooglePlayUrl();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Generic, indexable metadata -- unlike /p and /c, there is no
          per-visitor private data here, so noindex is neither needed nor
          helpful (someone searching "Spero app" should be able to find
          this page). */}
      <Head>
        <title>Spero</title>
        <meta name="description" content="Manage crypto payments with Spero." />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Manage crypto payments with Spero." />
      </Head>
      <View style={styles.center}>
        <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
          <Logo size={56} />

          <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            Spero
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
            Request. Share. Get Paid.
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.primaryAction, marginTop: spacing.lg }]} />

          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            Manage crypto payments with Spero.
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }]}
          >
            Spero is designed for businesses on Android. Payment links and client portals can be opened directly in
            your browser.
          </Text>

          {playUrl ? (
            <View style={{ marginTop: spacing.xl, width: '100%' }}>
              <PrimaryButton
                label="Get Spero on Google Play"
                icon="logo-google-playstore"
                onPress={() => Linking.openURL(playUrl)}
              />
            </View>
          ) : (
            <View
              style={[
                styles.comingSoon,
                {
                  marginTop: spacing.xl,
                  borderRadius: radius.md,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  paddingVertical: spacing.base,
                  paddingHorizontal: spacing.lg,
                },
              ]}
            >
              <Text style={[typography.button, { color: colors.textMuted, textAlign: 'center' }]}>
                Coming soon to Google Play
              </Text>
            </View>
          )}

          <Text
            style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' }]}
          >
            If you received a payment link, open the original link sent by the business.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignItems: 'center' },
  divider: { width: 40, height: 3, borderRadius: 2 },
  comingSoon: { width: '100%', borderWidth: 1, alignItems: 'center' },
});
