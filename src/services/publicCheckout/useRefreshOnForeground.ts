import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Fires `refresh` once whenever the app transitions from background/
// inactive back to active -- the moment a payer returns from their wallet
// app (spec section 12). Deliberately a one-shot nudge, not a status
// change: it only ever triggers the same fetch usePublicCheckoutPolling
// already does on an interval, never sets status locally.
export function useRefreshOnForeground(refresh: () => void): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        refresh();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [refresh]);
}
