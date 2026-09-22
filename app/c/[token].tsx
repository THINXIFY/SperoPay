import { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { BusinessLogo } from '../../src/components/BusinessLogo';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonLoader } from '../../src/components/SkeletonLoader';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { DetailRow } from '../../src/components/DetailRow';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { useCustomerPortal } from '../../src/services/customerPortal/useCustomerPortal';
import type { CustomerPortalData, CustomerPortalRequest } from '../../src/services/customerPortal/types';
import { deriveCustomerFacingStatus } from '../../src/utils/customerFacingStatus';
import { recurringFrequencyLabel } from '../../src/utils/recurringSchedule';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { sumByCurrency, getCurrenciesInUse } from '../../src/utils/currencyGrouping';
import { SUPPORTED_ASSETS } from '../../src/config/assets';

const MAX_CONTENT_WIDTH = 480;
const RECENT_PAYMENTS_PREVIEW_COUNT = 3;
// Below this combined count, Outstanding and Payment History are already
// short enough to scan as two plain stacked sections -- the filter would be
// a third navigation mechanism with nothing meaningful to filter yet
// (spec: "if there are many requests", not "always").
const FILTER_VISIBILITY_THRESHOLD = 4;

type PortalFilter = 'all' | 'outstanding' | 'paid';

function formatPortalDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
}

export default function ClientPortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors, spacing, typography } = useTheme();
  const { result, isRefreshing, refresh } = useCustomerPortal(token);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Same reasoning as the public checkout page's identical block --
          generic, non-identifying metadata only, never indexed. */}
      <Head>
        <title>Spero — Client Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Spero" />
        <meta property="og:description" content="Client billing portal" />
      </Head>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <View style={[styles.content, { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl }]}>
          {result === null ? (
            <PortalSkeleton />
          ) : !result.ok ? (
            <PortalErrorState code={result.code} onRetry={refresh} />
          ) : (
            <PortalContent data={result.data} />
          )}

          <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Powered by Spero</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PortalSkeleton() {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <SkeletonLoader width={56} height={56} style={{ borderRadius: radius.md }} />
        <SkeletonLoader width="50%" height={16} />
        <SkeletonLoader width="70%" height={12} />
      </View>
      <SkeletonLoader width="100%" height={100} style={{ marginTop: spacing.xl, borderRadius: radius.lg }} />
      <SkeletonLoader width="100%" height={120} style={{ borderRadius: radius.lg }} />
      <SkeletonLoader width="100%" height={120} style={{ borderRadius: radius.lg }} />
    </View>
  );
}

// Distinguishes a malformed link (never valid) from one that's expired/been
// revoked (was valid once) from a transient network problem -- a network
// failure must never read as "this link is dead" (spec's own explicit
// requirement), so only network_error gets a Try Again action.
function PortalErrorState({ code, onRetry }: { code: 'invalid_token' | 'not_found' | 'network_error'; onRetry: () => void }) {
  const { spacing } = useTheme();

  if (code === 'network_error') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="We couldn't load this portal"
          description="Check your connection and try again."
        />
        <View style={{ marginTop: spacing.lg }}>
          <SecondaryButton label="Try Again" onPress={onRetry} />
        </View>
      </View>
    );
  }

  if (code === 'invalid_token') {
    return (
      <View style={{ marginTop: spacing.xxl }}>
        <EmptyState
          icon="alert-circle-outline"
          title="This link isn't valid"
          description="Double-check the link, or ask the business to resend it."
        />
      </View>
    );
  }

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <EmptyState
        icon="lock-closed-outline"
        title="This portal link has expired"
        description="It may have been revoked. Please contact the business for a new link."
      />
    </View>
  );
}

function PortalSegmentFilter({ value, onChange }: { value: PortalFilter; onChange: (value: PortalFilter) => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const options: { value: PortalFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'outstanding', label: 'Outstanding' },
    { value: 'paid', label: 'Paid' },
  ];

  return (
    <View style={[styles.segmentRow, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.full, padding: 3 }]}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.segment,
              {
                backgroundColor: isActive ? colors.surface : 'transparent',
                borderRadius: radius.full,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Text style={[typography.caption, { color: isActive ? colors.textPrimary : colors.textMuted, fontWeight: isActive ? '600' : '400' }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const { colors, radius } = useTheme();
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.border, borderRadius: radius.full, marginTop: 6 }]}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: colors.primaryAction, borderRadius: radius.full }]} />
    </View>
  );
}

function statusPillColors(tone: ReturnType<typeof deriveCustomerFacingStatus>['tone'], colors: ReturnType<typeof useTheme>['colors']) {
  switch (tone) {
    case 'success':
      return { bg: colors.softMint, text: colors.softMintText };
    case 'danger':
      return { bg: colors.softRed, text: colors.softRedText };
    case 'warning':
      return { bg: colors.softLavender, text: colors.softLavenderText };
    case 'info':
      return { bg: colors.softBlue, text: colors.softBlueText };
    default:
      return { bg: colors.background, text: colors.textMuted };
  }
}

function StatusPill({ status, dueAt, verifiedPaidAmount, remainingAmount }: { status: CustomerPortalRequest['status']; dueAt: string | null; verifiedPaidAmount: number; remainingAmount: number }) {
  const { colors, spacing, radius, typography } = useTheme();
  const derived = deriveCustomerFacingStatus({ status, dueAt, verifiedPaidAmount, remainingAmount });
  const tone = statusPillColors(derived.tone, colors);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm }]}>
      <Text style={[typography.caption, { color: tone.text }]}>{derived.label}</Text>
    </View>
  );
}

interface PortalContentProps {
  data: CustomerPortalData;
}

function PortalContent({ data }: PortalContentProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const { identity, requests, payments, recurring } = data;
  const merchantName = identity.merchantName?.trim() || 'the business';
  const customerName = identity.customerName?.trim();

  const [filter, setFilter] = useState<PortalFilter>('all');
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [expandedTxHash, setExpandedTxHash] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CustomerPortalRequest | null>(null);
  const detailSheetRef = useRef<BottomSheet>(null);
  const [isDetailSheetMounted, setIsDetailSheetMounted] = useState(false);

  const outstanding = useMemo(
    () => requests.filter((r) => (r.status === 'pending' || r.status === 'confirming') && r.remainingAmount > 0),
    [requests]
  );
  const paidRequestCount = useMemo(() => requests.filter((r) => r.status === 'paid').length, [requests]);

  // Never a single combined number across assets (spec section 14) -- a
  // customer with both a USDC and a EURC request outstanding sees each
  // asset's own total, never "1000 USDC + 1000 EURC" added into one 2000.
  const outstandingByCurrency = useMemo(
    () => sumByCurrency(outstanding.map((r) => ({ currency: r.currency, amount: r.remainingAmount }))),
    [outstanding]
  );
  const outstandingCurrencies = SUPPORTED_ASSETS.filter((asset) => (outstandingByCurrency[asset] ?? 0) > 0);

  // "Total Paid" as one number is only meaningful (and safe) when every
  // payment shares one currency -- with two+ currencies present it's
  // omitted rather than silently summed across assets, the same rule the
  // Outstanding hero above already follows.
  const paidCurrencies = useMemo(() => getCurrenciesInUse(payments), [payments]);
  const totalPaidByCurrency = useMemo(() => sumByCurrency(payments), [payments]);
  const singleCurrencyTotalPaid = paidCurrencies.length === 1 ? totalPaidByCurrency[paidCurrencies[0]] : undefined;

  const showFilter = outstanding.length > 0 && payments.length > 0 && outstanding.length + payments.length > FILTER_VISIBILITY_THRESHOLD;
  const showOutstandingSection = filter !== 'paid';
  const showHistorySection = filter !== 'outstanding';
  const visiblePayments = showAllPayments ? payments : payments.slice(0, RECENT_PAYMENTS_PREVIEW_COUNT);

  function openRequestDetail(request: CustomerPortalRequest) {
    setSelectedRequest(request);
    if (isDetailSheetMounted) detailSheetRef.current?.expand();
    else setIsDetailSheetMounted(true);
  }

  function handlePayNow(request: CustomerPortalRequest) {
    detailSheetRef.current?.close();
    router.push(`/p/${request.publicToken}`);
  }

  const requestPayments = selectedRequest
    ? payments.filter((p) => p.requestPublicToken === selectedRequest.publicToken)
    : [];

  return (
    <View>
      {/* Merchant identity -- compact by design (spec: "avoid oversized
          empty header areas"): logo, business name, and who this portal is
          for, in one tight block rather than a separate greeting section. */}
      <View style={{ alignItems: 'center' }}>
        {identity.merchantLogoUrl ? (
          <BusinessLogo name={merchantName} logoUrl={identity.merchantLogoUrl} size={52} />
        ) : (
          <Logo size={44} />
        )}
        <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]} numberOfLines={1}>
          {merchantName}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2, textAlign: 'center' }]} numberOfLines={1}>
          {customerName ? `Payment portal for ${customerName}` : 'Payment portal'}
        </Text>
      </View>

      {/* Outstanding summary */}
      <ThemeAwareCard variant="hero" style={{ marginTop: spacing.xl }}>
        <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted }]}>Outstanding</Text>
        {outstandingCurrencies.length <= 1 ? (
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(outstandingCurrencies[0] ? outstandingByCurrency[outstandingCurrencies[0]]! : 0)}{' '}
            {outstandingCurrencies[0] ?? 'USDC'}
          </Text>
        ) : (
          outstandingCurrencies.map((asset) => (
            <Text key={asset} style={[typography.h2, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
              {formatCurrency(outstandingByCurrency[asset]!)} {asset}
            </Text>
          ))
        )}

        {/* Compact secondary stats -- three numbers, not a dashboard. */}
        <View style={[styles.heroStatsRow, { borderTopColor: colors.heroSurfaceBorder, marginTop: spacing.base, paddingTop: spacing.base }]}>
          <View style={styles.heroStat}>
            <Text style={[typography.bodyMedium, { color: colors.heroSurfaceText }]}>{outstanding.length}</Text>
            <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted, marginTop: 2 }]}>Open</Text>
          </View>
          <View style={[styles.heroStatDivider, { backgroundColor: colors.heroSurfaceBorder }]} />
          <View style={styles.heroStat}>
            <Text style={[typography.bodyMedium, { color: colors.heroSurfaceText }]}>{paidRequestCount}</Text>
            <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted, marginTop: 2 }]}>Paid</Text>
          </View>
          <View style={[styles.heroStatDivider, { backgroundColor: colors.heroSurfaceBorder }]} />
          <View style={styles.heroStat}>
            <Text style={[typography.bodyMedium, { color: colors.heroSurfaceText }]} numberOfLines={1}>
              {singleCurrencyTotalPaid != null ? formatCurrency(singleCurrencyTotalPaid) : payments.length}
            </Text>
            <Text style={[typography.caption, { color: colors.heroSurfaceTextMuted, marginTop: 2 }]} numberOfLines={1}>
              {singleCurrencyTotalPaid != null ? `Total Paid (${paidCurrencies[0]})` : 'Payments'}
            </Text>
          </View>
        </View>
      </ThemeAwareCard>

      {showFilter ? (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <PortalSegmentFilter value={filter} onChange={setFilter} />
        </View>
      ) : null}

      {/* Outstanding requests */}
      {showOutstandingSection ? (
        <View style={{ marginTop: spacing.xl }}>
          {outstanding.length === 0 ? (
            <ThemeAwareCard>
              <EmptyState icon="checkmark-circle-outline" title="No outstanding payments" description="You're all caught up." />
            </ThemeAwareCard>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {outstanding.map((request) => {
                const paidRatio = request.amount > 0 ? request.verifiedPaidAmount / request.amount : 0;
                return (
                  <Pressable key={request.publicToken} onPress={() => openRequestDetail(request)} accessibilityRole="button">
                    <ThemeAwareCard>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                          {request.description || 'Payment request'}
                        </Text>
                        <StatusPill
                          status={request.status}
                          dueAt={request.dueAt}
                          verifiedPaidAmount={request.verifiedPaidAmount}
                          remainingAmount={request.remainingAmount}
                        />
                      </View>
                      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{request.paymentCode}</Text>
                      <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                        {formatCurrency(request.amount)} {request.currency}
                      </Text>
                      {request.verifiedPaidAmount > 0 ? (
                        <View style={{ marginTop: spacing.xs }}>
                          <Text style={[typography.caption, { color: colors.textMuted }]}>
                            {formatCurrency(request.verifiedPaidAmount)} of {formatCurrency(request.amount)} paid
                          </Text>
                          <ProgressBar ratio={paidRatio} />
                        </View>
                      ) : request.dueAt ? (
                        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                          Due {formatPortalDate(request.dueAt)}
                        </Text>
                      ) : null}
                      <View style={{ marginTop: spacing.base }}>
                        <PrimaryButton
                          label={request.verifiedPaidAmount > 0 ? 'Continue payment' : 'Pay now'}
                          onPress={() => handlePayNow(request)}
                        />
                      </View>
                    </ThemeAwareCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {/* Recurring -- informational, unaffected by the Outstanding/Paid filter */}
      {recurring.length > 0 && filter !== 'paid' ? (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>RECURRING</Text>
          <View style={{ gap: spacing.sm }}>
            {recurring.map((plan, index) => (
              <ThemeAwareCard key={`${plan.description}-${index}`}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                  {plan.description || 'Recurring payment'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(plan.amount)} {plan.currency} · {recurringFrequencyLabel(plan.frequency, plan.customIntervalDays)}
                </Text>
                <View style={[styles.cardHeaderRow, { marginTop: spacing.sm }]}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Next billing</Text>
                  <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatPortalDate(plan.nextRunAt)}</Text>
                </View>
              </ThemeAwareCard>
            ))}
          </View>
        </View>
      ) : null}

      {/* Payment history */}
      {showHistorySection ? (
        <View style={{ marginTop: spacing.xl }}>
          <View style={styles.cardHeaderRow}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>PAYMENT HISTORY</Text>
            {payments.length > RECENT_PAYMENTS_PREVIEW_COUNT ? (
              <Pressable onPress={() => setShowAllPayments((v) => !v)} accessibilityRole="button">
                <Text style={[typography.caption, { color: colors.primaryAction }]}>{showAllPayments ? 'Show less' : 'View all'}</Text>
              </Pressable>
            ) : null}
          </View>
          {payments.length === 0 ? (
            <ThemeAwareCard style={{ marginTop: spacing.sm }}>
              <EmptyState icon="receipt-outline" title="No payment history yet" description="Your completed payments will appear here." />
            </ThemeAwareCard>
          ) : (
            <ThemeAwareCard style={{ marginTop: spacing.sm, padding: 0, overflow: 'hidden' }}>
              {visiblePayments.map((payment, index) => {
                const isExpanded = expandedTxHash === payment.txHash;
                return (
                  <Pressable
                    key={`${payment.txHash}-${index}`}
                    onPress={() => setExpandedTxHash(isExpanded ? null : payment.txHash)}
                    accessibilityRole="button"
                    accessibilityLabel={`${payment.requestDescription || 'Payment'}, ${isExpanded ? 'hide' : 'view'} receipt`}
                    style={{
                      paddingHorizontal: spacing.base,
                      paddingVertical: spacing.sm + spacing.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View style={styles.paymentRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>
                          {payment.requestDescription || 'Payment'}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{formatPortalDate(payment.paidAt)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                          {formatCurrency(payment.amount)} {payment.currency}
                        </Text>
                        <View style={[styles.pill, { backgroundColor: colors.softMint, borderRadius: radius.full, paddingHorizontal: spacing.sm, marginTop: 2 }]}>
                          <Text style={[typography.caption, { color: colors.softMintText }]}>Paid</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRow}>
                      <Text style={[typography.caption, { color: colors.primaryAction, marginTop: spacing.xs }]}>
                        {isExpanded ? 'Hide receipt' : 'View receipt'}
                      </Text>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.primaryAction} style={{ marginTop: spacing.xs }} />
                    </View>

                    {isExpanded ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <DetailRow label="Merchant" value={merchantName} />
                        <DetailRow label="Amount" value={`${formatCurrency(payment.amount)} ${payment.currency}`} />
                        <DetailRow label="Date" value={formatPortalDate(payment.paidAt)} />
                        <DetailRow label="Transaction" value={truncateHash(payment.txHash)} last />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ThemeAwareCard>
          )}
        </View>
      ) : null}

      {isDetailSheetMounted ? (
        <AppBottomSheet ref={detailSheetRef} initialIndex={0} scrollable>
          {selectedRequest ? (
            <RequestDetailContent
              request={selectedRequest}
              merchantName={merchantName}
              customerName={identity.customerName}
              payments={requestPayments}
              onPayNow={() => handlePayNow(selectedRequest)}
            />
          ) : null}
        </AppBottomSheet>
      ) : null}
    </View>
  );
}

interface RequestDetailContentProps {
  request: CustomerPortalRequest;
  merchantName: string;
  customerName: string | null;
  payments: CustomerPortalData['payments'];
  onPayNow: () => void;
}

function RequestDetailContent({ request, merchantName, customerName, payments, onPayNow }: RequestDetailContentProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [expandedTxHash, setExpandedTxHash] = useState<string | null>(null);
  const canPay = (request.status === 'pending' || request.status === 'confirming') && request.remainingAmount > 0;
  const isFullyPaid = request.remainingAmount <= 0 && request.verifiedPaidAmount > 0;
  const facingStatus = deriveCustomerFacingStatus({
    status: request.status,
    dueAt: request.dueAt,
    verifiedPaidAmount: request.verifiedPaidAmount,
    remainingAmount: request.remainingAmount,
  });

  return (
    <View>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{request.description || 'Payment request'}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{request.paymentCode}</Text>
      <View style={{ marginTop: spacing.sm }}>
        <StatusPill
          status={request.status}
          dueAt={request.dueAt}
          verifiedPaidAmount={request.verifiedPaidAmount}
          remainingAmount={request.remainingAmount}
        />
      </View>
      {facingStatus.subcopy ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>{facingStatus.subcopy}</Text>
      ) : null}

      {isFullyPaid ? (
        <View
          style={[styles.paidInFullBanner, { backgroundColor: colors.softMint, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.base }]}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.softMintText} />
          <Text style={[typography.bodySmall, { color: colors.softMintText, marginLeft: spacing.sm }]}>Paid in Full</Text>
        </View>
      ) : request.verifiedPaidAmount > 0 ? (
        <View style={{ marginTop: spacing.base }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatCurrency(request.verifiedPaidAmount)} of {formatCurrency(request.amount)} paid
          </Text>
          <ProgressBar ratio={request.amount > 0 ? request.verifiedPaidAmount / request.amount : 0} />
        </View>
      ) : null}

      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>INVOICE</Text>
      <ThemeAwareCard>
        <DetailRow label="Request" value={request.paymentCode} />
        <DetailRow label="Bill To" value={customerName || 'You'} />
        <DetailRow label="From" value={merchantName} />
        <DetailRow label="Amount" value={`${formatCurrency(request.amount)} ${request.currency}`} />
        {request.verifiedPaidAmount > 0 ? <DetailRow label="Paid" value={formatCurrency(request.verifiedPaidAmount)} /> : null}
        {request.remainingAmount > 0 ? <DetailRow label="Remaining" value={formatCurrency(request.remainingAmount)} /> : null}
        <DetailRow label="Due" value={request.dueAt ? formatPortalDate(request.dueAt) : 'No due date'} last />
      </ThemeAwareCard>

      {payments.length > 0 ? (
        <>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>PAYMENTS</Text>
          <ThemeAwareCard>
            {payments.map((payment, index) => {
              const isExpanded = expandedTxHash === payment.txHash;
              return (
                <Pressable
                  key={`${payment.txHash}-${index}`}
                  onPress={() => setExpandedTxHash(isExpanded ? null : payment.txHash)}
                  style={{ marginTop: index === 0 ? 0 : spacing.md, paddingTop: index === 0 ? 0 : spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {formatCurrency(payment.amount)} {payment.currency}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{formatPortalDate(payment.paidAt)}</Text>
                  </View>
                  <Text style={[typography.caption, { color: colors.primaryAction, marginTop: spacing.xs / 2 }]}>
                    {isExpanded ? 'Hide receipt' : 'View receipt'}
                  </Text>
                  {isExpanded ? (
                    <View style={{ marginTop: spacing.sm }}>
                      <DetailRow label="Merchant" value={merchantName} />
                      <DetailRow label="Amount" value={`${formatCurrency(payment.amount)} ${payment.currency}`} />
                      <DetailRow label="Date" value={formatPortalDate(payment.paidAt)} />
                      <DetailRow label="Transaction" value={truncateHash(payment.txHash)} last />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ThemeAwareCard>
        </>
      ) : null}

      {canPay ? (
        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton label={request.verifiedPaidAmount > 0 ? 'Continue payment' : 'Pay now'} onPress={onPayNow} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingVertical: 3 },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  paidInFullBanner: { flexDirection: 'row', alignItems: 'center' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 28 },
  segmentRow: { flexDirection: 'row', borderWidth: 1, alignSelf: 'center' },
  segment: { paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 5, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
