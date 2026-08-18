import { resolveThemeMode } from '../resolveThemeMode';

describe('resolveThemeMode', () => {
  it('defaults to light when no preference is stored', () => {
    expect(resolveThemeMode(null, 'dark')).toBe('light');
  });

  it('follows the device scheme when preference is "system"', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  it('follows the device scheme and defaults to light when scheme is null', () => {
    expect(resolveThemeMode('system', null)).toBe('light');
  });

  it('uses the explicit stored preference when set to light or dark', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });
});
