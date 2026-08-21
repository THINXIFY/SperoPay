import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { registerResettable } from './dataLifecycle';
import { createStaleGuard } from './staleGuard';
import { getDataErrorMessage } from '../utils/getDataErrorMessage';
import type { Wallet } from '../types';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

interface WalletState {
  wallet: Wallet | null;
  status: Status;
  error: string | null;
  loadForUser: (userId: string) => Promise<void>;
  setWalletAddress: (userId: string, address: string) => Promise<void>;
  reset: () => void;
}

const guard = createStaleGuard();

export const useWalletStore = create<WalletState>()((set) => ({
  wallet: null,
  status: 'idle',
  error: null,

  loadForUser: async (userId) => {
    const token = guard.next();
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('network, stablecoin, address')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!guard.isCurrent(token)) return;
      set({
        wallet: data ? { network: data.network, stablecoin: data.stablecoin, address: data.address } : null,
        status: 'loaded',
      });
    } catch (error) {
      if (!guard.isCurrent(token)) return;
      set({ status: 'error', error: getDataErrorMessage(error, 'wallet') });
    }
  },

  setWalletAddress: async (userId, address) => {
    guard.next(); // invalidate any in-flight load — this write must win
    const wallet: Wallet = { stablecoin: 'USDC', network: 'Solana', address };
    try {
      const { error } = await supabase
        .from('wallets')
        .upsert(
          { user_id: userId, address, network: 'Solana', stablecoin: 'USDC', is_default: true },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      set({ wallet });
    } catch (error) {
      set({ error: getDataErrorMessage(error, 'wallet', 'save') });
      throw error;
    }
  },

  reset: () => {
    guard.next();
    set({ wallet: null, status: 'idle', error: null });
  },
}));

registerResettable(() => useWalletStore.getState().reset());
