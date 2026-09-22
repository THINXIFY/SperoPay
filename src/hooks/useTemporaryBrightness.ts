import { useCallback, useRef } from 'react';
import * as Brightness from 'expo-brightness';

// Full-Screen QR's optional brightness boost (spec section "Screen
// Brightness"). Deliberately uses ONLY Brightness.getBrightnessAsync/
// setBrightnessAsync -- the per-activity variants, which on Android apply
// only while this app is foregrounded and need no permission, and on iOS
// persist only until the device locks. The SYSTEM-wide variants
// (setSystemBrightnessAsync) require a separate, user-granted
// SYSTEM_BRIGHTNESS permission -- deliberately never used here (spec: "do
// not request unnecessary permissions"). Every call is wrapped so a
// failure (brightness API unavailable, permission quirk, whatever) never
// blocks or breaks the QR screen itself -- boost()/restore() simply
// become no-ops.
export function useTemporaryBrightness() {
  const previousBrightnessRef = useRef<number | null>(null);

  const boost = useCallback(async (target: number = 1) => {
    try {
      const isAvailable = await Brightness.isAvailableAsync();
      if (!isAvailable) return;
      const current = await Brightness.getBrightnessAsync();
      previousBrightnessRef.current = current;
      await Brightness.setBrightnessAsync(target);
    } catch {
      // Brightness control is a nice-to-have -- QR usability must never
      // depend on it.
    }
  }, []);

  const restore = useCallback(async () => {
    const previous = previousBrightnessRef.current;
    if (previous == null) return;
    previousBrightnessRef.current = null;
    try {
      await Brightness.setBrightnessAsync(previous);
    } catch {
      // Same as above -- nothing user-facing to do if this fails.
    }
  }, []);

  return { boost, restore };
}
