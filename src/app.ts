// UI層。データはHabitStoreに任せ、ここでは描画とイベント配線だけを行う。

import type { HabitStore, HabitWithMarks } from './lib/habits';
import { HabitError, streaks } from './lib/habits';
import { escapeXml, heatmapSvg } from './lib/heatmap';

const esc = escapeXml;

const LOGO = `
<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="8" y="8" width="13" height="13" rx="3" fill="var(--accent)" opacity="0.35"/>
  <rect x="25" y="8" width="13" height="13" rx="3" fill="var(--accent)" opacity="0.6"/>
  <rect x="42" y="8" width="13" height="13" rx="3" fill="var(--accent)"/>
  <rect x="8" y="25" width="13" height="13" rx="3" fill="var(--accent)" opacity="0.6"/>
  <rect x="25" y="25" width="13" height="13" rx="3" fill="var(--accent)"/>
  <rect x="42" y="25" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4"/>
  <rect x="8" y="42" width="13" height="13" rx="3" fill="var(--accent)"/>
  <rect x="25" y="42" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.4"/>
  <rect x="42" y="42" width="13" height="13" rx="3" fill="var(--accent)" opacity="0.6"/>
</svg>`;

function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function mountApp(root: HTMLElement, store: HabitStore): void {
  root.innerHTML = `
    <div class="shell">
      <header class="masthead">
        <div class="brand">
          ${LOGO}
          <div>
            <h1>tsuzuke</h1>
            <p class="tagline">続いた日が、そのまま模様になる習慣トラッカー</p>
          </div>
        </div>
        <div class="masthead-actions">
          <button type="button" id="export" class="ghost">エクスポート</button>
          <button type="button" id="import" class="ghost">インポート</button>
          <input type="file" id="import-file" accept=".json,application/json" hidden>
        </div>
      </header>

      <section class="panel overview-panel" aria-labelledby="overview-heading">
        <h2 id="overview-heading">ぜんぶの習慣</h2>
        <div id="overview"></div>
      </section>

      <section class="panel" aria-label="習慣を増やす">
        <form id="add-form" autocomplete="off">
          <input name="name" maxlength="30" required placeholder="続けたいこと(例: 朝の散歩)" aria-label="習慣の名前">
          <button type="submit" class="primary">増やす</button>
        </form>
      </section>

      <div id="habits"></div>
      <div id="toast" role="status" aria-live="polite"></div>
    </div>`;

  const $ = <T extends HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (node === null) throw new Error(`要素が見つからない: ${selector}`);
    return node;
  };

  const toastBox = $('#toast');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function toast(message: string): void {
    toastBox.textContent = message;
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), 3500);
  }

  function renderOverview(habits: HabitWithMarks[]): void {
    if (habits.length === 0) {
      $('#overview').innerHTML =
        '<p class="empty">まだ習慣がありません。下のフォームから1つ目を増やしてください。</p>';
      return;
    }
    const today = todayLocal();
    const levelOf = (date: string): number => {
      const done = habits.filter((h) => h.marks.has(date)).length;
      if (done === 0) return 0;
      return Math.max(1, Math.ceil((done / habits.length) * 4));
    };
    $('#overview').innerHTML = heatmapSvg(today, levelOf, {
      label: '全習慣の達成度',
    });
  }

  function habitCard(habit: HabitWithMarks, index: number): string {
    const today = todayLocal();
    const { current, longest } = streaks(habit.marks, today);
    const done = habit.marks.has(today);
    return `
      <section class="panel habit" style="--i:${Math.min(index, 8)}" aria-label="${esc(habit.name)}">
        <div class="habit-head">
          <button type="button" class="check habit-${habit.colorIndex}${done ? ' done' : ''}"
            data-toggle="${esc(habit.id)}" aria-pressed="${done}"
            aria-label="${esc(habit.name)}を今日やった">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="habit-meta">
            <h2>${esc(habit.name)}</h2>
            <p>連続${current}日 / 最長${longest}日 / 合計${habit.marks.size}日</p>
          </div>
          <button type="button" class="habit-remove" data-remove="${esc(habit.id)}">削除</button>
        </div>
        <div class="habit-map" data-habit="${esc(habit.id)}">
          ${heatmapSvg(todayLocal(), (d) => (habit.marks.has(d) ? 4 : 0), {
            label: habit.name,
            colorClass: `habit-${habit.colorIndex}`,
          })}
        </div>
      </section>`;
  }

  function render(): void {
    const habits = store.all();
    renderOverview(habits);
    $('#habits').innerHTML = habits.map(habitCard).join('');
  }

  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#add-form input[name="name"]');
    try {
      const habit = store.add(input.value);
      toast(`「${habit.name}」を増やしました。今日からどうぞ`);
      input.value = '';
      render();
    } catch (err) {
      toast(err instanceof HabitError ? err.message : '追加に失敗しました');
    }
  });

  $('#habits').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const toggle = target.closest<HTMLElement>('[data-toggle]');
    if (toggle !== null) {
      const id = toggle.dataset.toggle ?? '';
      const marked = store.toggle(id, todayLocal());
      toast(marked ? '今日もできました' : '今日の印を外しました');
      render();
      return;
    }

    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove !== null) {
      if (remove.dataset.armed === undefined) {
        remove.dataset.armed = '1';
        remove.textContent = '本当に削除';
        return;
      }
      store.remove(remove.dataset.remove ?? '');
      toast('習慣を削除しました');
      render();
      return;
    }

    // ヒートマップのセルを押すと、その日の印を付け外しできる(付け忘れ救済)。
    const cell = target.closest<SVGElement>('rect.hm-cell');
    const map = target.closest<HTMLElement>('[data-habit]');
    if (cell !== null && map !== null) {
      const date = cell.getAttribute('data-date');
      const id = map.dataset.habit ?? '';
      if (date !== null) {
        store.toggle(id, date);
        render();
      }
    }
  });

  $('#export').addEventListener('click', () => {
    const stamp = todayLocal().replace(/-/g, '');
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tsuzuke-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('記録をエクスポートしました');
  });

  $('#import').addEventListener('click', () => {
    $<HTMLInputElement>('#import-file').click();
  });

  $<HTMLInputElement>('#import-file').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;
    void file.text().then((text) => {
      try {
        const result = store.importJson(text);
        toast(`${result.added}件を取り込みました(${result.skipped}件は読み飛ばし)`);
        render();
      } catch (err) {
        toast(err instanceof HabitError ? err.message : '読み込みに失敗しました');
      }
    });
  });

  render();
}
