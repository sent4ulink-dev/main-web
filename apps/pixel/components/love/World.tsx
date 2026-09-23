'use client';
import { useEffect, useRef } from 'react';
const INK = '#20351b',
  LCD = '#9bb477';
const heart = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000',
];
const cat = [
  '0100000010',
  '0110000110',
  '0111111110',
  '1111111111',
  '1111111111',
  '1111111111',
  '0111111110',
  '0011111100',
  '0011111100',
  '0111111110',
  '0111111110',
  '1111111111',
  '1111111111',
  '1111111111',
  '1111111111',
  '1111111111',
  '0111111110',
];
export function World({
  together = false,
  celebrate = false,
  quiet = false,
  hover = false,
}: {
  together?: boolean;
  celebrate?: boolean;
  quiet?: boolean;
  hover?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let tick = 0;
    function draw() {
      const portrait = innerHeight > innerWidth,
        scale = innerWidth < 600 ? 3 : 4;
      const w = (canvas.width = Math.ceil(canvas.clientWidth / scale)),
        h = (canvas.height = Math.ceil(canvas.clientHeight / scale));
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = LCD;
      ctx.fillRect(0, 0, w, h);
      const horizon = Math.round(h * (portrait ? 0.69 : 0.66)),
        dock = Math.round(h * 0.895),
        center = Math.round(w / 2);
      let seed = 73;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const rect = (
        x: number,
        y: number,
        a: number,
        b: number,
        color = INK,
      ) => {
        ctx.fillStyle = color;
        ctx.fillRect(
          Math.round(x),
          Math.round(y),
          Math.round(a),
          Math.round(b),
        );
      };
      const line = (points: number[][], color = INK, width = 1) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        points.forEach(([x, y], i) =>
          i
            ? ctx.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5)
            : ctx.moveTo(Math.round(x) + 0.5, Math.round(y) + 0.5),
        );
        ctx.stroke();
      };
      const sprite = (
        rows: string[],
        x: number,
        y: number,
        size = 1,
        color = INK,
      ) =>
        rows.forEach((row, iy) =>
          row.split('').forEach((p, ix) => {
            if (p === '1')
              rect(x + ix * size, y + iy * size, size, size, color);
          }),
        );
      for (let i = 0; i < 23; i++) {
        const x = rand() * w,
          y = h * (0.12 + rand() * 0.48),
          big = rand() > 0.65;
        if (
          x > w * (portrait ? 0.08 : 0.28) &&
          x < w * (portrait ? 0.92 : 0.72) &&
          y > h * (portrait ? 0.25 : 0) &&
          y < h * (portrait ? 0.63 : 0.53)
        )
          continue;
        if ((i + tick) % 19 === 0 && !reduced.matches) continue;
        rect(x, y, big ? 5 : 1, 1);
        if (big) rect(x + 2, y - 2, 1, 5);
      }
      const mx = Math.round(w * (portrait ? 0.81 : 0.82)),
        my = Math.round(h * (portrait ? 0.16 : 0.19));
      for (let y = -11; y <= 11; y++)
        for (let x = -11; x <= 11; x++)
          if (
            x * x + y * y < 120 &&
            (x - 5) * (x - 5) + (y + 4) * (y + 4) > 110
          )
            rect(mx + x, my + y, 1, 1);
      const cloud = (cx: number, cy: number, size: number) => {
        for (let x = -size; x < size; x += 2)
          for (let y = 0; y < 9; y += 2)
            if (
              y > 7 - Math.sin(((x + size) / size) * Math.PI) * 7 &&
              rand() > 0.16
            )
              rect(cx + x, cy + y, 1, 1);
      };
      cloud(
        w * 0.09 + (tick % 100 === 99 ? 1 : 0),
        h * (portrait ? 0.22 : 0.3),
        portrait ? 15 : 26,
      );
      if (!portrait) cloud(w * 0.94, h * 0.37, 22);
      if (!portrait) cloud(w * 0.23, h * 0.47, 18);
      const radius = portrait ? w * 0.17 : Math.min(w * 0.09, h * 0.12);
      for (let x = -Math.round(radius); x <= radius; x++) {
        const y = Math.round(Math.sqrt(Math.max(0, radius * radius - x * x)));
        rect(center + x, horizon - y, 1, 1);
      }
      const cityW = w * (portrait ? 0.3 : 0.29);
      for (let x = -2; x < cityW;) {
        const bw = 5 + Math.floor(rand() * 7),
          bh = (8 + rand() * 25) * (1 - x / cityW) + 4;
        rect(x, horizon - bh, bw, bh);
        if (x < cityW * 0.3 && x > cityW * 0.08) {
          rect(x + 2, horizon - bh - 9, 2, 9);
          rect(x + 2, horizon - bh - 14, 1, 5);
        }
        for (let wx = x + 2; wx < x + bw - 1; wx += 3)
          for (let wy = horizon - bh + 3; wy < horizon - 2; wy += 5)
            if (rand() > (together ? 0.12 : 0.42)) rect(wx, wy, 1, 2, LCD);
        x += bw + 2;
      }
      for (let x = Math.round(w * 0.66); x < w; x++) {
        const p = (x - w * 0.66) / (w * 0.34),
          rise = Math.floor(p * 25 + Math.sin(p * 10) * 3);
        rect(x, horizon - rise, 1, rise);
        if (x % 5 === 0)
          for (let y = horizon - rise + 4; y < horizon - 1; y += 5)
            if (rand() > 0.5) rect(x, y, 1, 1, LCD);
      }
      const tx = Math.round(w * 0.94);
      rect(tx, horizon - 40, 1, 17);
      rect(tx - 2, horizon - 33, 5, 5);
      line([
        [0, horizon],
        [w, horizon],
      ]);
      for (let y = horizon + 3; y < dock - 3; y += 2) {
        const gap = (portrait ? 10 : 17) + (y - horizon) * 0.43;
        for (let side = 0; side < 2; side++) {
          const start = side ? center + gap : 0,
            end = side ? w : center - gap;
          for (let x = start; x < end;) {
            const length = 2 + Math.floor(rand() * 14);
            if (rand() > 0.27)
              rect(
                x + (tick % 3 === 0 && y % 6 === 0 ? 1 : 0),
                y,
                Math.min(length, end - x),
                1,
                rand() > 0.15 ? INK : '#687f4e',
              );
            x += length + 1 + rand() * 4;
          }
        }
      }
      const dockL = portrait ? 5 : w * 0.19,
        dockR = portrait ? w - 5 : w * 0.81;
      rect(dockL, dock, dockR - dockL, 3);
      rect(dockL + 12, dock - 12, 8, 12);
      rect(dockR - 20, dock - 12, 8, 12);
      rect(dockL + 13, dock - 11, 6, 1, LCD);
      rect(dockR - 19, dock - 11, 6, 1, LCD);
      line(
        [
          [dockL + 20, dock - 4],
          [dockR - 20, dock - 4],
        ],
        INK,
        1,
      );
      const cs = portrait ? 2 : Math.max(2, Math.min(3, Math.floor(h / 75))),
        gap = together ? 0 : 2,
        cy = dock - cat.length * cs,
        catX = center - 10 * cs - gap;
      cat.forEach((row, iy) =>
        row.split('').forEach((p, ix) => {
          if (p !== '1') return;
          const border =
            iy === 0 ||
            iy === cat.length - 1 ||
            ix === 0 ||
            ix === 9 ||
            cat[iy - 1]?.[ix] !== '1' ||
            cat[iy + 1]?.[ix] !== '1' ||
            row[ix - 1] !== '1' ||
            row[ix + 1] !== '1';
          rect(catX + ix * cs, cy + iy * cs, cs, cs, border ? INK : LCD);
        }),
      );
      sprite(cat, center + gap, cy, cs);
      if (together) {
        const ty = cy + 10 * cs;
        line(
          [
            [center - 2 * cs, dock - cs],
            [center - 5 * cs, ty + 2 * cs],
            [center - 5 * cs, ty],
            [center - 3 * cs, ty - cs],
            [center, ty + cs],
          ],
          INK,
          cs,
        );
        line(
          [
            [center + 2 * cs, dock - cs],
            [center + 5 * cs, ty + 2 * cs],
            [center + 5 * cs, ty],
            [center + 3 * cs, ty - cs],
            [center, ty + cs],
          ],
          LCD,
          cs,
        );
      } else {
        line(
          [
            [catX + 7 * cs, dock - 2 * cs],
            [catX + 8 * cs, dock - 4 * cs],
            [catX + 7 * cs, dock - 6 * cs],
            [catX + 5 * cs, dock - 6 * cs],
            [catX + 4 * cs, dock - 5 * cs],
          ],
          INK,
          cs,
        );
        line(
          [
            [center + 4 * cs, dock - 2 * cs],
            [center + 2 * cs, dock - 4 * cs],
            [center + 3 * cs, dock - 6 * cs],
            [center + 5 * cs, dock - 6 * cs],
            [center + 6 * cs, dock - 5 * cs],
          ],
          LCD,
          cs,
        );
      }
      if (hover || (together && !quiet))
        sprite(heart, center - 3, cy - 10 - (tick % 5 === 0 ? 1 : 0));
      if (celebrate && !reduced.matches) {
        [
          [w * 0.17, h * 0.22],
          [w * 0.85, h * 0.43],
          [w * 0.25, h * 0.47],
        ].forEach(([x, y], i) => {
          const r = 5 + ((tick + i * 3) % 13);
          for (let a = 0; a < 12; a++) {
            const angle = (a * Math.PI) / 6;
            rect(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 1, 2);
          }
        });
        for (let i = 0; i < 4; i++)
          sprite(
            heart,
            center + (i - 1.5) * 17,
            horizon - 12 - ((tick * 2 + i * 11) % 30),
          );
      }
    }
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    const timer = setInterval(
      () => {
        if (!document.hidden && !reduced.matches) {
          tick++;
          draw();
        }
      },
      quiet ? 1500 : 650,
    );
    return () => {
      clearInterval(timer);
      resize.disconnect();
    };
  }, [together, celebrate, quiet, hover]);
  return <canvas ref={ref} className="world" aria-hidden="true" />;
}
