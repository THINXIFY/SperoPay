// Stub for Expo's "expo/virtual/env" synthetic module. Metro intercepts this
// specifier specially at bundle time; outside Metro (e.g. under Jest) Expo
// ships a real fallback file at node_modules/expo/virtual/env.js containing
// nothing but `export const env = process.env;` — but that file isn't
// covered by jest-expo's default transform, so any source file whose own
// process.env.EXPO_PUBLIC_* access babel-preset-expo rewrites into a
// `require('expo/virtual/env')` call fails to load under test. This stub is
// behaviourally identical (same one line, plain CommonJS) and is mapped in
// via jest.config.js's moduleNameMapper.
module.exports = { env: process.env };
