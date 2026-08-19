import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Share, Linking, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

function formatExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Expires ${dateLabel} · ${daysLeft}d`;
}

export default function CreatedScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const resetDraft = useRequestDraftStore((state) => state.reset);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  if (!request) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  function handleClose() {
    resetDraft();
    router.replace('/(app)/home');
  }

  async function handleCopyLink() {
    await Clipboard.setStringAsync(request!.paymentLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  }

  async function handleShare() {
    await Share.share({ message: request!.paymentLink, url: request!.paymentLink });
  }

  async function handleWhatsApp() {
    const message = `You have a payment request for ${formatCurrency(request!.amount)} USDC: ${request!.paymentLink}`;
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <View style={{ width: 40 }} />
        <IconButton name="close" onPress={handleClose} accessibilityLabel="Close" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <View
          style={[
            styles.successIcon,
            { backgroundColor: colors.primaryAction, borderRadius: radius.full, marginTop: spacing.md },
          ]}
        >
          <Ionicons name="checkmark" size={36} color={colors.primaryActionText} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Request Created!
        </Text>
        <Text
          style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}
        >
          Your payment request is ready to share.
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl },
          ]}
        >
          <Text style={[typography.heroNumber, { color: colors.textPrimary, textAlign: 'center' }]}>
            {formatCurrency(request.amount)} <Text style={typography.body}>{request.currency}</Text>
          </Text>
          {customer ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
              To {customer.name}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <QRCodeCard value={request.paymentLink} />
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Scan to Pay
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
            {formatExpiryLabel(request.expiresAt)} · {request.paymentCode}
          </Text>
        </View>

        <View style={{ width: '100%', marginTop: spacing.xl }}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            Share Payment Link
          </Text>
          <View
            style={[
              styles.linkRow,
              { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.base },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
            >
              {request.paymentLink}
            </Text>
            <Pressable onPress={handleCopyLink} accessibilityRole="button" accessibilityLabel="Copy link">
              <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={[styles.actionsRow, { marginTop: spacing.base, gap: spacing.md }]}>
            <IconButton name="copy-outline" onPress={handleCopyLink} accessibilityLabel="Copy link" />
            <IconButton name="share-outline" onPress={handleShare} accessibilityLabel="Share" />
            <IconButton name="qr-code-outline" onPress={() => setQrModalVisible(true)} accessibilityLabel="Show QR" />
            <IconButton name="logo-whatsapp" onPress={handleWhatsApp} accessibilityLabel="Share on WhatsApp" />
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Share Link" onPress={handleShare} />
      </View>

      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <Pressable
          style={[styles.qrBackdrop, { backgroundColor: 'rgba(5,5,5,0.85)' }]}
          onPress={() => setQrModalVisible(false)}
        >
          <QRCodeCard value={request.paymentLink} size={260} />
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  successIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', alignItems: 'center', borderWidth: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center' },
  qrBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
