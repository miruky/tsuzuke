// UI層。データはHabitStoreに任せ、ここでは描画とイベント配線だけを行う。

import type { HabitStore, HabitWithMarks } from './lib/habits';
import { HabitError, streaks } from './lib/habits';
import { escapeXml, heatmapSvg } from './lib/heatmap';
import { summarize } from './lib/stats';

const esc = escapeXml;

const HERO_IMAGE = 'https://picsum.photos/seed/tsuzuke-grain/1600/1000?grayscale';

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function mountApp(root: HTMLElement, store: HabitStore): void {
  root.innerHTML = `
    <header class="hero" data-reveal>
      <div class="hero-media" aria-hidden="true">
        <img src="${HERO_IMAGE}" alt="" width="1600" height="1000" loading="eager" decoding="async">
      </div>
      <div class="hero-inner">
        <span class="kicker">習慣トラッカー</span>
        <h1 class="display">tsu<span class="mark">zu</span>ke</h1>
        <p class="lede">「今日やった」を一度押すだけ。続いた日が、直近一年の模様になって積み上がる。</p>
      </div>
    </header>

    <main>
      <section class="band" aria-labelledby="overview-heading" data-reveal>
        <div class="band-head">
          <div>
            <span class="kicker">ことしの継続</span>
            <h2 class="band-title" id="overview-heading">続いた日の地図</h2>
          </div>
          <div class="toolbar">
            <button type="button" id="export" class="btn-ghost">エクスポート</button>
            <button type="button" id="import" class="btn-ghost">インポート</button>
            <input type="file" id="import-file" accept=".json,application/json" hidden>
          </div>
        </div>
        <figure class="overview-figure">
          <div id="overview"></div>
          <figcaption class="legend">
            <span>すくない</span>
            <span class="legend-cells" aria-hidden="true">
              <span></span><span class="l1"></span><span class="l2"></span><span class="l3"></span><span class="l4"></span>
            </span>
            <span>おおい</span>
          </figcaption>
        </figure>
        <dl class="summary" id="summary"></dl>
      </section>

      <section class="band" aria-label="習慣を増やす" data-reveal>
        <div class="band-head">
          <div>
            <span class="kicker">はじめる</span>
            <h2 class="band-title">続けたいこと</h2>
          </div>
        </div>
        <form id="add-form" class="compose-form" autocomplete="off">
          <input name="name" maxlength="30" required placeholder="例: 朝の散歩、読書、ストレッチ" aria-label="習慣の名前">
          <button type="submit" class="btn btn-primary">増やす</button>
        </form>
      </section>

      <section class="band" aria-label="習慣の一覧" data-reveal>
        <div id="habits"></div>
      </section>
    </main>

    <footer class="page-footer">
      <p>記録はこの端末の中だけに保存されます。引っ越しは右上のエクスポート／インポートで。<a href="https://github.com/miruky/tsuzuke" rel="noreferrer">ソースコード</a></p>
    </footer>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>`;

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
    const today = todayLocal();
    const levelOf = (date: string): number => {
      if (habits.length === 0) return 0;
      const done = habits.filter((h) => h.marks.has(date)).length;
      if (done === 0) return 0;
      return Math.max(1, Math.ceil((done / habits.length) * 4));
    };
    $('#overview').innerHTML = heatmapSvg(today, levelOf, { label: '全習慣の達成度' });
  }

  function renderSummary(habits: HabitWithMarks[]): void {
    const today = todayLocal();
    const s = summarize(habits, today);
    const items: { value: string; unit: string; label: string }[] = [
      { value: String(s.habitCount), unit: '個', label: '続けている習慣' },
      { value: `${s.doneToday}/${Math.max(s.habitCount, 1)}`, unit: '', label: 'きょうの達成' },
      { value: String(s.bestCurrentStreak), unit: '日', label: 'いちばんの連続' },
      { value: String(s.totalChecks), unit: '日', label: 'のべ記録日数' },
    ];
    $('#summary').innerHTML = items
      .map(
        (it) => `
        <div class="summary-item">
          <div class="summary-value tnum">${esc(it.value)}${it.unit ? `<span class="unit">${esc(it.unit)}</span>` : ''}</div>
          <div class="summary-label">${esc(it.label)}</div>
        </div>`,
      )
      .join('');
  }

  function habitRow(habit: HabitWithMarks): string {
    const today = todayLocal();
    const { current, longest } = streaks(habit.marks, today);
    const done = habit.marks.has(today);
    return `
      <article class="habit" data-reveal aria-label="${esc(habit.name)}">
        <div class="habit-head">
          <button type="button" class="check habit-${habit.colorIndex}${done ? ' done' : ''}"
            data-toggle="${esc(habit.id)}" aria-pressed="${done}"
            aria-label="${esc(habit.name)}を今日やった">
            ${CHECK_ICON}
          </button>
          <div class="habit-meta">
            <h3 class="habit-name">${esc(habit.name)}</h3>
            <p class="habit-stats tnum">連続 <b>${current}</b> 日 ・ 最長 <b>${longest}</b> 日 ・ 合計 <b>${habit.marks.size}</b> 日</p>
          </div>
          <div class="habit-actions">
            <button type="button" class="icon-btn is-danger" data-remove="${esc(habit.id)}">削除</button>
          </div>
        </div>
        <div class="habit-map" data-habit="${esc(habit.id)}">
          ${heatmapSvg(today, (d) => (habit.marks.has(d) ? 4 : 0), {
            label: habit.name,
            colorClass: `habit-${habit.colorIndex}`,
          })}
        </div>
      </article>`;
  }

  function renderHabits(habits: HabitWithMarks[]): void {
    if (habits.length === 0) {
      $('#habits').innerHTML =
        '<p class="empty">まだ習慣がありません。続けたいことをひとつ、上のフォームから増やしてみてください。毎日ひとつ押すだけで、ここに一年ぶんの模様が育ちます。</p>';
      return;
    }
    $('#habits').innerHTML = `<div class="habit-list">${habits.map(habitRow).join('')}</div>`;
  }

  function render(): void {
    const habits = store.all();
    renderOverview(habits);
    renderSummary(habits);
    renderHabits(habits);
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
      if (remove.dataset.armed === undefined || remove.dataset.armed === '') {
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
