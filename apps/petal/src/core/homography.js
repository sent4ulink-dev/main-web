// The perspective mapping that lays a flat box of width w and height h onto
// four points on the screen (top-left, top-right, bottom-right, bottom-left),
// so words written in the box land exactly on words painted on a surface in
// 3D. As a CSS matrix3d (transform-origin 0 0) and as a function, for tests.

export function quadMapping(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  // Square to quadrilateral (Heckbert), then the box's own size.
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, k = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    k = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3, f = y0;
  // Rows of the 3x3 matrix taking (x, y, 1) in the box to the screen.
  const m = [a / w, b / h, c, d / w, e / h, f, g / w, k / h, 1];
  return {
    matrix: m,
    apply(x, y) {
      const z = m[6] * x + m[7] * y + m[8];
      return [(m[0] * x + m[1] * y + m[2]) / z, (m[3] * x + m[4] * y + m[5]) / z];
    },
    css: `matrix3d(${[m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]].map((v) => +v.toPrecision(12)).join(",")})`,
  };
}
