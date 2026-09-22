import { Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { buildExplorerTransactionUrl } from '../services/blockchain/solana/explorerUrl';

// The one place "View on Solana Explorer" actually opens the link --
// shared by ExplorerLinkRow (and any other future call site) so the
// fallback behavior (spec: "Never silently fail") is identical everywhere.
// Pulled out of the component itself so this can be unit tested directly
// without rendering a screen (this codebase's established convention).
export async function openTransactionInExplorer(txHash: string): Promise<void> {
  const url = buildExplorerTransactionUrl(txHash);
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) throw new Error('cannot_open_url');
    await Linking.openURL(url);
  } catch {
    Alert.alert('Unable to open Explorer', 'Please try again.', [
      {
        text: 'Copy Transaction ID',
        onPress: () => {
          Clipboard.setStringAsync(txHash).catch(() => {});
        },
      },
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
