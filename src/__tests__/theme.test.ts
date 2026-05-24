import {describe, expect, it} from '@jest/globals';
import {
  getTheme,
  nextThemeName,
  resolveThemeName,
  themeOrder,
  themes,
  type ThemeName
} from '../ui/theme.js';

describe('theme skins', () => {
  it('keeps every theme skin complete', () => {
    const requiredKeys = Object.keys(themes.midnight);

    for (const name of themeOrder) {
      expect(Object.keys(themes[name]).sort()).toEqual(requiredKeys.sort());
      expect(getTheme(name)).toBe(themes[name]);
    }
  });

  it('cycles through all skins and resolves unknown values safely', () => {
    const seen = new Set<ThemeName>();
    let current: ThemeName = 'midnight';

    for (let i = 0; i < themeOrder.length; i += 1) {
      seen.add(current);
      current = nextThemeName(current);
    }

    expect(seen).toEqual(new Set(themeOrder));
    expect(current).toBe('midnight');
    expect(resolveThemeName('glacier')).toBe('glacier');
    expect(resolveThemeName('missing')).toBe('midnight');
  });
});
