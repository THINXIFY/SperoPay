import { useMemo } from 'react';
import { useRequestStore } from './requestStore';
import { useCustomerStore } from './customerStore';
import { useTransactionStore } from './transactionStore';
import { useReportsFilterStore } from './reportsFilterStore';
import { useRefreshCustomerData } from './useRefreshCustomerData';
import { resolveReportDateRange, getPreviousReportDateRange, type ReportDateRange } from '../utils/reportDateRange';
import { formatDateOnly } from '../utils/parseDateOnly';
import { getCurrenciesInUse } from '../utils/currencyGrouping';
import type { AssetSymbol } from '../config/assets';

export interface ReportsData {
  // Phase 7: already filtered down to `selectedCurrency` -- every existing
  // report calculation (getReportsSummary, getPaymentsReportRows, ...)
  // keeps operating on a single asset's data with no changes of its own,
  // the same way it always has. `customers` is NOT currency-filtered --
  // customer identity has no currency of its own.
  requests: ReturnType<typeof useRequestStore.getState>['requests'];
  customers: ReturnType<typeof useCustomerStore.getState>['customers'];
  transactions: ReturnType<typeof useTransactionStore.getState>['transactions'];
  range: ReportDateRange;
  previousRange: ReportDateRange;
  rangeLabel: string;
  now: Date;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  customerId: string | null;
  amountMin: number | null;
  amountMax: number | null;
  // Every currency actually present across this merchant's requests/
  // transactions (unfiltered by date range, canonical order) -- empty for a
  // brand-new account. A screen shows its currency selector chips only when
  // this has more than one entry; a single-currency merchant never sees it.
  currencies: AssetSymbol[];
  selectedCurrency: AssetSymbol;
  setCurrency: (currency: AssetSymbol | null) => void;
  // Count of the SHARED filters only (customer + amount range) -- a
  // screen's own local status filter (see reportsFilterStore.ts's header
  // comment for why status isn't shared) is added to this by the screen
  // itself when it renders its "Filters · N" trigger.
  sharedFilterCount: number;
}

// The one shared hook every Reports screen builds on -- centralizes
// reading the three store arrays (each already selected as a stable raw
// reference, see e.g. requestStore.ts's own array identity, never a
// freshly-allocated derived array from inside a selector -- the same
// "Maximum update depth" hazard requests/[id].tsx's own comment documents)
// and resolving the currently-selected date range from reportsFilterStore.
// Individual screens layer their own report-specific useMemo calculations
// (getPaymentsReportRows etc.) on top of what this returns.
export function useReportsData(): ReportsData {
  const allRequests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const allTransactions = useTransactionStore((state) => state.transactions);
  const { refresh, isRefreshing } = useRefreshCustomerData();

  const datePreset = useReportsFilterStore((state) => state.datePreset);
  const customStartIso = useReportsFilterStore((state) => state.customStartIso);
  const customEndIso = useReportsFilterStore((state) => state.customEndIso);
  const customerId = useReportsFilterStore((state) => state.customerId);
  const amountMin = useReportsFilterStore((state) => state.amountMin);
  const amountMax = useReportsFilterStore((state) => state.amountMax);
  const rawSelectedCurrency = useReportsFilterStore((state) => state.currency);
  const setCurrency = useReportsFilterStore((state) => state.setCurrency);

  const currencies = useMemo(() => getCurrenciesInUse(allRequests, allTransactions), [allRequests, allTransactions]);
  // Never mix assets into one number (spec section 14) -- every report
  // calculation below runs against exactly one currency's data at a time.
  // Falls back to the first currency actually in use (canonical order),
  // then DEFAULT_ASSET for a brand-new account with no data at all yet.
  const selectedCurrency = rawSelectedCurrency && currencies.includes(rawSelectedCurrency) ? rawSelectedCurrency : currencies[0] ?? 'USDC';
  const requests = useMemo(() => allRequests.filter((r) => r.currency === selectedCurrency), [allRequests, selectedCurrency]);
  const transactions = useMemo(() => allTransactions.filter((t) => t.currency === selectedCurrency), [allTransactions, selectedCurrency]);

  // One snapshot per mount, matching analytics.tsx's own established
  // convention -- every calculation on this screen visit reads the same
  // "now", so a chart/summary pair can never disagree about the current
  // instant mid-render.
  const now = useMemo(() => new Date(), []);

  const range = useMemo(() => {
    const custom =
      datePreset === 'custom' && customStartIso && customEndIso
        ? { start: new Date(customStartIso), end: new Date(customEndIso) }
        : undefined;
    return resolveReportDateRange(datePreset, now, custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customStartIso, customEndIso, now]);

  const previousRange = useMemo(() => getPreviousReportDateRange(range), [range]);

  const rangeLabel = useMemo(() => {
    if (datePreset === 'custom' && customStartIso && customEndIso) {
      const inclusiveEnd = new Date(new Date(customEndIso).getTime() - 1);
      return `${formatDateOnly(new Date(customStartIso))} – ${formatDateOnly(inclusiveEnd)}`;
    }
    return range.label;
  }, [datePreset, customStartIso, customEndIso, range.label]);

  const sharedFilterCount = (customerId ? 1 : 0) + (amountMin !== null || amountMax !== null ? 1 : 0);

  return {
    requests,
    customers,
    transactions,
    range,
    previousRange,
    rangeLabel,
    now,
    refresh,
    isRefreshing,
    customerId,
    amountMin,
    amountMax,
    currencies,
    selectedCurrency,
    setCurrency,
    sharedFilterCount,
  };
}
