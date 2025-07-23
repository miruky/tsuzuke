import { describe, expect, it } from 'vitest';
import { heatmapCells, heatmapSvg } from './heatmap';

describe('heatmapCells', () => {
  it('53週ぶんの列を返し、今日が最後のセルになる', () => {
    const weeks = heatmapCells('2026-06-13', () => 0);
    expect(weeks).toHaveLength(53);
    const last = weeks[52] ?? [];
    expect(last[last.length - 1]?.date).toBe('2026-06-13');
  });

  it('未来のセルは描かない', () => {
    // 2026-06-13は土曜なので最終週は6日ぶん(月〜土)
    const weeks = heatmapCells('2026-06-13', () => 0);
    expect(weeks[52]).toHaveLength(6);
  });

  it('週の先頭は月曜になる', () => {
    const weeks = heatmapCells('2026-06-13', () => 0);
    const someWeek = weeks[10] ?? [];
    const dow = new Date(someWeek[0]?.date ?? '').getUTCDay();
    expect(dow).toBe(1);
  });

  it('levelOfの値を0〜4へ丸めて持つ', () => {
    const weeks = heatmapCells('2026-06-13', (d) => (d === '2026-06-13' ? 9 : -1));
    const last = weeks[52] ?? [];
    expect(last[last.length - 1]?.level).toBe(4);
    expect(last[0]?.level).toBe(0);
  });
});

describe('heatmapSvg', () => {
  it('セルにdata-dateとtitleが付く', () => {
    const svg = heatmapSvg('2026-06-13', () => 1);
    expect(svg).toContain('data-date="2026-06-13"');
    expect(svg).toContain('<title>2026-06-13</title>');
  });

  it('levelに応じたクラスが付く', () => {
    const svg = heatmapSvg('2026-06-13', (d) => (d === '2026-06-13' ? 4 : 0));
    expect(svg).toContain('level-4');
    expect(svg).toContain('level-0');
  });

  it('習慣の色クラスを差し込める', () => {
    const svg = heatmapSvg('2026-06-13', () => 1, { colorClass: 'habit-3' });
    expect(svg).toContain('habit-3');
  });

  it('月ラベルと曜日ラベルが入る', () => {
    const svg = heatmapSvg('2026-06-13', () => 0);
    expect(svg).toContain('6月');
    expect(svg).toContain('>月<');
  });

  it('aria-labelに説明が入る', () => {
    const svg = heatmapSvg('2026-06-13', () => 0, { label: '読書' });
    expect(svg).toContain('読書(直近1年)');
  });
});
