import { describe, expect, it } from 'vitest';
import { isThemePref, labelFor, nextPref, resolveTheme } from './theme';

describe('nextPref', () => {
  it('自動→明るい→暗い→自動と巡回する', () => {
    expect(nextPref('auto')).toBe('light');
    expect(nextPref('light')).toBe('dark');
    expect(nextPref('dark')).toBe('auto');
  });
});

describe('resolveTheme', () => {
  it('自動はシステム設定に従う', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('明示指定はシステムを無視する', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemePref', () => {
  it('既知の値だけ通す', () => {
    expect(isThemePref('auto')).toBe(true);
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('sepia')).toBe(false);
    expect(isThemePref(null)).toBe(false);
  });
});

describe('labelFor', () => {
  it('日本語ラベルを返す', () => {
    expect(labelFor('auto')).toBe('自動');
    expect(labelFor('light')).toBe('明るい');
    expect(labelFor('dark')).toBe('暗い');
  });
});
