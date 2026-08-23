// React Native/Hermes has neither a global `Buffer` nor `crypto.getRandomValues`
// by default — both are required by @solana/web3.js's dependency chain
// (tweetnacl/noble crypto). This must be imported before any module that
// imports @solana/web3.js, directly or transitively — see app/_layout.tsx,
// where it's the very first import for that reason.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
