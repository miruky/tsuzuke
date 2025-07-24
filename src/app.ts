// UI層。データはHabitStoreに任せ、ここでは描画とイベント配線だけを行う。

import type { HabitStore, HabitWithMarks } from './lib/habits';
import { HabitError, streaks } from './lib/habits';
import { escapeXml, heatmapSvg } from './lib/heatmap';
import { summarize } from './lib/stats';
import { countUp, popStamp, revealOnScroll } from './lib/motion';
import { applyTheme, labelFor, nextPref, readPref, writePref, type ThemePref } from './lib/theme';

const esc = escapeXml;

const HERO_IMAGE = 'https://picsum.photos/seed/tsuzuke-grain/1600/1000?grayscale';

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const icon = (paths: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const ICON_UP = icon('<path d="M12 19V6"/><path d="M6 11l6-6 6 6"/>');
const ICON_DOWN = icon('<path d="M12 5v13"/><path d="M18 13l-6 6-6-6"/>');
const ICON_RENAME = icon('<path d="M4 20h16"/><path d="M14.5 5.5l4 4L8 20l-4 1 1-4z"/>');
const ICON_TRASH = icon('<path d="M5 7h14"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/>');

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
            <button type="button" id="theme" class="btn-ghost" aria-label="表示テーマを切り替え">テーマ: 自動</button>
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
      <p class="shortcuts tnum">キーボード: <kbd>1</kbd>〜<kbd>9</kbd> でその習慣の今日を記録 ・ <kbd>n</kbd> で入力欄へ</p>
    </footer>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>`;

  const $ = <T extends HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (node === null) throw new Error(`要素が見つからない: ${selector}`);
    return node;
  };

  const toastBox = $('#toast');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let renamingId: string | null = null;

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

  function renderSummary(habits: HabitWithMarks[], animate: boolean): void {
    const today = todayLocal();
    const s = summarize(habits, today);
    const items: { value: string; count?: number; unit: string; label: string }[] = [
      { value: String(s.habitCount), count: s.habitCount, unit: '個', label: '続けている習慣' },
      {
        value: s.habitCount === 0 ? '—' : `${s.doneToday}/${s.habitCount}`,
        unit: '',
        label: 'きょうの達成',
      },
      { value: String(s.bestCurrentStreak), count: s.bestCurrentStreak, unit: '日', label: 'いちばんの連続' },
      { value: String(s.totalChecks), count: s.totalChecks, unit: '日', label: 'のべ記録日数' },
    ];
    $('#summary').innerHTML = items
      .map((it, i) => {
        const num =
          it.count !== undefined
            ? `<span class="num" data-count="${it.count}">${animate ? 0 : it.count}</span>`
            : esc(it.value);
        return `
        <div class="summary-item" data-i="${i}">
          <div class="summary-value tnum">${num}${it.unit ? `<span class="unit">${esc(it.unit)}</span>` : ''}</div>
          <div class="summary-label">${esc(it.label)}</div>
        </div>`;
      })
      .join('');
    if (animate) {
      $('#summary')
        .querySelectorAll<HTMLElement>('.num[data-count]')
        .forEach((el) => countUp(el, Number(el.dataset.count ?? 0)));
    }
  }

  function habitRow(habit: HabitWithMarks, index: number, total: number): string {
    const today = todayLocal();
    const { current, longest } = streaks(habit.marks, today);
    const done = habit.marks.has(today);
    const id = esc(habit.id);
    const name = esc(habit.name);
    const nameBlock =
      renamingId === habit.id
        ? `<input class="rename-input" data-rename-input="${id}" value="${name}" maxlength="30" aria-label="${name}の新しい名前">`
        : `<h3 class="habit-name">${name}</h3>`;
    const ordinal = index < 9 ? `<span class="habit-ordinal tnum" aria-hidden="true">${index + 1}</span>` : '';
    return `
      <article class="habit" aria-label="${name}">
        <div class="habit-head">
          ${ordinal}
          <button type="button" class="check habit-${habit.colorIndex}${done ? ' done' : ''}"
            data-toggle="${id}" aria-pressed="${done}"
            aria-label="${name}の今日を記録">
            ${CHECK_ICON}
          </button>
          <div class="habit-meta">
            ${nameBlock}
            <p class="habit-stats tnum">連続 <b>${current}</b> 日 ・ 最長 <b>${longest}</b> 日 ・ 合計 <b>${habit.marks.size}</b> 日</p>
          </div>
          <div class="habit-actions">
            <button type="button" class="icon-btn" data-move="${id}" data-dir="-1" aria-label="${name}を上へ" title="上へ"${index === 0 ? ' disabled' : ''}>${ICON_UP}</button>
            <button type="button" class="icon-btn" data-move="${id}" data-dir="1" aria-label="${name}を下へ" title="下へ"${index === total - 1 ? ' disabled' : ''}>${ICON_DOWN}</button>
            <button type="button" class="icon-btn swatch habit-${habit.colorIndex}" data-color="${id}" aria-label="${name}の色を変える" title="色を変える"></button>
            <button type="button" class="icon-btn" data-rename="${id}" aria-label="${name}の名前を変える" title="名前を変える">${ICON_RENAME}</button>
            <button type="button" class="icon-btn is-danger" data-remove="${id}" aria-label="${name}を削除" title="削除">${ICON_TRASH}</button>
          </div>
        </div>
        <div class="habit-map" data-habit="${id}">
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
    $('#habits').innerHTML = `<div class="habit-list">${habits
      .map((h, i) => habitRow(h, i, habits.length))
      .join('')}</div>`;
    if (renamingId !== null) {
      const input = root.querySelector<HTMLInputElement>('[data-rename-input]');
      if (input !== null) {
        input.focus();
        input.select();
      }
    }
  }

  function render(animate = false): void {
    const habits = store.all();
    renderOverview(habits);
    renderSummary(habits, animate);
    renderHabits(habits);
  }

  function commitRename(id: string, value: string): void {
    renamingId = null;
    try {
      const trimmed = value.trim();
      const current = store.all().find((h) => h.id === id);
      if (trimmed !== '' && current !== undefined && trimmed !== current.name) {
        store.rename(id, trimmed);
        toast('名前を変えました');
      }
    } catch (err) {
      toast(err instanceof HabitError ? err.message : '名前の変更に失敗しました');
    }
    render();
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
      if (marked) {
        const check = root.querySelector<HTMLElement>(`[data-toggle="${CSS.escape(id)}"]`);
        if (check !== null) popStamp(check);
      }
      return;
    }

    const move = target.closest<HTMLElement>('[data-move]');
    if (move !== null) {
      const id = move.dataset.move ?? '';
      const dir = move.dataset.dir === '1' ? 1 : -1;
      store.move(id, dir);
      render();
      // キーボード操作で並べ替えても文脈を失わないよう焦点を移動先へ戻す。
      const idSel = CSS.escape(id);
      const same = root.querySelector<HTMLElement>(`[data-move="${idSel}"][data-dir="${dir}"]`);
      const fallback = root.querySelector<HTMLElement>(`[data-toggle="${idSel}"]`);
      (same !== null && !(same as HTMLButtonElement).disabled ? same : fallback)?.focus();
      return;
    }

    const color = target.closest<HTMLElement>('[data-color]');
    if (color !== null) {
      const id = color.dataset.color ?? '';
      const current = store.all().find((h) => h.id === id);
      if (current !== undefined) {
        store.setColor(id, current.colorIndex + 1);
        render();
      }
      return;
    }

    const rename = target.closest<HTMLElement>('[data-rename]');
    if (rename !== null) {
      renamingId = rename.dataset.rename ?? null;
      render();
      return;
    }

    const remove = target.closest<HTMLElement>('[data-remove]');
    if (remove !== null) {
      if (remove.dataset.armed === undefined || remove.dataset.armed === '') {
        remove.dataset.armed = '1';
        remove.classList.add('is-armed');
        remove.setAttribute('title', 'もう一度押すと削除');
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

  $('#habits').addEventListener('keydown', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-rename-input]');
    if (input === null) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename(input.dataset.renameInput ?? '', input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      renamingId = null;
      render();
    }
  });

  $('#habits').addEventListener('focusout', (e) => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-rename-input]');
    if (input !== null && renamingId !== null) {
      commitRename(input.dataset.renameInput ?? '', input.value);
    }
  });

  let themePref: ThemePref = readPref();
  const themeBtn = $('#theme');
  const paintTheme = (): void => {
    applyTheme(themePref);
    themeBtn.textContent = `テーマ: ${labelFor(themePref)}`;
  };
  paintTheme();
  themeBtn.addEventListener('click', () => {
    themePref = nextPref(themePref);
    writePref(themePref);
    paintTheme();
    toast(`表示テーマ: ${labelFor(themePref)}`);
  });

  // 数字キーでその習慣の今日を記録、n で入力欄へ。入力中は無効。
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const typing =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable);
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'n') {
      e.preventDefault();
      $<HTMLInputElement>('#add-form input[name="name"]').focus();
      return;
    }
    if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      const habit = store.all()[idx];
      if (habit === undefined) return;
      e.preventDefault();
      const marked = store.toggle(habit.id, todayLocal());
      toast(marked ? `「${habit.name}」今日もできました` : `「${habit.name}」今日の印を外しました`);
      render();
      if (marked) {
        const check = root.querySelector<HTMLElement>(`[data-toggle="${CSS.escape(habit.id)}"]`);
        if (check !== null) popStamp(check);
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

  render(true);
  revealOnScroll(root.querySelectorAll<HTMLElement>('[data-reveal]'));
}
