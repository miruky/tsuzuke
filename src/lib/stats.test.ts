import { describe, expect, it } from 'vitest';
import type { HabitWithMarks } from './habits';
import { summarize } from './stats';

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
