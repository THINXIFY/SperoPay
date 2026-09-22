// One clean configuration point for Spero's real Google Play Store listing
// URL, once one exists. Deliberately no placeholder/fake listing -- returns
// undefined until EXPO_PUBLIC_GOOGLE_PLAY_URL is actually set, which is
// exactly what WebLandingScreen (the only consumer) uses to decide between
// a real "Get Spero on Google Play" link and a non-linking "Coming soon to
// Google Play" label. Replacing the placeholder later is a one-line env
// var change, nothing in the component itself.
export function getGooglePlayUrl(): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL || undefined;
}
