jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `speropay://${path.replace(/^\//, '')}`),
}));

import { getAuthCallbackUrl } from '../authDeepLink';

describe('getAuthCallbackUrl', () => {
  it('builds the auth callback deep link via expo-linking', () => {
    expect(getAuthCallbackUrl()).toBe('speropay://auth/callback');
  });
});
