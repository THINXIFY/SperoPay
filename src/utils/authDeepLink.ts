import * as Linking from 'expo-linking';

// The one redirect URL used for both password-recovery and sign-up-confirmation
// links. Supabase's client (not this URL) is what tells us which flow a given
// code exchange belongs to — see app/auth/callback.tsx.
export function getAuthCallbackUrl(): string {
  return Linking.createURL('/auth/callback');
}
