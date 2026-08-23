import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';

export interface PayWithWalletDeps {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
}

const defaultDeps: PayWithWalletDeps = {
  canOpenURL: Linking.canOpenURL,
  openURL: Linking.openURL,
};

export const NO_WALLET_MESSAGE = 'No compatible Solana wallet found.';

interface UsePayWithWalletResult {
  pay: (uri: string | null) => Promise<void>;
  isProcessing: boolean;
  hasInitiated: boolean;
  error: string | null;
}

// Owns exactly one job: attempt to hand a Solana Pay URI off to whatever
// wallet the device has, exactly once per tap. isProcessingRef (not just
// isProcessing state) guards re-entry synchronously -- two taps that land
// in the same tick before React re-renders still only trigger one openURL
// call. hasInitiated only flips on a confirmed-successful handoff, so a
// failed attempt (no wallet installed, thrown error) leaves the payer free
// to retry -- it is never used to imply payment succeeded (spec section
// 11): the caller is responsible for showing "Waiting for payment
// confirmation…" once hasInitiated is true, never "paid".
export function usePayWithWallet(deps: PayWithWalletDeps = defaultDeps): UsePayWithWalletResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasInitiated, setHasInitiated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  const pay = useCallback(
    async (uri: string | null) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setError(null);
      try {
        if (!uri) {
          setError(NO_WALLET_MESSAGE);
          return;
        }
        const supported = await deps.canOpenURL(uri);
        if (!supported) {
          setError(NO_WALLET_MESSAGE);
          return;
        }
        await deps.openURL(uri);
        setHasInitiated(true);
      } catch {
        setError(NO_WALLET_MESSAGE);
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [deps]
  );

  return { pay, isProcessing, hasInitiated, error };
}
