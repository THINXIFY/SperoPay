// Jest manual mock for @solana/web3.js.
//
// The real package's dependency chain (jayson, rpc-websockets, uuid, ...)
// ships package.json "exports" conditions Jest's resolver doesn't apply
// the way Metro (the real bundler) does, making the genuine package
// unloadable under plain `jest` even though it works correctly in an
// actual Expo/React Native build. This mock exists purely to unblock
// tests, not because the real package is broken.
//
// PublicKey is a REAL, faithful reimplementation (base58 decode + 32-byte
// length check, matching web3.js's actual validation) so wallet-validation
// tests exercise genuine behavior, not a stub. Connection deliberately
// throws if constructed — this project's tests should always inject a
// fake SolanaRpcProvider (see client.ts's interface) rather than
// instantiate a real network connection.
// bs58 v6's CJS build exports the codec as its `default` export, not as
// top-level named `encode`/`decode` — see node_modules/bs58/src/cjs/index.cjs.
const bs58 = require('bs58').default;

class PublicKey {
  constructor(value) {
    if (value instanceof PublicKey) {
      this._bytes = value._bytes;
      return;
    }
    let bytes;
    if (typeof value === 'string') {
      try {
        bytes = bs58.decode(value);
      } catch {
        throw new Error(`Invalid public key input: not valid base58: "${value}"`);
      }
    } else if (value instanceof Uint8Array) {
      bytes = value;
    } else {
      throw new Error('Invalid public key input');
    }
    if (bytes.length !== 32) {
      throw new Error(`Invalid public key: expected 32 bytes, got ${bytes.length}`);
    }
    this._bytes = bytes;
  }

  toBase58() {
    return bs58.encode(this._bytes);
  }

  toString() {
    return this.toBase58();
  }

  equals(other) {
    return other instanceof PublicKey && this.toBase58() === other.toBase58();
  }
}

class Connection {
  constructor() {
    throw new Error(
      'web3.js Connection is mocked out in tests. Inject a fake SolanaRpcProvider (see client.ts) instead of constructing a real Connection.'
    );
  }
}

function clusterApiUrl(cluster) {
  return `https://api.${cluster}.solana.com`;
}

// Real crypto.randomBytes (Node, available under Jest) -- not a fixed
// value, so uniqueness tests against generateSolanaReference() are
// exercising real randomness, not a stub that always returns the same key.
const nodeCrypto = require('crypto');

class Keypair {
  constructor(bytes, secretKey) {
    this.publicKey = new PublicKey(bytes);
    this.secretKey = secretKey;
  }

  static generate() {
    const bytes = new Uint8Array(nodeCrypto.randomBytes(32));
    const secretKey = new Uint8Array(nodeCrypto.randomBytes(64));
    return new Keypair(bytes, secretKey);
  }
}

module.exports = { PublicKey, Connection, Keypair, clusterApiUrl };
