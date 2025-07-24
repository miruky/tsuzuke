// 継続ヒートマップのSVG生成。直近1年(53週)を週=列・曜日=行で並べる。
// 色はCSSクラス(level-0..4 / habit色)に任せ、ここでは構造だけ作る。

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const DAY_MS = 86_400_000;
const CELL = 12;
const GAP = 3;
const TOP = 18; // 月ラベル行
const LEFT = 24; // 曜日ラベル列

const WEEKDAY_LABELS = ['', '月', '', '水', '', '金', ''];

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface HeatmapCell {
  date: string;
  level: number; // 0..4
}

// todayを最終週に含む53週ぶんのセル並びを作る。
// levelはlevelOf(date)で与える(欠席=0)。
export function heatmapCells(today: string, levelOf: (date: string) => number): HeatmapCell[][] {
  const todayMs = toUtc(today);
  const todayDow = (new Date(todayMs).getUTCDay() + 6) % 7; // 月曜=0
  const weeks: HeatmapCell[][] = [];
  // 最終週の月曜
  const lastMonday = todayMs - todayDow * DAY_MS;
  for (let w = 52; w >= 0; w--) {
    const monday = lastMonday - w * DAY_MS * 7;
    const column: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = monday + d * DAY_MS;
      if (ms > todayMs) break; // 未来は描かない
      const date = fromUtc(ms);
      column.push({ date, level: Math.max(0, Math.min(4, levelOf(date))) });
    }
    weeks.push(column);
  }
  return weeks;
}

export function heatmapSvg(
  today: string,
  levelOf: (date: string) => number,
  opts: {
    label?: string;
    colorClass?: string;
    titleOf?: (date: string, level: number) => string;
  } = {},
): string {
  const weeks = heatmapCells(today, levelOf);
  const width = LEFT + weeks.length * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);

  // 月ラベル: 各週の先頭日が月初を含む週に表示
  const monthLabels: string[] = [];
  let lastMonth = '';
  weeks.forEach((week, i) => {
    const first = week[0]?.date ?? '';
    const month = first.slice(0, 7);
    if (month !== lastMonth && first.slice(8) <= '07') {
      monthLabels.push(
        `<text x="${LEFT + i * (CELL + GAP)}" y="11" class="hm-label">${Number(month.slice(5))}月</text>`,
      );
      lastMonth = month;
    }
  });

  const weekdayLabels = WEEKDAY_LABELS.map((label, d) =>
    label === ''
      ? ''
      : `<text x="0" y="${TOP + d * (CELL + GAP) + CELL - 2}" class="hm-label">${label}</text>`,
  ).join('');

  const cells = weeks
    .map((week, w) =>
      week
        .map((cell, d) => {
          const isToday = cell.date === today;
          const classes =
            `hm-cell level-${cell.level}` +
            (isToday ? ' hm-today' : '') +
            (opts.colorClass ? ' ' + opts.colorClass : '');
          const title = opts.titleOf ? opts.titleOf(cell.date, cell.level) : cell.date;
          return (
            `<rect x="${LEFT + w * (CELL + GAP)}" y="${TOP + d * (CELL + GAP)}" ` +
            `width="${CELL}" height="${CELL}" rx="3" class="${classes}" ` +
            `data-date="${cell.date}"><title>${escapeXml(title)}</title></rect>`
          );
        })
        .join(''),
    )
    .join('');

  const label = opts.label ?? '継続ヒートマップ';
  return (
    `<svg viewBox="0 0 ${width} ${height}" class="heatmap" role="img" ` +
    `aria-label="${escapeXml(label)}(直近1年)">` +
    monthLabels.join('') +
    weekdayLabels +
    cells +
    `</svg>`
  );
}
