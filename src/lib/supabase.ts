import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values, then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    // Appends a reserved `sb_flow_id` param to recovery/confirmation redirect
    // URLs so a later exchangeCodeForSession(code, { flowId }) matches the
    // exact PKCE verifier for that flow, rather than falling back to a single
    // legacy verifier slot that only remembers the most recently started
    // flow — without this, requesting a second reset/confirmation email
    // before opening the first invalidates both.
    experimental: { appendPkceFlowIdToRedirects: true },
  },
});

// Supabase's token auto-refresh timer only runs while this is explicitly told the
// app is active — without this, sessions can silently fail to refresh in the
// background and appear expired the next time the app is foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
