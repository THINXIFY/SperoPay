import React from 'react';
import { View, Text, Linking, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Head from 'expo-router/head';
import { useTheme } from '../theme/useTheme';
import { Logo } from './Logo';
import { PrimaryButton } from './PrimaryButton';
import { TextButton } from './TextButton';
import { getGooglePlayUrl } from '../utils/googlePlayUrl';

const MAX_CONTENT_WIDTH = 720;
const NARROW_BREAKPOINT = 640;

const STEPS = [
  { number: '1', label: 'Open payment link' },
  { number: '2', label: 'Pay from your wallet' },
  { number: '3', label: 'Receive confirmation' },
] as const;

const TRUST_POINTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'shield-checkmark-outline', label: 'Non-custodial' },
  { icon: 'wallet-outline', label: 'Funds go directly to the business wallet' },
  { icon: 'flash-outline', label: 'USDC on Solana' },
  { icon: 'checkmark-done-outline', label: 'Verified on-chain' },
];

// Phase 5B: what a browser visitor sees at pay.speropay.app for every route
// EXCEPT /p/<token>, /c/<token>, /invoice/<token>, /receipt/<token>, and
// /auth/callback|/reset-password (see webRouteGuard.ts and app/_layout.tsx,
// the only place this is rendered). This doubles as both the real root
// landing (a visitor who typed pay.speropay.app directly) and the fallback
// for an unknown/mistyped path -- one polished "here's what Spero is"
// screen serves both, deliberately not split into two components. Spero's
// real product is the native Android app; this is a minimal premium
// gateway, not the marketing site (that's the bare speropay.app domain).
// Swallows a rejected Linking.openURL (a popup blocker, a restricted in-app
// browser that disallows opening external URLs) rather than leaving an
// unhandled promise rejection -- this is a non-critical marketing-link
// navigation, not a payment action, so failing silently (no modal) is the
// right amount of ceremony; the point is just not to throw unhandled.
function openExternal(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function WebLandingScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_BREAKPOINT;
  const playUrl = getGooglePlayUrl();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Generic, indexable metadata -- unlike /p and /c, there is no
          per-visitor private data here, so noindex is neither needed nor
          helpful (someone searching "Spero app" should be able to find
          this page). */}
      <Head>
        <title>Spero — Secure Crypto Payments</title>
        <meta name="description" content="Secure crypto payments for modern businesses. Request, share, and get paid in USDC on Solana." />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Secure crypto payments for modern businesses." />
      </Head>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl }]}>
          {/* Brand */}
          <View style={styles.center}>
            <Logo size={56} />
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>Spero</Text>
          </View>

          {/* Headline */}
          <Text
            style={[
              typography.display,
              { color: colors.textPrimary, marginTop: spacing.xxl, textAlign: 'center', fontSize: isNarrow ? 32 : 40, lineHeight: isNarrow ? 38 : 46 },
            ]}
          >
            Request. Share. Get Paid.
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Secure crypto payments for modern businesses.
          </Text>

          {/* 3-step flow */}
          <View
            style={[
              isNarrow ? styles.stepsColumn : styles.stepsRow,
              { marginTop: spacing.xxl, gap: isNarrow ? spacing.base : spacing.lg },
            ]}
          >
            {STEPS.map((step, index) => (
              <React.Fragment key={step.number}>
                <View style={[styles.stepItem, isNarrow ? styles.stepItemRow : styles.stepItemColumn]}>
                  <View
                    style={[
                      styles.stepBadge,
                      {
                        backgroundColor: colors.heroSurface,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typography.bodyMedium, { color: colors.primaryAction }]}>{step.number}</Text>
                  </View>
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: colors.textPrimary,
                        marginTop: isNarrow ? 0 : spacing.sm,
                        marginLeft: isNarrow ? spacing.base : 0,
                        textAlign: isNarrow ? 'left' : 'center',
                        flex: isNarrow ? 1 : undefined,
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
                {!isNarrow && index < STEPS.length - 1 ? (
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={styles.stepArrow} />
                ) : null}
              </React.Fragment>
            ))}
          </View>

          {/* Trust points */}
          <View style={[styles.trustGrid, { marginTop: spacing.xxl, gap: spacing.sm }]}>
            {TRUST_POINTS.map((point) => (
              <View
                key={point.label}
                style={[
                  styles.trustItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.base,
                    width: isNarrow ? '100%' : '48%',
                  },
                ]}
              >
                <Ionicons name={point.icon} size={16} color={colors.textPrimary} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm, flex: 1 }]}>{point.label}</Text>
              </View>
            ))}
          </View>

          {/* Primary CTA */}
          {playUrl ? (
            <View style={{ marginTop: spacing.xxl, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
              <PrimaryButton
                label="Get Spero on Google Play"
                icon="logo-google-playstore"
                onPress={() => openExternal(playUrl)}
              />
            </View>
          ) : (
            <View
              style={[
                styles.comingSoon,
                {
                  marginTop: spacing.xxl,
                  maxWidth: 360,
                  alignSelf: 'center',
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

          <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <TextButton label="Learn more about Spero" onPress={() => openExternal('https://speropay.app')} />
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' }]}>
            If you received a payment link, open the original link sent by the business.
          </Text>

          {/* Footer */}
          <View style={[styles.footer, { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopColor: colors.border }]}>
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              © {new Date().getFullYear()} Spero. Built on Solana.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // No justifyContent: 'center' here -- on a viewport shorter than the
  // content (very possible now: logo, headline, 3-step flow, 4 trust
  // rows, CTA, footer), centering pushes the overflow symmetrically above
  // AND below this box. The portion pushed above sits at a negative
  // scroll offset a browser will never let the user scroll to, so the
  // logo/headline would be permanently cut off on a short viewport.
  // alignItems: 'center' alone still centers everything horizontally;
  // content simply starts from the top and scrolls normally, matching the
  // proven pattern app/p/[token].tsx's own scrollContent already uses.
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  center: { alignItems: 'center' },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  stepsColumn: { flexDirection: 'column' },
  stepItem: { alignItems: 'center' },
  stepItemColumn: { width: 120 },
  stepItemRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepArrow: { marginTop: 8 },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  trustItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  comingSoon: { width: '100%', borderWidth: 1, alignItems: 'center' },
  footer: { width: '100%', borderTopWidth: 1 },
});
