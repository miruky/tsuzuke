import { describe, expect, it } from 'vitest';
import { countValue, easeOutCubic } from './motion';

describe('easeOutCubic', () => {
  it('両端を固定し範囲外を丸める', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });

  it('序盤が速く終盤が緩む(ease-out)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('countValue', () => {
  it('開始は0、終了はtoになる', () => {
    expect(countValue(0, 288, 0)).toBe(0);
    expect(countValue(0, 288, 1)).toBe(288);
  });

  it('途中は整数に丸めて単調増加する', () => {
    const a = countValue(0, 100, 0.25);
    const b = countValue(0, 100, 0.75);
    expect(Number.isInteger(a)).toBe(true);
    expect(b).toBeGreaterThan(a);
  });
});
