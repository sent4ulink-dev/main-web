'use client';
import { useEffect, useRef } from 'react';
export function Ending() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!,
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const silhouette = [
      '010000010',
      '011000110',
      '011111110',
      '111111111',
      '111111111',
      '011111110',
      '001111100',
      '011111110',
      '011111110',
      '111111111',
      '111111111',
      '011111110',
    ];
    const target: { x: number; y: number }[] = [];
    silhouette.forEach((row, y) =>
      row.split('').forEach((p, x) => {
        if (p === '1') target.push({ x: 30 + x * 2, y: 13 + y * 2 });
      }),
    );
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = reduced ? 1 : Math.min((now - start) / 1800, 1),
        move = reduced
          ? 1
          : Math.max(0, Math.min(1, (now - start - 1800) / 700));
      ctx.clearRect(0, 0, 120, 52);
      ctx.fillStyle = '#20351b';
      target.forEach((p, i) => {
        const sx = 8 + (i % 35) * 2,
          sy = 22 + Math.floor(i / 35) * 2,
          scatter = Math.sin(t * Math.PI) * 9;
        ctx.fillRect(
          Math.round(
            sx + (p.x - sx) * t + Math.sin(i * 23) * scatter + move * 12,
          ),
          Math.round(sy + (p.y - sy) * t + Math.cos(i * 17) * scatter),
          2,
          2,
        );
      });
      target.forEach((p) => {
        ctx.fillStyle = '#20351b';
        ctx.fillRect(p.x + 45, p.y, 2, 2);
      });
      if (t === 1 && move === 1) {
        ctx.fillStyle = '#9bb477';
        ctx.fillRect(81, 30, 4, 4);
        ctx.fillStyle = '#20351b';
        ctx.fillRect(70, 6, 2, 2);
        ctx.fillRect(74, 6, 2, 2);
        ctx.fillRect(70, 8, 6, 2);
        ctx.fillRect(72, 10, 2, 2);
      }
      if (!reduced && now - start < 3000) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas
      className="ending-canvas"
      ref={ref}
      width={120}
      height={52}
      // Canvas renders an image; a native img cannot draw the pixel transformation.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label="The snake dissolves into pixels, becomes a cat, and walks to its perfect match."
    />
  );
}
