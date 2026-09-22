import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/useTheme';
import { QRCodeCard } from './QRCodeCard';
import { PrimaryButton } from './PrimaryButton';
import { TextButton } from './TextButton';
import { useTemporaryBrightness } from '../hooks/useTemporaryBrightness';
import { formatCurrency } from '../utils/formatCurrency';
import { truncateHash } from '../utils/truncateHash';
import type { AssetSymbol } from '../config/assets';

interface FullScreenQRModalProps {
  visible: boolean;
  onClose: () => void;
  /** The exact canonical Solana Pay URI already built by solanaPayUri.ts -- never regenerated or re-derived here. */
  solanaPayUri: string | null;
  amount: number;
  currency: AssetSymbol;
  merchantName?: string;
  walletAddress?: string;
  publicLink?: string;
}

// A dedicated, premium full-screen QR experience -- reused identically
// from Request Created, Request Detail, and Public Checkout, so a
// merchant (or a payer) sees the exact same polished screen everywhere
// they ask to see a payment QR bigger. Renders whatever `solanaPayUri` it
// is given, verbatim -- it has no Solana/network logic of its own and
// never builds or mutates the URI, only displays it.
export function FullScreenQRModal({
  visible,
  onClose,
  solanaPayUri,
  amount,
  currency,
  merchantName,
  walletAddress,
  publicLink,
}: FullScreenQRModalProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const { boost, restore } = useTemporaryBrightness();
  // Mounted lazily on first open (avoids building the large QR before the
  // merchant has actually asked to see it) and stays mounted after that so
  // the modal's native fade-out on close has real content to animate,
  // instead of unmounting in the same commit the close starts -- same
  // pattern request/created.tsx's own QR modal already established.
  const [hasOpened, setHasOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uriCopied, setUriCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uriCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setHasOpened(true);
      boost();
    } else {
      restore();
      setCopied(false);
    }
    // Only re-runs on a genuine visible transition -- boost/restore are
    // stable (useCallback with an empty dependency array), never a fresh
    // function identity that would re-trigger this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (uriCopiedTimeoutRef.current) clearTimeout(uriCopiedTimeoutRef.current);
      restore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopyLink() {
    if (!publicLink) return;
    try {
      await Clipboard.setStringAsync(publicLink);
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Couldn't Copy", 'Please try again.');
    }
  }

  // Diagnostic aid, not a payment action: lets the exact literal Solana Pay
  // URI encoded into this QR be copied out and inspected verbatim (e.g.
  // pasted into a notes app or decoded with an independent QR reader) --
  // the only way to confirm, on a real device, that what a wallet's camera
  // scanner actually receives matches what buildSolanaPayUrl produced.
  // Solana Pay URIs are not secret (spec section 13's own reasoning,
  // already applied to requestDebugLog above), so copying the full value is safe.
  async function handleCopyRawUri() {
    if (!solanaPayUri) return;
    try {
      await Clipboard.setStringAsync(solanaPayUri);
      setUriCopied(true);
      if (uriCopiedTimeoutRef.current) clearTimeout(uriCopiedTimeoutRef.current);
      uriCopiedTimeoutRef.current = setTimeout(() => setUriCopied(false), 2000);
    } catch {
      Alert.alert("Couldn't Copy", 'Please try again.');
    }
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      {hasOpened ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.header, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <View style={{ width: 40 }} />
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Payment QR</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
            {solanaPayUri ? (
              <Pressable
                onLongPress={handleCopyRawUri}
                accessibilityRole="button"
                accessibilityLabel="Copy the raw Solana Pay URI for diagnostics"
                delayLongPress={500}
              >
                <QRCodeCard value={solanaPayUri} size={260} />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
                  {uriCopied ? 'URI copied' : 'Hold to copy raw URI'}
                </Text>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.qrPlaceholder,
                  { width: 260, height: 260, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
                ]}
              >
                <Ionicons name="qr-code-outline" size={40} color={colors.textMuted} />
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                  Add a receiving wallet to generate a scannable QR.
                </Text>
              </View>
            )}

            <Text style={[typography.heroNumber, { color: colors.textPrimary, marginTop: spacing.xl, textAlign: 'center' }]} numberOfLines={1}>
              {formatCurrency(amount)} <Text style={typography.h2}>{currency}</Text>
            </Text>

            {merchantName ? (
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]} numberOfLines={1}>
                {merchantName}
              </Text>
            ) : null}

            <View style={[styles.metaRow, { marginTop: spacing.md }]}>
              <View style={[styles.networkDot, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]} />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs }]}>Solana</Text>
              {walletAddress ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.sm }]}>
                  {truncateHash(walletAddress)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm }}>
            {publicLink ? <PrimaryButton label={copied ? 'Link Copied' : 'Copy Payment Link'} onPress={handleCopyLink} /> : null}
            <View style={{ alignItems: 'center' }}>
              <TextButton label="Close" onPress={onClose} />
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, padding: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  networkDot: { width: 6, height: 6 },
});
