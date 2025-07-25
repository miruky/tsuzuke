// 一覧の上に出す要約値を導く純粋関数。台帳に手を入れず読み取りだけを行う。

import type { HabitWithMarks } from './habits';
import { streaks } from './habits';

export interface Summary {
  habitCount: number;
  doneToday: number;
  bestCurrentStreak: number;
  totalChecks: number;
  activeDays: number; // 1つ以上やった日数(のべでなく実日数)
}

export function summarize(habits: HabitWithMarks[], today: string): Summary {
  let doneToday = 0;
  let bestCurrentStreak = 0;
  let totalChecks = 0;
  const days = new Set<string>();

  for (const habit of habits) {
    if (habit.marks.has(today)) doneToday++;
    totalChecks += habit.marks.size;
    bestCurrentStreak = Math.max(bestCurrentStreak, streaks(habit.marks, today).current);
    for (const date of habit.marks) days.add(date);
  }

  return {
    habitCount: habits.length,
    doneToday,
    bestCurrentStreak,
    totalChecks,
    activeDays: days.size,
  };
}

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

// 直近window日(todayを含む)で、1つ以上の習慣をやった実日数。
export function activeDaysWithin(habits: HabitWithMarks[], today: string, window: number): number {
  if (window <= 0) return 0;
  const end = toUtc(today);
  const start = end - (window - 1) * DAY_MS;
  const seen = new Set<string>();
  for (const habit of habits) {
    for (const date of habit.marks) {
      const ms = toUtc(date);
      if (ms >= start && ms <= end) seen.add(date);
    }
  }
  return seen.size;
}

// 直近window日の活動日率(0..100の整数パーセント)。
export function completionRate(habits: HabitWithMarks[], today: string, window: number): number {
  if (window <= 0) return 0;
  return Math.round((activeDaysWithin(habits, today, window) / window) * 100);
}

// 継続の節目。到達済みのうち最大のものを返す(未到達はnull)。
export const MILESTONES: number[] = [7, 30, 100, 365];

export function milestone(streak: number): number | null {
  let reached: number | null = null;
  for (const m of MILESTONES) {
    if (streak >= m) reached = m;
  }
  return reached;
}
