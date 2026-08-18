# ThinxPay — Phase 1A: Foundation, Design System & Core Payment Request Experience

Status: Approved
Date: 2026-08-18

## 1. Purpose

Build the complete frontend foundation for ThinxPay, a premium mobile fintech app that lets freelancers, agencies, creators, and small businesses request stablecoin payments via payment links and QR codes. Phase 1A covers the full flow from Splash through creating and sharing a payment request, using **mock/local data only** — no backend, blockchain, wallet provider, or real authentication.

Core promise: **Request. Share. Get Paid.**

## 2. Technology

- React Native + Expo (managed workflow) + TypeScript + Expo Router
- State: Zustand, persisted to AsyncStorage where continuity matters (theme, auth/onboarding completion, profile, wallet, created requests)
- Styling: plain `StyleSheet` + a theme-token system (`useTheme()` hook) — no Tailwind/NativeWind, no heavy UI kit
- Bottom sheets: `@gorhom/bottom-sheet`
- QR rendering: `react-native-qrcode-svg`
- Icons: `@expo/vector-icons`
- Display/headline font: **Plus Jakarta Sans** via `expo-font` / `@expo-google-fonts/plus-jakarta-sans` (bold weights for large financial numerals)

## 3. Folder structure

```
app/                          # Expo Router file-based routes
  _layout.tsx                 # Root layout: font loading, theme provider, splash control
  index.tsx                   # Splash screen
  (auth)/
    _layout.tsx
    welcome.tsx
    sign-up.tsx
    login.tsx
    forgot-password.tsx
  (onboarding)/
    _layout.tsx
    usage-type.tsx
    profile.tsx
    wallet-setup.tsx
  (app)/
    _layout.tsx                # Tab navigator: Home, Requests, [center Request], Customers, Profile
    home.tsx
    requests/index.tsx
    requests/[id].tsx
    customers/index.tsx
    profile/index.tsx
  request/
    _layout.tsx                # Stacked modal flow pushed from the tab bar's center action
    amount.tsx
    details.tsx
    created.tsx

src/
  components/                 # Reusable UI primitives
  theme/                      # tokens.ts, ThemeProvider, useTheme()
  store/                      # Zustand slices: auth, onboarding, profile, wallet, theme, requests, customers
  types/                      # User, Profile, Wallet, Customer, PaymentRequest, etc.
  data/                       # mock data: customers, activity, requests
  utils/                      # formatCurrency, formatRelativeTime, id generation, validators
```

Stores are shaped so Phase 1B can swap mock logic for real API calls without changing call sites (actions return promises even though they resolve synchronously today).

## 4. Visual system

### Brand
- Black `#050505`, White `#FFFFFF`, Electric Lime `#C7F500`, Lime Pressed `#B2DD00`

### Light theme (default)
Background `#F5F6F4` · Surface `#FFFFFF` · Strong Surface `#050505` · Primary Text `#0A0A0A` · Secondary Text `#707070` · Muted Text `#A1A1A1` · Border `#E7E7E4` · Primary Action `#C7F500` · Primary Action Text `#050505`

### Dark theme
Background `#050505` · Main Surface `#111111` · Raised Surface `#191919` · Primary Text `#FFFFFF` · Secondary Text `#A8A8A8` · Border `#292929` · Primary Action `#C7F500` · Primary Action Text `#050505`

### Secondary accent surfaces (small controlled areas only)
Soft Mint `#DDF7E7` · Soft Lavender `#DDD8FF` · Soft Blue `#E4F3FF` · Soft Red `#FFE8E8`

### Status colors
Success `#22C55E` · Pending `#F59E0B` · Error `#EF4444` · Expired: muted red/pink

### Philosophy
Premium, modern, minimal, spacious, confident. Strong black sections, white surfaces, lime CTAs, large bold typography for financial figures, rounded rectangular cards, thin borders, clear hierarchy. Avoid: gradients, neon crypto aesthetic, glassmorphism, oversized rounded cards, excessive shadows, overcrowded dashboards, rainbow color use.

### Theming mechanics
`ThemeProvider` (Context, backed by a persisted Zustand `themeStore`) exposes `useTheme() -> { colors, spacing, typography, mode }`. Resolution order: stored preference → if `'system'`, follow `useColorScheme()` → if nothing stored yet, **Light**. All components consume colors via `useTheme()`; no hardcoded hex in component files.

### Spacing scale
4, 8, 12, 16, 20, 24, 32 — consistent horizontal padding throughout.

## 5. Navigation map

Splash → Welcome → (Sign Up | Login → Forgot Password) → Onboarding (Usage Type → Profile → Wallet Setup) → Home (tabs: Home, Requests, **Request**, Customers, Profile) → Smart Request modal flow (Amount → Details → Creating → Created) → Share Payment.

Route groups gate navigation by auth/onboarding completion state read from the stores. The center tab-bar **Request** action is visually distinct (lime, elevated) and pushes the `request/` stacked flow.

## 6. Screens (full inventory)

Splash, Welcome, Sign Up, Login, Forgot Password, Onboarding Step 1 (Usage Type), Onboarding Step 2 (Profile), Onboarding Step 3 (Wallet Setup), Home, Requests list, Customers list, Profile, Smart Request — Amount, Request Details, Request Creating (loading state), Request Created, Share Payment.

Screen content, copy, CTAs, and layout follow the original product brief exactly (colors, headlines, supporting copy, field lists, and the visual reference mockup provided). Every screen has exactly one primary action, per the brief's UX rule.

## 7. Data models (`src/types/`)

`User`, `Profile`, `Wallet`, `Customer`, `PaymentRequest`, `PaymentRequestStatus` (`'pending' | 'paid' | 'expired'`), `Transaction`, `RequestEvent`, `ThemePreference`, `NotificationPreferences`.

`PaymentRequest` shape: `id`, `amount`, `currency: 'USDC'`, `network: 'Solana'`, `description?`, `customerId?`, `expiresAt`, `note?`, `status`, `createdAt`, `paymentLink`, `qrPayload`.

## 8. Mock data

User: Farhan Z. / THINXIFY. Customers: John Doe, Acme Studios, Web3 Labs, Design Collective, Mike Harrison. Sample amounts: $150, $320, $500, $750, $1,250, $2,000, spanning Paid/Pending/Expired statuses, feeding both the Home activity feed and the Requests list.

## 9. Component library

`AppHeader`, `BottomNavigation`, `PrimaryButton`, `SecondaryButton`, `IconButton`, `TextField`, `AmountInput`, `NumericKeypad`, `StatusBadge`, `ActivityRow`, `RequestCard`, `CustomerAvatar`, `SectionHeader`, `BottomSheet`, `ConfirmationModal`, `ThemeAwareCard`, `SkeletonLoader`, `EmptyState`, `SelectableCard`, `QRCodeCard`. Each is independently typed and focused on one responsibility.

## 10. Explicitly out of scope for Phase 1A

Supabase/Firebase, real authentication, Solana RPC/blockchain listeners, real wallet connect, real payment sending/USDC transfers, private keys/seed phrases, custodial wallets, trading/swap/staking/portfolio/NFTs, multi-chain, payment backend/API, push notification backend, real invoices, POS, teams. All such integration points are mocked or stubbed for Phase 1B.

## 11. Completion criteria

Splash, Welcome, Auth UI (mock), Onboarding, Wallet setup, Home, Light theme, Dark theme (Light default), Bottom navigation, Smart Request amount screen, Request details, Customer selection, Expiry selection, Request creation (local state), Request Created screen, QR/share presentation, created requests persisted locally, zero TypeScript errors, zero navigation errors, no obvious layout problems, no real backend/blockchain implemented.

## 12. Verification plan

- `npx tsc --noEmit` — zero TypeScript errors
- `npx expo start` — confirm runtime boot and full navigation flow
- Manual walkthrough of Splash → Share in both Light and Dark mode
- Manual check on a small-screen simulator (e.g. iPhone SE) for layout/safe-area/keyboard issues
- Forms checked for keyboard overlap, validation, correct keyboard types, duplicate-submit prevention

## 13. Deferred to Phase 1B+

Everything in section 10, plus any real backend/database wiring, real push notifications, and features beyond the Request. Share. Get Paid. core journey. Phase 1B does not begin without explicit approval after Phase 1A's final report.
