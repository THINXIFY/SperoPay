// The single source of truth for Supabase's auth redirect/callback URL —
// used for password-recovery, sign-up-confirmation, and resend, so every
// flow always points at the same place (see app/auth/callback.tsx).
//
// Deliberately a literal scheme string, not Linking.createURL(): under Expo
// Go, createURL() resolves to an exp://<host>:<port>/--/auth/callback proxy
// URL, which Supabase's redirect allow-list (configured for the app's real
// "speropay" scheme, per app.json) rejects — and Expo Go can't register a
// custom scheme with the OS anyway, so a deep link can never open the app
// while testing that way regardless of which URL is sent. This constant is
// exactly what "speropay://auth/callback" resolves to in a real development
// or production build, which is the only environment where the native
// scheme is actually registered and the link can work.
export const AUTH_CALLBACK_URL = 'speropay://auth/callback';

export function getAuthCallbackUrl(): string {
  return AUTH_CALLBACK_URL;
}
