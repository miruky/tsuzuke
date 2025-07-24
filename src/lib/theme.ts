// テーマ(自動・明るい・暗い)の解決と適用。
// 解決ロジックは純粋関数に置き、DOM/localStorageへの反映は薄く包む。
// data-theme属性で駆動し、メディアクエリ任せの「自動」は属性を外して表す。

export type ThemePref = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tsuzuke:theme';
const ORDER: ThemePref[] = ['auto', 'light', 'dark'];

export function isThemePref(value: unknown): value is ThemePref {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function nextPref(current: ThemePref): ThemePref {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length] ?? 'auto';
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === 'auto') return systemDark ? 'dark' : 'light';
  return pref;
}

export function labelFor(pref: ThemePref): string {
  if (pref === 'light') return '明るい';
  if (pref === 'dark') return '暗い';
  return '自動';
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readPref(): ThemePref {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemePref(raw) ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

export function writePref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ストレージが使えない環境では保存を諦める。
  }
}

// data-theme: 'auto'は属性を外しメディアクエリへ委ねる。明示時は固定する。
export function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (pref === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', pref);
  }
}
