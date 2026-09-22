import { create } from 'zustand';
import { registerResettable } from './dataLifecycle';
import type { ReportDateRangePreset } from '../utils/reportDateRange';
import type { AssetSymbol } from '../config/assets';

// Phase 6B Reports -- the single shared date range + filter selection every
// Reports screen reads from, so navigating Reports Home -> Payments ->
// Outstanding etc. never shows a different period than the one the merchant
// picked (spec: "Exports must respect the currently selected report, date
// range, and filters" -- the same applies to on-screen totals, not just
// exports). In-memory only, like requestDraftStore -- no network load, no
// persistence, reset on sign-out via registerResettable below.
//
// Deliberately does NOT hold a "status" filter: unlike date range/customer/
// amount (which mean the exact same thing on every report screen), "status"
// means something different per report -- Payments' Paid/Partial isn't
// Outstanding's Pending/Partially Paid/Overdue. Sharing one global status
// value across screens with different vocabularies would silently misapply
// a selection made on one screen to an unrelated one. Each report screen
// therefore owns its own local status filter state instead.
interface ReportsFilterState {
  datePreset: ReportDateRangePreset;
  // Only meaningful when datePreset === 'custom' -- ISO date strings.
  customStartIso: string | null;
  customEndIso: string | null;
  customerId: string | null;
  amountMin: number | null;
  amountMax: number | null;
  // Phase 7: null means "no explicit choice yet" -- useReportsData resolves
  // this to whichever currency the merchant's data actually uses (the first
  // one, in canonical order, when more than one is present). Shared across
  // every Reports screen for the same reason date range is: switching
  // Payments -> Outstanding -> Customers must never silently change which
  // asset's numbers are on screen.
  currency: AssetSymbol | null;
  setDatePreset: (preset: ReportDateRangePreset) => void;
  setCustomRange: (startIso: string | null, endIso: string | null) => void;
  setCustomerId: (customerId: string | null) => void;
  setAmountRange: (min: number | null, max: number | null) => void;
  setCurrency: (currency: AssetSymbol | null) => void;
  resetFilters: () => void;
  reset: () => void;
}

const initialState = {
  datePreset: 'thisMonth' as ReportDateRangePreset,
  customStartIso: null as string | null,
  customEndIso: null as string | null,
  customerId: null as string | null,
  amountMin: null as number | null,
  amountMax: null as number | null,
  currency: null as AssetSymbol | null,
};

export const useReportsFilterStore = create<ReportsFilterState>()((set) => ({
  ...initialState,
  setDatePreset: (datePreset) => set({ datePreset }),
  setCustomRange: (customStartIso, customEndIso) => set({ datePreset: 'custom', customStartIso, customEndIso }),
  setCustomerId: (customerId) => set({ customerId }),
  setAmountRange: (amountMin, amountMax) => set({ amountMin, amountMax }),
  setCurrency: (currency) => set({ currency }),
  // Clears only the narrowing filters (Filters sheet's own "Reset"), the
  // date range is a separate, top-level control and is intentionally left
  // untouched by this -- matches the spec's Filters sheet being scoped to
  // Customer/Status/Amount, with Date Range as Reports Home's own control.
  // Currency is also left untouched -- it's not a "Filters sheet" concern,
  // it's a top-level asset selector the same way date range is.
  resetFilters: () => set({ customerId: null, amountMin: null, amountMax: null }),
  reset: () => set({ ...initialState }),
}));

registerResettable(() => useReportsFilterStore.getState().reset());
