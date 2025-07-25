import { describe, expect, it } from 'vitest';
import type { HabitWithMarks } from './habits';
import { activeDaysWithin, completionRate, summarize } from './stats';

function habit(name: string, marks: string[], colorIndex = 0): HabitWithMarks {
  return { id: name, name, colorIndex, createdAt: '', marks: new Set(marks) };
}

describe('summarize', () => {
  it('空なら全て0', () => {
    expect(summarize([], '2026-06-13')).toEqual({
      habitCount: 0,
      doneToday: 0,
      bestCurrentStreak: 0,
      totalChecks: 0,
      activeDays: 0,
    });
  });

  it('きょうの達成数を数える', () => {
    const habits = [
      habit('a', ['2026-06-13']),
      habit('b', ['2026-06-12']),
      habit('c', ['2026-06-13']),
    ];
    expect(summarize(habits, '2026-06-13').doneToday).toBe(2);
  });

  it('いちばん長い継続中ストリークを返す', () => {
    const habits = [
      habit('a', ['2026-06-12', '2026-06-13']),
      habit('b', ['2026-06-11', '2026-06-12', '2026-06-13']),
    ];
    expect(summarize(habits, '2026-06-13').bestCurrentStreak).toBe(3);
  });

  it('のべ記録日数と実活動日数を区別する', () => {
    const habits = [habit('a', ['2026-06-12', '2026-06-13']), habit('b', ['2026-06-13'])];
    const s = summarize(habits, '2026-06-13');
    expect(s.totalChecks).toBe(3);
    expect(s.activeDays).toBe(2);
  });
});

describe('activeDaysWithin', () => {
  it('窓の中の実活動日だけを数える(複数習慣の同日は1日)', () => {
    const habits = [
      habit('a', ['2026-06-13', '2026-06-12', '2026-05-01']),
      habit('b', ['2026-06-12']),
    ];
    // 直近7日(06-07〜06-13)に活動したのは06-12と06-13の2日。05-01は窓の外。
    expect(activeDaysWithin(habits, '2026-06-13', 7)).toBe(2);
  });

  it('窓が0以下なら0', () => {
    expect(activeDaysWithin([habit('a', ['2026-06-13'])], '2026-06-13', 0)).toBe(0);
  });
});

describe('completionRate', () => {
  it('活動日数を窓日数で割った整数パーセント', () => {
    const habits = [habit('a', ['2026-06-13', '2026-06-12'])];
    // 直近4日(06-10〜06-13)のうち2日活動 → 50%
    expect(completionRate(habits, '2026-06-13', 4)).toBe(50);
  });

  it('全日活動なら100%', () => {
    const habits = [habit('a', ['2026-06-13', '2026-06-12', '2026-06-11'])];
    expect(completionRate(habits, '2026-06-13', 3)).toBe(100);
  });
});
