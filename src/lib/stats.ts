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
