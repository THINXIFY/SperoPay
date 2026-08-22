# SperoPay

**SperoPay** (styled **Spero** in-app) is a mobile stablecoin payment request app built with Expo/React Native. Freelancers, creators, and small businesses can create payment requests, share them with customers, and track their status through to payment — with a per-user Supabase backend, real authentication, and a black/white/electric-lime design system built for both light and dark mode.

> This is an active development project. The payment/settlement flow is currently a realistic mock simulation — see [Current Status & Limitations](#current-status--limitations) before treating this as production-ready for real funds.

---

## Features

- **Authentication** — email/password sign up and sign in via Supabase Auth, email confirmation with resend, forgot/reset password via deep link, session expiry handling, and per-user onboarding.
- **Smart Request** — a guided flow to create a payment request: amount → stablecoin/network → customer → expiry → note, with a live QR code and shareable payment link.
- **Request lifecycle** — pending → confirming → paid/expired/cancelled, with a timestamped event timeline, reminders, cancellation, and auto-generated invoice/receipt views.
- **Customers** — a lightweight CRM: add/edit customers, see per-customer payment history and stats (total received, outstanding, payment count).
- **Payment Templates** — save recurring request configurations for reuse.
- **Profile & Settings** — business profile, receiving wallet address, payment defaults, appearance (light/dark/system), security, and more.
- **Per-user cloud data** — every user's business data (requests, customers, templates, transactions) lives in Supabase Postgres behind Row Level Security, not shared local storage.
- **Polished mobile UX** — custom bottom sheets, a native-feel numeric keypad, skeleton loading states, and deliberate light/dark theming throughout.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 57) + [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing) |
| Language | TypeScript, React Native 0.86, React 19 |
| State | [Zustand](https://github.com/pmndrs/zustand) — per-domain stores, Supabase-backed with local caching |
| Backend | [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security, RPC functions |
| UI | Custom design system (`src/theme`), [@gorhom/bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet), Plus Jakarta Sans |
| Testing | Jest + `jest-expo`, `@testing-library/react-native` |

## Project Structure

```
app/                  Expo Router screens (file-based routing)
  (auth)/              Sign in, sign up, password recovery
  (onboarding)/         Usage type, profile setup, wallet setup
  (app)/                Main tabs: home, requests, customers, profile
  request/              Smart Request creation flow
  pay/                  Public-facing payment/QR pages
  auth/callback.tsx     Deep-link handler for auth/password-recovery links

src/
  components/          Shared UI components (buttons, cards, bottom sheets, ...)
  store/               Zustand stores (one per domain), Supabase-backed
  theme/               Colors, spacing, typography, light/dark resolution
  types/               Shared TypeScript types
  utils/               Formatting, validation, and other pure helpers
  lib/                 Supabase client setup

supabase/migrations/   SQL migrations (schema, RLS policies, RPC functions)
docs/                  Design specs and implementation plans for each phase
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is fine)
- The [Expo Go](https://expo.dev/go) app on a physical device, or an Android/iOS simulator

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in your Supabase project's URL and anon key:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set up the database

In your Supabase project's SQL Editor, run the three migrations in `supabase/migrations/` **in order**:

1. `0001_phase2b_schema.sql` — tables
2. `0002_phase2b_rls.sql` — Row Level Security policies
3. `0003_phase2b_functions.sql` — RPC functions for atomic multi-step operations

### 4. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). If your device can't reach the dev server over your local network (common on networks Windows treats as "Public," or restrictive Wi-Fi), use tunnel mode instead:

```bash
npx expo start --tunnel
```

### Other scripts

```bash
npm run android     # Build and run the native Android app (requires Android SDK)
npm run ios         # Build and run the native iOS app (requires Xcode, macOS)
npm run web         # Run in a browser
npm run typecheck   # tsc --noEmit
npm test            # Run the Jest test suite
```

## Design System

SperoPay's brand is deliberately restrained: black, white/warm off-white, and electric lime as the primary accent, with neutral grays and muted semantic colors for status (success/pending/error). Every screen supports both light and dark themes with no hardcoded colors — see `src/theme/colors.ts` for the full token set.

## Current Status & Limitations

This project has been built in incremental phases (see `docs/superpowers/`), each with its own design spec, implementation plan, and code review. As of the current state:

- ✅ Full auth flow (sign up, sign in, password recovery, email confirmation) against real Supabase Auth
- ✅ Per-user Postgres data with RLS — no cross-user data leakage
- ✅ Complete request/customer/template/transaction management, backed by the cloud
- ⏳ **Payment settlement is simulated**, not real — there is no live blockchain/Solana RPC integration yet
- ⏳ Public (no-account) payment-link access is not yet implemented — the payment page currently only works for the requester's own session
- ⏳ Avatar/logo upload is a placeholder — not yet backed by Supabase Storage
- ⏳ No native Android/iOS build has been fully verified end-to-end (requires an Android SDK / Xcode setup this dev environment doesn't currently have)

## Contributing

This is currently a solo project under active development. If you're picking up this codebase, check `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design rationale and history behind each major feature.
