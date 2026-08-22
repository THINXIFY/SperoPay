# Phase 2D: Premium UI/UX Redesign — Profile & Smart Request Amount

**Goal:** Raise Profile and Smart Request (Amount) to premium fintech visual quality — hierarchy, alignment, density, dark-mode parity, micro-interactions. No business/payment/auth logic changes.

**Architecture:** Direct execution, task-by-task, `tsc`/`jest` checked after each group, one commit per group.

---

## Design decisions (from survey findings)

- **Profile's rows/labels are 100% hand-rolled inline** (`Row`/`SectionLabel` are file-local functions, not shared components) — extract to `src/components/SettingsRow.tsx`, `SettingsGroup.tsx`, `SectionLabel.tsx`, matching the spec's explicit "potential shared improvements" list.
- **Profile's avatar duplicates `CustomerAvatar`'s soft-color-initials pattern by hand** instead of reusing it — switch to `<CustomerAvatar>` (already supports `size` + `avatarColor`, gives 2-letter initials instead of 1).
- **Icon sizes are inconsistent** (row icon 20 vs chevron 18, keypad backspace 24 vs digit glyph 28) — not a functional bug, but visually undisciplined; standardize within each context.
- **Sign Out has zero destructive visual treatment today** — icon/label are identical styling to every other row.
- **Amount display has no tabular-nums and no `maxFontSizeMultiplier` cap** — digit width can jitter per-keystroke, and OS accessibility text scaling can fight `adjustsFontSizeToFit` unpredictably.
- **NumericKeypad uses percentage-width (`33.33%`) + `flexWrap`, no `gap`, only opacity press feedback** — real RN `gap` (supported at RN 0.86.2) makes a row-based flex grid more robust and enables real premium press feedback.
- **The Network card is a full mint-fill rectangle** (`backgroundColor: colors.softMint` on the whole card) — this is the "oversized mint rectangle" the spec objects to. Restructure to a neutral bordered row with a small mint icon-chip instead, matching the spec's suggested `[icon] Solana / Fast · Low fees ... Change >` structure.
- **The Stablecoin selector is a bare bordered box with no icon** — add a small identity chip, consistent with the Network row's new treatment.
- **Amount screen has no `ScrollView`** — survey confirmed a real (not imagined) crowding risk: question + amount + keypad + selector + network + footer is a tall fixed stack with no scroll fallback, so on a small device (iPhone SE-class, ~560pt available) it can compress content with nothing to relieve it. This is the actual mechanism behind the reported Continue/network-card crowding — fix by wrapping the mid-screen stack in a `ScrollView` (invisible/inert on screens tall enough not to need it).
- **`AppBottomSheet` already supports per-consumer `snapPoints` override** via its `{...rest}` spread (confirmed: no consumer currently uses it). For the user's explicit "make the network slide open automatically fully" ask: both the redesigned Stablecoin and Network sheets are small, single-row, fixed-content sheets — give them a single small `snapPoints` (`['28%']`) instead of the default `['40%','70%']`, so `.expand()` snaps directly to a height matched to their actual content in one motion, with no intermediate stage.

---

## Task 1 — New shared components

**`src/components/SectionLabel.tsx`** (new): extracted from Profile, unchanged visual behavior (`typography.caption`, `colors.textMuted`), `marginTop` tightened from `spacing.xl` (24) to `spacing.lg` (20) for tighter section rhythm per spec's density ask.

**`src/components/SettingsRow.tsx`** (new): props `icon: Ionicons glyph`, `label: string`, `value?: string`, `onPress: () => void`, `destructive?: boolean`. Fixed icon column (`width: 24`, icon `size={18}` centered inside — one consistent box regardless of which glyph), `minHeight: 48` with `alignItems:'center'` for exact vertical centering and a real (not just visually-adequate) touch target, chevron pinned at `size={18}` (matches icon size now — this was the alignment/consistency point). `destructive` swaps icon+label color to `colors.error` (both, not just one) — the standard, restrained "Settings app" treatment the spec asked for, no background tint or bolder weight.

**`src/components/SettingsGroup.tsx`** (new): wraps children in `ThemeAwareCard` (`paddingVertical:0`, unchanged) and inserts a hairline `borderBottomWidth:1, borderBottomColor: colors.border` divider between rows (not after the last) via `React.Children` — this is the "divider treatment" the row-alignment section asked for a decision on; full-bleed hairlines (not inset) since the card padding already provides the horizontal margin.

**`src/components/KeypadKey.tsx`** (new): extracted single keypad key — `flex:1`, press feedback `opacity: pressed?0.6:1` + `transform:[{scale: pressed?0.94:1}]` + a transient `backgroundColor: pressed ? colors.surface : 'transparent'` with `borderRadius: radius.lg` (the "premium calculator" flash-on-press feel, no permanent border/outline — keeps the "minimal but large touch area" requirement). Digit glyph stays `typography.h1`; backspace icon bumped `24→26` for closer visual parity with the digit glyphs' visual weight.

**`src/components/SelectField.tsx`** (new): compact bordered selector row — leading optional icon-chip slot, label, trailing chevron. Used only by Amount's Stablecoin selector (not retrofitted elsewhere — out of scope per the spec's "do not redesign unrelated screens").

Verify: `npx tsc --noEmit` clean (components not wired up yet, just compiling standalone).

## Task 2 — Profile screen rebuild

**File:** `app/(app)/profile/index.tsx`

- Replace file-local `Row`/`SectionLabel` with the new `SettingsRow`/`SettingsGroup`/`SectionLabel` components; delete the local definitions.
- Identity card: replace the hand-rolled avatar `View` with `<CustomerAvatar name={resolvedName} color="mint" size={48} />` (56→48, tighter/more proportionate; gains 2-letter initials for free). Name upgraded `typography.bodyMedium` → `typography.h3` (stronger hierarchy per spec). Email gets `numberOfLines={1}` for graceful truncation (spec explicitly required this; today it has none). Card becomes `Pressable` (`onPress` → `/(app)/profile/edit`) with a trailing chevron matching the row grid's chevron treatment, so the card visually joins the same alignment system instead of being a one-off.
- Page title: `marginBottom` tightened `spacing.xl` (24) → `spacing.lg` (20).
- Sign Out: `<SettingsRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} destructive />`.
- All five sections switch from `<ThemeAwareCard style={{paddingVertical:0}}>` + manually-listed `<Row>`s to `<SettingsGroup>` + `<SettingsRow>`s — same content/order/navigation targets, zero logic change.

Verify: `npx tsc --noEmit` clean.

## Task 3 — Amount screen rebuild

**File:** `src/components/NumericKeypad.tsx`
- Replace the `flexWrap`/`33.33%` grid with 4 explicit rows (`['1','2','3']`, `['4','5','6']`, `['7','8','9']`, `['.','0','delete']`), each a `flexDirection:'row'` with `gap: spacing.sm`, outer container `gap: spacing.sm` — real RN `gap`, no percentage math, scales to any width by construction.
- Each key renders via the new `KeypadKey` component (`flex:1`).

**File:** `src/components/AmountInput.tsx`
- Add `fontVariant: ['tabular-nums']` and `maxFontSizeMultiplier={1.3}` to the amount `Text` (the two concrete "numeric-friendly font settings" / "dynamic font scaling within reasonable bounds" fixes the spec asked for). No other layout change — `adjustsFontSizeToFit`/`minimumFontScale={0.5}` already handle the growing-digit-count requirement correctly per the survey.

**File:** `app/request/amount.tsx`
- Wrap the question/amount/selector/network stack in a `ScrollView` (`contentContainerStyle={{flexGrow:1}}`, `showsVerticalScrollIndicator={false}`) inside the existing `flex:1` `View` — the concrete fix for the crowding/collision risk (Task rationale above). Adds a scroll fallback for small devices without changing anything on devices tall enough not to need it.
- Question text: reduce `marginTop`/spacing slightly for better balance (`paddingTop: spacing.lg` on the container stays; add explicit `marginBottom: spacing.lg` under the question instead of relying on the `AmountInput` wrapper's `marginTop: spacing.xl` alone — net effect is a slightly more controlled gap, not a bigger one).
- Stablecoin selector: replace the bare bordered `Pressable` with `<SelectField icon="ellipse" label="USDC" onPress={...} />` (a small filled-circle "coin" glyph as the leading icon chip — monochrome, not a crypto logo, matching "avoid crypto-style neon" while still giving the row a clear identity anchor). Fixed `height:52` replaced with `paddingVertical: spacing.md` + `minHeight: 52` (same visual height, token-driven padding instead of a bare magic number for the vertical rhythm).
- Network row: replace the full-`softMint`-fill card with a neutral-bordered row (`colors.surface` background, `colors.border` border — matching the Stablecoin selector's treatment) containing: a small `28×28` circular icon-chip tinted `colors.softMint`/`colors.softMintText` (keeps the brand's soft-color language in a restrained way instead of painting the whole card), "Solana" (`bodyMedium`) + "Fast · Low fees" (`caption`, muted — dropped "· Secure" per the spec's own "avoid excessive promotional language" note) stacked, and a trailing "Change ›" (`bodySmall`, muted) right-aligned — matches the spec's suggested structure exactly.
- Footer: add `paddingTop: spacing.md` to the footer container (currently only `paddingHorizontal`/`paddingBottom`) to guarantee a minimum visual gap above the Continue button regardless of content height, on top of the ScrollView fix above.
- Both `AppBottomSheet` instances (stablecoin, network) get `snapPoints={['28%']}` passed explicitly — the "make the network slide open automatically fully" fix: content is now small and fixed (heading + one row), so a single snap point sized to it means `.expand()` opens fully in one motion instead of defaulting to the two-stage `40%/70%`.

Verify: `npx tsc --noEmit` clean; `npx jest` green (no logic touched — `isValidAmount`/`handleContinue`/store calls unchanged).

## Task 4 — Cross-check against both screens' consumers of touched shared bits

- `AppBottomSheet`, `ThemeAwareCard`, `CustomerAvatar`, `PrimaryButton` are all used elsewhere in the app (confirmed via the Phase 2C review's own consumer list) — none of Task 1-3's changes touch those files' own source, only Amount/Profile's *usage* of them via new props (`snapPoints` override, `CustomerAvatar` size/color) — no risk of regressing other screens. Explicitly re-verify this assumption by grepping for any accidental edit to a shared file beyond the 5 new ones + the 2 target-screen files + `NumericKeypad.tsx`/`AmountInput.tsx`.

## Task 5 — Light/Dark + small-screen pass

- Grep every new/touched file for hardcoded hex colors — fix any found.
- Manually trace the new Network icon-chip and SettingsRow `destructive` treatment against both `lightColors`/`darkColors` token values already captured in the survey (both are theme-token-driven by construction, so this is a verification step, not new work).

## Final steps

1. Full `npx tsc --noEmit` + `npx jest` — clean/green.
2. Holistic review (opus) against the full branch diff — focus on: alignment math (fixed-width icon columns, chevron consistency), the new `ScrollView` not breaking the existing `flex:1`/keypad layout, `SettingsGroup`'s divider-insertion logic not misbehaving with 1-row groups (Session/Sign Out), `snapPoints={['28%']}` not clipping the sheets' actual rendered content, no accidental logic changes.
3. Fix findings, re-verify.
4. `finishing-a-development-branch` skill.
5. Deliver the final report in the format the spec's "FINAL REPORT" section requested.
