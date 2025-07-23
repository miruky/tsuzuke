import { describe, expect, it } from 'vitest';
import type { StorageLike } from './habits';
import { HabitError, HabitStore, isValidDate, streaks } from './habits';

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('習慣の管理', () => {
  it('追加と一覧', () => {
    const store = new HabitStore(memoryStorage());
    store.add('朝の散歩');
    expect(store.all().map((h) => h.name)).toEqual(['朝の散歩']);
  });

  it('空名・重複・上限を拒否する', () => {
    const store = new HabitStore(memoryStorage());
    expect(() => store.add('  ')).toThrow(HabitError);
    store.add('読書');
    expect(() => store.add('読書')).toThrow('同じ名前');
    for (let i = 0; i < 19; i++) store.add(`習慣${i}`);
    expect(() => store.add('21個目')).toThrow('20個まで');
  });

  it('改名と削除', () => {
    const store = new HabitStore(memoryStorage());
    const habit = store.add('運動');
    store.rename(habit.id, '筋トレ');
    expect(store.all()[0]?.name).toBe('筋トレ');
    store.remove(habit.id);
    expect(store.count()).toBe(0);
    expect(() => store.remove(habit.id)).toThrow(HabitError);
  });

  it('色は8色を循環して割り当てる', () => {
    const store = new HabitStore(memoryStorage());
    for (let i = 0; i < 9; i++) store.add(`習慣${i}`);
    const colors = store.all().map((h) => h.colorIndex);
    expect(colors[8]).toBe(0);
  });
});

describe('印の付け外し', () => {
  it('toggleで反転し状態を返す', () => {
    const store = new HabitStore(memoryStorage());
    const habit = store.add('読書');
    expect(store.toggle(habit.id, '2026-06-13')).toBe(true);
    expect(store.isMarked(habit.id, '2026-06-13')).toBe(true);
    expect(store.toggle(habit.id, '2026-06-13')).toBe(false);
    expect(store.isMarked(habit.id, '2026-06-13')).toBe(false);
  });

  it('不正な日付と未知の習慣を拒否する', () => {
    const store = new HabitStore(memoryStorage());
    const habit = store.add('読書');
    expect(() => store.toggle(habit.id, '2026-13-01')).toThrow(HabitError);
    expect(() => store.toggle('nai', '2026-06-13')).toThrow(HabitError);
  });
});

describe('streaks', () => {
  it('今日を含む連続を数える', () => {
    const marks = new Set(['2026-06-11', '2026-06-12', '2026-06-13']);
    expect(streaks(marks, '2026-06-13')).toEqual({ current: 3, longest: 3 });
  });

  it('今日が未記録でも昨日までの連続を保つ', () => {
    const marks = new Set(['2026-06-11', '2026-06-12']);
    expect(streaks(marks, '2026-06-13').current).toBe(2);
  });

  it('途切れたら0、最長は過去から', () => {
    const marks = new Set(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10']);
    expect(streaks(marks, '2026-06-13')).toEqual({ current: 0, longest: 3 });
  });

  it('月境界をまたぐ', () => {
    const marks = new Set(['2026-05-31', '2026-06-01']);
    expect(streaks(marks, '2026-06-01')).toEqual({ current: 2, longest: 2 });
  });

  it('空なら0', () => {
    expect(streaks(new Set(), '2026-06-13')).toEqual({ current: 0, longest: 0 });
  });
});

describe('isValidDate', () => {
  it('実在する日付だけ通す', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('20260613')).toBe(false);
  });
});

describe('永続化と入出力', () => {
  it('作り直しても習慣と印が戻る', () => {
    const storage = memoryStorage();
    const first = new HabitStore(storage);
    const habit = first.add('読書');
    first.toggle(habit.id, '2026-06-13');
    const second = new HabitStore(storage);
    expect(second.isMarked(habit.id, '2026-06-13')).toBe(true);
  });

  it('壊れた保存データは無視する', () => {
    const storage = memoryStorage();
    storage.setItem('tsuzuke:v1', '{bad');
    expect(new HabitStore(storage).count()).toBe(0);
  });

  it('エクスポートを取り込め、重複は読み飛ばす', () => {
    const store = new HabitStore(memoryStorage());
    const habit = store.add('読書');
    store.toggle(habit.id, '2026-06-13');
    const other = new HabitStore(memoryStorage());
    expect(other.importJson(store.exportJson())).toEqual({ added: 1, skipped: 0 });
    expect(other.isMarked(habit.id, '2026-06-13')).toBe(true);
    expect(other.importJson(store.exportJson())).toEqual({ added: 0, skipped: 1 });
  });

  it('形式違いはHabitError', () => {
    const store = new HabitStore(memoryStorage());
    expect(() => store.importJson('x')).toThrow(HabitError);
    expect(() => store.importJson('{"a":1}')).toThrow('エクスポート形式');
  });
});
