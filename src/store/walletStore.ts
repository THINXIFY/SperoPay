import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Wallet } from '../types';

interface WalletState {
  wallet: Wallet | null;
  setWalletAddress: (address: string) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      wallet: null,
      setWalletAddress: (address) =>
        set({ wallet: { stablecoin: 'USDC', network: 'Solana', address } }),
    }),
    { name: 'speropay/wallet', storage: createJSONStorage(() => AsyncStorage) }
  )
);
