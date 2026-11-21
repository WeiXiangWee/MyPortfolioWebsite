// Tiny pixel-art toolkit used by the art scripts (no dependencies).
// - PixelCanvas: an RGBA pixel buffer you can fill, shade and save as PNG
// - makeIso: project 3D room coordinates onto a 2:1 isometric pixel grid
// - dith / ramp: ordered (Bayer) dithering, the classic pixel-art way to draw gradients
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

/* ---------- colours ---------- */
const cache = new Map();
export function rgba(hex) {
  if (Array.isArray(hex)) return hex;
  if (cache.has(hex)) return cache.get(hex);
  const h = hex.replace('#', '');
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255];
  cache.set(hex, v);
  return v;
}
const toHex = (r, g, b) => '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
/** Mix two hex colours. t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const A = rgba(a), B = rgba(b);
  return toHex(...[0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t));
}
/** Same colour with an alpha value (0–1). */
export function alpha(hex, a) {
  return hex.slice(0, 7) + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
}

/* ---------- dithering + noise ---------- */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
/** true on a fraction t of pixels, in an ordered checker pattern */
export const dith = (t, x, y) => t > (BAYER[y & 3][x & 3] + 0.5) / 16;
/** Dithered gradient through a list of colours (t = 0..1). */
export function ramp(cols, t, x, y) {
  if (cols.length === 1) return cols[0];
  const pos = clamp01(t) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(pos));
  return dith(pos - i, x, y) ? cols[i + 1] : cols[i];
}
/** Dithered steps through a list of numbers (for light/shadow amounts). */
export function rampN(vals, t, x, y) {
  const pos = clamp01(t) * (vals.length - 1);
  const i = Math.min(vals.length - 2, Math.floor(pos));
  return dith(pos - i, x, y) ? vals[i + 1] : vals[i];
}
/** Stable pseudo-random value 0..1 for integer inputs. */
export function noise(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------- PNG encoding ---------- */
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- canvas ---------- */
export class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  /** Paint one pixel. Colours with alpha are blended over what is there. 'clear' erases. */
  set(x, y, color) {
    if (color == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (color === 'clear') {
      d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      return;
    }
    const [r, g, b, a] = rgba(color);
    if (a === 255 || d[i + 3] === 0) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
      return;
    }
    const t = a / 255;
    d[i] = Math.round(d[i] + (r - d[i]) * t);
    d[i + 1] = Math.round(d[i + 1] + (g - d[i + 1]) * t);
    d[i + 2] = Math.round(d[i + 2] + (b - d[i + 2]) * t);
    d[i + 3] = Math.min(255, Math.round(d[i + 3] + a * (1 - d[i + 3] / 255)));
  }
  /** Colour at a pixel as '#rrggbb', or null if transparent. */
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    if (!this.data[i + 3]) return null;
    return toHex(this.data[i], this.data[i + 1], this.data[i + 2]);
  }
  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color);
  }
  /** Fill a polygon by sampling pixel centres. fill = colour or (sx, sy, px, py) => colour. */
  fillPoly(pts, fill) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        if (!inside(pts, cx, cy)) continue;
        this.set(x, y, typeof fill === 'function' ? fill(cx, cy, x, y) : fill);
      }
    }
  }
  /**
   * Darken the outermost pixels of every shape (a "selective inner outline").
   * Keeps silhouettes the same size but gives each object a crisp edge.
   */
  innerOutline(ink, amount = 0.5) {
    const src = this.data.slice();
    const [ir, ig, ib] = rgba(ink);
    const opaque = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && src[(y * this.w + x) * 4 + 3] > 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!opaque(x, y)) continue;
        if (opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1)) continue;
        const i = (y * this.w + x) * 4;
        this.data[i] = Math.round(src[i] + (ir - src[i]) * amount);
        this.data[i + 1] = Math.round(src[i + 1] + (ig - src[i + 1]) * amount);
        this.data[i + 2] = Math.round(src[i + 2] + (ib - src[i + 2]) * amount);
      }
  }
  /** Bounding box of the non-transparent pixels. */
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.data[(y * this.w + x) * 4 + 3]) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  crop({ x, y, w, h }) {
    const out = new PixelCanvas(w, h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const sx = x + i, sy = y + j;
        if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
        const s = (sy * this.w + sx) * 4, d = (j * w + i) * 4;
        for (let k = 0; k < 4; k++) out.data[d + k] = this.data[s + k];
      }
    return out;
  }
  /** Draw a bitmap of strings. legend maps characters to colours. */
  bitmap(x, y, rows, legend, scale = 1) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (legend[ch]) this.rect(x + i * scale, y + j * scale, scale, scale, legend[ch]);
      }),
    );
  }
  save(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, encodePNG(this.w, this.h, this.data));
  }
}

function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* ---------- isometric projection (2:1 grid) ----------
   Room axes: X runs to the lower right, Y to the lower left, Z is up.
   U = pixels per room unit. One unit along X or Y moves U px across and U/2 px down. */
export function makeIso(OX, OY, U = 1) {
  const P = (X, Y, Z) => [OX + U * (X - Y), OY + (U / 2) * (X + Y) - U * Z];
  // Inverse projections: which room point is under a screen pixel, for a given plane
  const onTop = (sx, sy, Z) => {
    const a = (sx - OX) / U, b = (sy - OY + U * Z) / (U / 2);
    return { X: (a + b) / 2, Y: (b - a) / 2, Z };
  };
  const zFrom = (sy, X, Y) => (OY + (U / 2) * (X + Y) - sy) / U;
  const onFaceY = (sx, sy, Y) => {
    const X = (sx - OX) / U + Y;
    return { X, Y, Z: zFrom(sy, X, Y) };
  };
  const onFaceX = (sx, sy, X) => {
    const Y = X - (sx - OX) / U;
    return { X, Y, Z: zFrom(sy, X, Y) };
  };
  const res = (f, p, b) => (typeof f === 'function' ? f(p, b) : f);
  const withPx = (p, px, py) => Object.assign(p, { px, py });

  /** Draw the three visible faces of a box. styles: { top, front (faces +Y), side (faces +X) } */
  function box(cv, b, s) {
    const { x0, x1, y0, y1, z0, z1 } = b;
    if (s.front) cv.fillPoly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], (sx, sy, px, py) => res(s.front, withPx(onFaceY(sx, sy, y1), px, py), b));
    if (s.side) cv.fillPoly([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], (sx, sy, px, py) => res(s.side, withPx(onFaceX(sx, sy, x1), px, py), b));
    if (s.top) cv.fillPoly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], (sx, sy, px, py) => res(s.top, withPx(onTop(sx, sy, z1), px, py), b));
  }
  /** Screen corners of a box (for hit polygons). */
  function corners(b) {
    const out = [];
    for (const X of [b.x0, b.x1]) for (const Y of [b.y0, b.y1]) for (const Z of [b.z0, b.z1]) out.push(P(X, Y, Z));
    return out;
  }
  /** Fill a flat region on a plane: plane = 'top' (Z), 'x' (X) or 'y' (Y). */
  function plane(cv, kind, value, poly3d, fill) {
    const inv = kind === 'top' ? onTop : kind === 'x' ? onFaceX : onFaceY;
    cv.fillPoly(poly3d.map((q) => P(...q)), (sx, sy, px, py) => fill(withPx(inv(sx, sy, value), px, py)));
  }
  return { P, onTop, onFaceY, onFaceX, box, corners, plane };
}

/** Convex hull (monotone chain), pushed outward by pad pixels. */
export function hull(points, pad = 1) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of pts.slice().reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const h = lower.slice(0, -1).concat(upper.slice(0, -1));
  const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
  const cy = h.reduce((s, p) => s + p[1], 0) / h.length;
  return h.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    return [Math.round(x + (dx / d) * pad), Math.round(y + (dy / d) * pad)];
  });
}

/** Small deterministic random generator so textures are the same every run. */
export function rng(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
