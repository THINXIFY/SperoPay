const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('getGooglePlayUrl', () => {
  it('returns undefined when no real listing is configured (never a fake/placeholder URL)', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL;
    const { getGooglePlayUrl } = require('../googlePlayUrl');
    expect(getGooglePlayUrl()).toBeUndefined();
  });

  it('returns the configured URL once a real listing exists', () => {
    process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.speropay.app';
    const { getGooglePlayUrl } = require('../googlePlayUrl');
    expect(getGooglePlayUrl()).toBe('https://play.google.com/store/apps/details?id=com.speropay.app');
  });

  it('treats an empty string the same as unset', () => {
    process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL = '';
    const { getGooglePlayUrl } = require('../googlePlayUrl');
    expect(getGooglePlayUrl()).toBeUndefined();
  });
});
