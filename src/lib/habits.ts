// 習慣の台帳。習慣ごとに「やった日」の集合を持ち、連続日数や合計を導く。
// 日付はYYYY-MM-DD文字列、日数計算はUTCで行いタイムゾーンずれを避ける。

export interface Habit {
  id: string;
  name: string;
  colorIndex: number; // 表示色(CSS変数の番号)
  createdAt: string;
}

export interface HabitWithMarks extends Habit {
  marks: Set<string>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ImportResult {
  added: number;
  skipped: number;
}

export class HabitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HabitError';
  }
}

const STORAGE_KEY = 'tsuzuke:v1';
const MAX_HABITS = 20;
const MAX_NAME = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function makeId(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'h-' + Math.random().toString(36).slice(2, 12);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 0));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === (m ?? 1) - 1 && dt.getUTCDate() === d;
}

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function streaks(marks: Set<string>, today: string): { current: number; longest: number } {
  const days = [...marks].sort();
  if (days.length === 0) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (toUtc(days[i] ?? '') - toUtc(days[i - 1] ?? '') === DAY_MS) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // 今日が未記録でも、昨日まで続いていれば継続中とみなす。
  let cursor = marks.has(today) ? today : fromUtc(toUtc(today) - DAY_MS);
  let current = 0;
  while (marks.has(cursor)) {
    current++;
    cursor = fromUtc(toUtc(cursor) - DAY_MS);
  }
  return { current, longest };
}

interface Persisted {
  habits: Habit[];
  marks: Record<string, string[]>;
}

function coerceHabit(value: unknown): Habit | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string' || v.name.trim() === '') return null;
  return {
    id: typeof v.id === 'string' && v.id !== '' ? v.id : makeId(),
    name: v.name.trim().slice(0, MAX_NAME),
    colorIndex:
      typeof v.colorIndex === 'number' && Number.isInteger(v.colorIndex)
        ? ((v.colorIndex % 8) + 8) % 8
        : 0,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date(0).toISOString(),
  };
}

export class HabitStore {
  private habits: Habit[] = [];
  private marks = new Map<string, Set<string>>();

  constructor(
    private storage: StorageLike,
    private now: () => Date = () => new Date(),
  ) {
    this.load();
  }

  private load(): void {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return;
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return;
      const p = data as Record<string, unknown>;
      if (Array.isArray(p.habits)) {
        this.habits = p.habits.map(coerceHabit).filter((h): h is Habit => h !== null);
      }
      if (typeof p.marks === 'object' && p.marks !== null) {
        for (const [id, days] of Object.entries(p.marks)) {
          if (!Array.isArray(days)) continue;
          if (!this.habits.some((h) => h.id === id)) continue;
          this.marks.set(
            id,
            new Set(days.filter((d): d is string => typeof d === 'string' && isValidDate(d))),
          );
        }
      }
    } catch {
      // 壊れた保存データは無視する。
    }
  }

  private save(): void {
    const marks: Record<string, string[]> = {};
    for (const [id, days] of this.marks) {
      marks[id] = [...days].sort();
    }
    const data: Persisted = { habits: this.habits, marks };
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ app: 'tsuzuke', version: 1, ...data }));
  }

  all(): HabitWithMarks[] {
    return this.habits.map((h) => ({
      ...h,
      marks: new Set(this.marks.get(h.id) ?? []),
    }));
  }

  count(): number {
    return this.habits.length;
  }

  add(name: string): Habit {
    const trimmed = name.trim();
    if (trimmed === '') throw new HabitError('習慣の名前を入力してください');
    if (trimmed.length > MAX_NAME) {
      throw new HabitError(`名前は${MAX_NAME}文字以内にしてください`);
    }
    if (this.habits.some((h) => h.name === trimmed)) {
      throw new HabitError('同じ名前の習慣がすでにあります');
    }
    if (this.habits.length >= MAX_HABITS) {
      throw new HabitError(`習慣は${MAX_HABITS}個までです`);
    }
    const habit: Habit = {
      id: makeId(),
      name: trimmed,
      colorIndex: this.habits.length % 8,
      createdAt: this.now().toISOString(),
    };
    this.habits.push(habit);
    this.marks.set(habit.id, new Set());
    this.save();
    return habit;
  }

  rename(id: string, name: string): void {
    const habit = this.habits.find((h) => h.id === id);
    if (habit === undefined) throw new HabitError('対象の習慣が見つかりません');
    const trimmed = name.trim();
    if (trimmed === '') throw new HabitError('習慣の名前を入力してください');
    habit.name = trimmed.slice(0, MAX_NAME);
    this.save();
  }

  remove(id: string): void {
    const before = this.habits.length;
    this.habits = this.habits.filter((h) => h.id !== id);
    if (this.habits.length === before) {
      throw new HabitError('対象の習慣が見つかりません');
    }
    this.marks.delete(id);
    this.save();
  }

  // やった/やってないを反転し、反転後の状態を返す。
  toggle(id: string, date: string): boolean {
    if (!isValidDate(date)) throw new HabitError('日付が不正です');
    if (!this.habits.some((h) => h.id === id)) {
      throw new HabitError('対象の習慣が見つかりません');
    }
    const days = this.marks.get(id) ?? new Set<string>();
    let marked: boolean;
    if (days.has(date)) {
      days.delete(date);
      marked = false;
    } else {
      days.add(date);
      marked = true;
    }
    this.marks.set(id, days);
    this.save();
    return marked;
  }

  isMarked(id: string, date: string): boolean {
    return this.marks.get(id)?.has(date) ?? false;
  }

  exportJson(now: Date = new Date()): string {
    const marks: Record<string, string[]> = {};
    for (const [id, days] of this.marks) marks[id] = [...days].sort();
    return JSON.stringify(
      {
        app: 'tsuzuke',
        version: 1,
        exportedAt: now.toISOString(),
        habits: this.habits,
        marks,
      },
      null,
      2,
    );
  }

  importJson(text: string): ImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HabitError('JSONとして読み取れないファイルです');
    }
    const p = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
    if (p === null || !Array.isArray(p.habits)) {
      throw new HabitError('tsuzukeのエクスポート形式ではありません');
    }
    const rawMarks =
      typeof p.marks === 'object' && p.marks !== null ? (p.marks as Record<string, unknown>) : {};
    let added = 0;
    let skipped = 0;
    for (const raw of p.habits) {
      const habit = coerceHabit(raw);
      if (
        habit === null ||
        this.habits.some((h) => h.id === habit.id || h.name === habit.name) ||
        this.habits.length >= MAX_HABITS
      ) {
        skipped++;
        continue;
      }
      this.habits.push(habit);
      const days = rawMarks[habit.id];
      this.marks.set(
        habit.id,
        new Set(
          Array.isArray(days)
            ? days.filter((d): d is string => typeof d === 'string' && isValidDate(d))
            : [],
        ),
      );
      added++;
    }
    this.save();
    return { added, skipped };
  }
}
