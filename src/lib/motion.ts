// 控えめで物理的なモーション。reduced-motionや非ブラウザ環境では何もしない。
// 値の補間など中身は純粋関数に切り出してテストできるようにする。

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

// 経過割合progress(0..1)に対する表示値(整数)。カウントアップの純粋核。
export function countValue(from: number, to: number, progress: number): number {
  return Math.round(from + (to - from) * easeOutCubic(progress));
}

// セクションの入場。交差時にis-revealedを付ける。観測できない環境では即表示。
export function revealOnScroll(targets: Iterable<HTMLElement>): void {
  const list = [...targets];
  if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
    list.forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  list.forEach((el, i) => el.style.setProperty('--reveal-i', String(i % 5)));
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
  );
  list.forEach((el) => io.observe(el));
}

// 0からtoまで数を上げる。アニメ不可なら最終値を即セット。
export function countUp(el: HTMLElement, to: number, duration = 850): void {
  if (
    prefersReducedMotion() ||
    typeof requestAnimationFrame !== 'function' ||
    typeof performance === 'undefined'
  ) {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const tick = (now: number): void => {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = String(countValue(0, to, progress));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// 今日の印を付けた瞬間の「押した」フィードバック。判子のように小さく弾む。
export function popStamp(el: HTMLElement): void {
  if (prefersReducedMotion() || typeof el.animate !== 'function') return;
  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(0.82)', offset: 0.35 },
      { transform: 'scale(1.06)', offset: 0.7 },
      { transform: 'scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
  );
}
