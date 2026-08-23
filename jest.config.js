const jestExpoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...jestExpoPreset,
  moduleNameMapper: {
    ...jestExpoPreset.moduleNameMapper,
    // See __mocks__/expoVirtualEnv.js for why this is needed: any source
    // file babel-preset-expo rewrites a process.env.EXPO_PUBLIC_* access in
    // ends up require()-ing this Metro-only virtual specifier, and the real
    // fallback file jest-expo would otherwise resolve to isn't covered by
    // its default transform config.
    '^expo/virtual/env$': '<rootDir>/__mocks__/expoVirtualEnv.js',
  },
};
