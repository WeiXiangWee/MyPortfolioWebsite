// Builds "The Workbench" as a real 3D diorama for CSS 3D transforms.
// Run: npm run art
//
// The room is made of boxes and flat panels in room units (X right-back, Y left-back, Z up).
// Every visible face gets its own pixel-art texture, painted with the same tricks as before
// (Bayer dithering, 1px highlights, ambient shadows). All textures are packed into one atlas.
//
// Output
//   public/room3d/atlas.png      every face texture
//   public/room3d/skyline*.png   city outside the window (seen through the glass, with parallax)
//   src/scene/scene3d.js         each face's size, atlas position and 3D placement (generated)
//
// The camera always looks from the +X/+Y side, so only the top, +X and +Y faces of a box are drawn.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PixelCanvas, mix, alpha, rng, dith, ramp, rampN, noise } from './pixel.mjs';

const TX = 2; // texels (art pixels) per room unit
const S = 4; // CSS px per room unit
const E = 1 / TX; // one texel, in room units
const RW = 160, RD = 130, RH = 130; // room size: width (X), depth (Y), wall height (Z)
const T = 6, SLAB = 8; // wall thickness, floor slab thickness
const OUT = 'public/room3d';

/* ---------- Palette: the brief's tokens + shades mixed from them ---------- */
const C = {
  bg: '#1E1626', surface: '#2C2135', surface2: '#3A2C46', text: '#F6E7D6', muted: '#B9A6B8',
  accent: '#FF9F43', accent2: '#9D8CFF', shadow: '#0E0A12',
  wall: '#2A1F33', sky: '#4B2F5C', horizon: '#B4476A', sun: '#FF9F43', desk: '#4A3242', floor: '#1E1626',
};
const lit = (c, k = 0.15) => mix(c, C.text, k);
const dk = (c, k = 0.3) => mix(c, C.shadow, k);
Object.assign(C, {
  wallR: mix(C.wall, C.horizon, 0.09),
  wallL: C.wall,
  wallTop: mix(C.wall, C.text, 0.24),
  wallEnd: dk(C.wall, 0.45),
  wainscot: mix(C.wall, C.desk, 0.5),
  rail: mix(C.desk, C.text, 0.16),
  moulding: mix(C.wall, C.text, 0.16),
  base: dk(C.desk, 0.4),
  frame: mix(C.wall, C.text, 0.3),
  curtain: mix(C.horizon, C.wall, 0.52),
  plankA: mix(C.desk, C.floor, 0.4),
  plankB: mix(C.desk, C.floor, 0.3),
  plankC: mix(C.desk, C.floor, 0.5),
  seam: C.floor,
  floorEdge: mix(C.desk, C.text, 0.24),
  rug: mix(C.sky, C.wall, 0.3),
  rugBorder: mix(C.horizon, C.wall, 0.42),
  rugBand: mix(C.muted, C.sky, 0.55),
  rugDot: mix(C.accent2, C.wall, 0.45),
  metal: mix(C.surface2, C.muted, 0.3),
  metalDark: dk(C.surface, 0.25),
  case: dk(C.surface, 0.12),
  wood: mix(C.desk, C.text, 0.1),
  leaf: ['#33493F', '#46634F', '#5E7F62', '#86A77F'],
  pot: mix(C.horizon, C.desk, 0.45),
  warm: mix(C.accent, C.text, 0.35),
  cable: dk(C.surface, 0.3),
});

/* ---------- small vector helpers ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const B = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

/* ---------- scene recording ---------- */
// A group is one thing in the room (the walls, the desk, the monitor...). Clickable objects are groups too.
const groups = {};
let G = null;
function group(name, fn) {
  const prev = G;
  G = groups[name] ??= { faces: [], pts: [] };
  fn();
  G = prev;
}

/**
 * One flat textured panel. o = top-left corner, u = across (left→right), v = down (top→bottom), in room units.
 * fill(p) paints each texel from its room position p = { X, Y, Z, px, py, s, t }.
 */
function face(o, u, v, fill, opts = {}) {
  const w = Math.max(1, Math.round(len(u) * TX)), h = Math.max(1, Math.round(len(v) * TX));
  const cv = opts.canvas ?? new PixelCanvas(w, h);
  if (!opts.canvas)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const s = (i + 0.5) / w, t = (j + 0.5) / h;
        if (opts.inside && !opts.inside(s, t)) continue;
        const q = add(add(o, mul(u, s)), mul(v, t));
        const c = fill({ X: q[0], Y: q[1], Z: q[2], px: i, py: j, s, t });
        if (c && c !== 'clear') cv.set(i, j, c);
      }
  G.faces.push({ o, u, v, cv, ...opts });
  G.pts.push(o, add(o, u), add(o, v), add(add(o, u), v));
}
const res = (f, p, b) => (typeof f === 'function' ? f(p, b) : f);
/** A box: draws its top, front (+Y) and side (+X) faces. */
function box(b, s, opts = {}) {
  const { x0, x1, y0, y1, z0, z1 } = b;
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  if (s.top) face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], (p) => res(s.top, p, b), opts);
  if (s.front) face([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], (p) => res(s.front, p, b), opts);
  if (s.side) face([x1, y1, z1], [0, -dy, 0], [0, 0, -dz], (p) => res(s.side, p, b), opts);
}
/** Solid box shading: lit top with a 1px highlight on its front edges, darker side, crisp corner. */
function shaded(base, o = {}) {
  const top = o.top ?? lit(base, 0.14);
  const hi = o.hi ?? lit(base, 0.34);
  const side = o.side ?? dk(base, 0.32);
  return {
    top: (p, b) => (b.y1 - p.Y < E || b.x1 - p.X < E ? hi : top),
    front: (p, b) => (b.x1 - p.X < E ? lit(base, 0.12) : b.z1 - p.Z < E ? lit(base, 0.08) : base),
    side: (p, b) => (b.z1 - p.Z < E ? dk(base, 0.18) : side),
  };
}
/** A slanted panel shaped like a trapezoid (bottom wider than top), e.g. one side of a lamp shade. */
function trapezoid(bl, br, tl, tr, fill, opts) {
  const midB = mul(add(bl, br), 0.5), midT = mul(add(tl, tr), 0.5);
  const up = add(midT, mul(midB, -1));
  const u = add(br, mul(bl, -1));
  const inset = (len(u) - len(add(tr, mul(tl, -1)))) / 2 / len(u);
  face(add(bl, up), u, mul(up, -1), fill, {
    ...opts,
    inside: (s, t) => s > inset * (1 - t) && s < 1 - inset * (1 - t),
    clip: `polygon(${(inset * 100).toFixed(2)}% 0, ${(100 - inset * 100).toFixed(2)}% 0, 100% 100%, 0 100%)`,
  });
}
/** Two crossed see-through panels (used for plants). leaves = [{ x, y, z, c, top }] voxels. */
function crossedSprite(vox, cx, cy, size = 1) {
  const xs = vox.map((v) => v.x), ys = vox.map((v) => v.y), zs = vox.map((v) => v.z);
  const x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 2;
  const y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 2;
  const z0 = Math.floor(Math.min(...zs)), z1 = Math.ceil(Math.max(...zs)) + 2;
  const paint = (w, h, toUV, order) => {
    const cv = new PixelCanvas(Math.round(w * TX), Math.round(h * TX));
    const n = Math.max(1, Math.round(size * TX));
    [...vox].sort(order).forEach((v) => {
      const [u, vv] = toUV(v);
      const px = Math.round(u * TX), py = Math.round(vv * TX);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cv.set(px + i, py + j, j === 0 ? v.top ?? lit(v.c, 0.2) : i === n - 1 ? dk(v.c, 0.2) : v.c);
    });
    cv.innerOutline(C.shadow, 0.4);
    return cv;
  };
  // panel along X (seen from +Y)
  face([x0, cy, z1], [x1 - x0, 0, 0], [0, 0, -(z1 - z0)], null, {
    double: true,
    canvas: paint(x1 - x0, z1 - z0, (v) => [v.x - x0, z1 - v.z - size], (a, b) => a.y - b.y),
  });
  // panel along Y (seen from +X)
  face([cx, y1, z1], [0, -(y1 - y0), 0], [0, 0, -(z1 - z0)], null, {
    double: true,
    canvas: paint(y1 - y0, z1 - z0, (v) => [y1 - v.y - size, z1 - v.z - size], (a, b) => a.x - b.x),
  });
}
/** Leaves fanning out from a stem, as a list of little cubes. */
function leaves(cx, cy, cz, count, seed, [l0, l1], s = 1) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.7;
    const L = l0 + r() * (l1 - l0);
    const rise = 0.8 + r() * 0.7;
    for (let d = 0; d <= L; d += s) {
      const t = d / L;
      out.push({ x: cx + Math.cos(a) * d * 0.75, y: cy + Math.sin(a) * d * 0.75, z: cz + d * rise - d * d * 0.06, c: C.leaf[Math.min(2, Math.floor(t * 3))], top: t > 0.4 ? C.leaf[3] : C.leaf[2] });
    }
  }
  return out;
}
/** Flat "stickers" painted onto a face with a little fake depth: highlight on top, shadow on the right and below. */
function decals(list, base, coordA, coordB) {
  return (p) => {
    const a = coordA(p), b = coordB(p);
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (a > d.a0 && a < d.a1 && b > d.b0 && b < d.b1) {
        if (d.fill) {
          const c = d.fill(p, a, b);
          if (c) return c;
        }
        if (d.col) return b > d.b1 - E ? lit(d.col, 0.3) : a > d.a1 - E ? dk(d.col, 0.25) : d.col;
      }
    }
    for (const d of list) if (d.col && a > d.a0 + 0.5 && a < d.a1 + 0.5 && b > d.b0 - 0.5 && b < d.b1 - 0.5) return dk(base(p), 0.4); // drop shadow
    return base(p);
  };
}

/* ====================== WALLS + FLOOR ====================== */
const HOLE = { y0: 52, y1: 108, z0: 54, z1: 112 }; // window opening in the left wall (plane X = 0)
const MID = (HOLE.y0 + HOLE.y1) / 2;
const inHole = (p) => p.Y > HOLE.y0 && p.Y < HOLE.y1 && p.Z > HOLE.z0 && p.Z < HOLE.z1;
const ring = (p, m) => p.Y > HOLE.y0 - m && p.Y < HOLE.y1 + m && p.Z > HOLE.z0 - m && p.Z < HOLE.z1 + m;

/** Wall surface: baseboard, wainscot boards, rail, wallpaper with a dithered shade, crown moulding. */
function wallSurface(p, u, base, cornerDist) {
  const { Z, px, py } = p;
  if (Z < 0) return C.wallEnd;
  let c;
  if (Z < 3) c = Z > 3 - E ? lit(C.base, 0.25) : C.base;
  else if (Z < 34) {
    const m = u % 6;
    c = m < E ? dk(C.wainscot, 0.32) : m < 2 * E ? lit(C.wainscot, 0.08) : C.wainscot;
    if (Z > 34 - E) c = dk(C.wainscot, 0.35);
    else if (Z < 4) c = dk(c, 0.15);
  } else if (Z < 36.5) c = Z > 36.5 - E ? lit(C.rail, 0.25) : Z < 34 + E ? dk(C.rail, 0.2) : C.rail;
  else if (Z > RH - E) c = C.wallTop;
  else if (Z > RH - 3) c = Z > RH - 1 ? lit(C.moulding, 0.1) : Z < RH - 3 + E ? dk(C.moulding, 0.25) : C.moulding;
  else {
    const b2 = Math.floor(u / 4) % 2 === 0 ? base : dk(base, 0.05);
    c = ramp([b2, dk(b2, 0.1), dk(b2, 0.2)], ((Z - 40) / (RH - 44)) * 1.1, px, py);
  }
  if (cornerDist < 6 && dith((1 - cornerDist / 6) * 0.85, px, py)) c = dk(c, 0.22);
  return c;
}

const RUG = B(46, 124, 58, 112, 0, 0);
const CABLE = Array.from({ length: 80 }, (_, i) => {
  const t = i / 79;
  return [27 - 26 * t, 119 - 8 * t + 5 * Math.sin(Math.PI * t)];
});
function rugColor(p) {
  const e = Math.min(p.X - RUG.x0, RUG.x1 - p.X, p.Y - RUG.y0, RUG.y1 - p.Y);
  if (e < E) return dk(C.rugBorder, 0.3);
  if (e < 2) return C.rugBorder;
  if (e < 3.5) return (Math.floor(p.X) + Math.floor(p.Y)) % 2 ? C.rugBand : lit(C.rugBand, 0.1);
  if (e < 5) return C.rugBorder;
  if (e < 5 + E) return dk(C.rugBorder, 0.25);
  const u = (((p.X - RUG.x0) % 12) + 12) % 12 - 6, v = (((p.Y - RUG.y0) % 12) + 12) % 12 - 6;
  const m = Math.abs(u) + Math.abs(v);
  if (m < 1.5) return C.rugDot;
  if (m > 3.5 && m < 4 + E) return mix(C.rug, C.rugDot, 0.45);
  return C.rug;
}
function floorTop(p) {
  const { X, Y, px, py } = p;
  if (Y > RD - E || X > RW - E) return C.floorEdge;
  let c;
  if (X > RUG.x0 && X < RUG.x1 && Y > RUG.y0 && Y < RUG.y1) c = rugColor(p);
  else if ((X > RUG.x0 - 2 && X < RUG.x0) || (X > RUG.x1 && X < RUG.x1 + 2)) c = Y > RUG.y0 + 1 && Y < RUG.y1 - 1 && Math.floor(Y * 2) % 3 !== 0 ? lit(C.rugBand, 0.15) : null;
  if (!c) {
    const row = Math.floor(Y / 8);
    const off = (row * 23) % 40;
    const seg = Math.floor((X + off) / 40);
    const along = (X + off) % 40;
    if (Y % 8 < E || along < E) c = C.seam;
    else {
      c = [C.plankA, C.plankB, C.plankC][Math.floor(noise(row, seg, 5) * 3)];
      const inPlank = Y % 8;
      if (inPlank > 8 - E) c = lit(c, 0.1);
      if ((Math.abs(inPlank - 3) < E || Math.abs(inPlank - 5.5) < E) && noise(Math.floor(X / 3), row * 2 + (inPlank > 4 ? 1 : 0), 9) < 0.45) c = dk(c, 0.1);
      if (along > 1 && along < 1.5 && (Math.abs(inPlank - 2) < E || Math.abs(inPlank - 6) < E)) c = dk(c, 0.35);
    }
  }
  if (CABLE.some(([cx, cy]) => Math.abs(X - cx) < 0.4 && Math.abs(Y - cy) < 0.4)) return C.cable;
  const wd = Math.min(X, Y);
  if (wd < 7 && dith((1 - wd / 7) * 0.9, px, py)) c = dk(c, 0.25);
  if (X > 12 && X < 153 && Y < 48 && dith(Math.min(1, Math.min(48 - Y, X - 12, 153 - X) / 4), px, py)) c = dk(c, 0.38);
  for (const [cx, cy, r] of [[14, 76, 8], [27, 117, 6]]) {
    const d = Math.hypot(X - cx, Y - cy);
    if (d < r && dith(Math.min(1, (r - d) / 3), px, py)) c = dk(c, 0.3);
  }
  return c;
}

group('walls', () => {
  // right wall (inner face at Y = 0) with a lavender halo from the monitor
  box(B(0, RW, -T, 0, -SLAB, RH), {
    front: (p) => {
      let c = wallSurface(p, p.X, C.wallR, p.X);
      if (p.Z > 0) {
        const k = rampN([0, 0.05, 0.1, 0.16], 1 - Math.hypot((p.X - 67) / 1.5, p.Z - 66) / 52, p.px, p.py);
        if (k) c = mix(c, C.accent2, k);
      }
      return c;
    },
    top: C.wallTop,
    side: (p) => (p.Z > RH - E ? C.wallTop : C.wallEnd),
  });
  // left wall with the window opening, frame and cross bars
  box(B(-T, 0, 0, RD, -SLAB, RH), {
    side: (p) => {
      if (inHole(p)) {
        const edge = p.Y < HOLE.y0 + 2 || p.Y > HOLE.y1 - 2 || p.Z < HOLE.z0 + 2 || p.Z > HOLE.z1 - 2;
        const barY = Math.abs(p.Y - MID) < 1, barZ = Math.abs(p.Z - 83) < 1;
        if (!edge && !barY && !barZ) return 'clear';
        if ((barZ && p.Z > 83.5) || (barY && p.Y > MID + 0.5)) return lit(C.frame, 0.2);
        return C.frame;
      }
      if (ring(p, 3)) {
        if (!ring(p, 2.5)) return dk(C.frame, 0.4);
        return p.Z > HOLE.z1 || p.Y > HOLE.y1 ? lit(C.frame, 0.18) : dk(C.frame, 0.12);
      }
      return wallSurface(p, p.Y, C.wallL, p.Y);
    },
    top: C.wallTop,
    front: (p) => (p.Z > RH - E ? C.wallTop : C.wallEnd),
  });
  face([-T, -T, RH], [T, 0, 0], [0, T, 0], () => C.wallTop); // corner post top
  // window reveals: the wall's thickness, seen through the opening
  face([-T, HOLE.y0, HOLE.z1], [T, 0, 0], [0, 0, -(HOLE.z1 - HOLE.z0)], (p) => ramp([dk(C.wall, 0.35), dk(C.wall, 0.15)], (p.X + T) / T, p.px, p.py));
  face([-T, HOLE.y0, HOLE.z0], [T, 0, 0], [0, HOLE.y1 - HOLE.y0, 0], () => mix(C.frame, C.wall, 0.4));
  box(B(0, 5, HOLE.y0 - 4, HOLE.y1 + 4, 50, 54), shaded(C.frame)); // sill
  // tiny cactus on the sill
  box(B(1, 4, HOLE.y1 - 11, HOLE.y1 - 8, 54, 57), shaded(C.pot));
  box(B(2, 3, HOLE.y1 - 10, HOLE.y1 - 9, 57, 61.5), shaded(C.leaf[2], { top: C.accent }));
  box(B(1.5, 2, HOLE.y1 - 10, HOLE.y1 - 9, 59, 60), shaded(C.leaf[2]));
  box(B(3, 3.5, HOLE.y1 - 10, HOLE.y1 - 9, 58, 59), shaded(C.leaf[2]));
  // curtains + rod
  const curtain = (y0, y1) =>
    box(B(0, 2, y0, y1, 50, 118), {
      top: dk(C.curtain, 0.2),
      front: dk(C.curtain, 0.3),
      side: (p) => {
        const f = (p.Y * 2) % 6;
        let c = f < 2 ? lit(C.curtain, 0.12) : f < 4 ? C.curtain : dk(C.curtain, 0.18);
        if (p.Z < 52) c = dk(c, 0.2);
        if (p.Z > 116) c = dk(c, 0.25);
        return c;
      },
    });
  curtain(HOLE.y0 - 10, HOLE.y0 + 2);
  curtain(HOLE.y1 - 2, HOLE.y1 + 10);
  box(B(1, 3, HOLE.y0 - 12, HOLE.y1 + 12, 118, 119.5), shaded(C.metal));
  box(B(1, 3, HOLE.y1 + 10.5, HOLE.y1 + 13, 117.5, 120.5), shaded(C.accent));
  // floor slab: planks, rug, cable and shadows are all painted on its top
  box(B(0, RW, 0, RD, -SLAB, 0), {
    top: floorTop,
    front: (p) => (p.Z > -E ? C.floorEdge : p.Z > -2 ? dk(C.desk, 0.35) : Math.abs(p.Z + 5) < E ? dk(C.desk, 0.75) : dk(C.desk, 0.55)),
    side: (p) => (p.Z > -E ? dk(C.floorEdge, 0.2) : p.Z > -2 ? dk(C.desk, 0.5) : Math.abs(p.Z + 5) < E ? dk(C.desk, 0.85) : dk(C.desk, 0.7)),
  });
});

/* ====================== FURNITURE ====================== */
const contact = [B(58, 82, 3, 11), B(34, 80, 24, 32), B(88, 96, 25, 32), B(120, 134, 25, 38), B(128, 148, 2, 24), B(16, 26, 23, 31), B(22, 26, 34, 38), B(102, 113, 27, 38), B(84, 100, 20, 36)];
group('furniture', () => {
  box(B(14, 18, 2, 42, 0, 36), { ...shaded(C.desk), front: (p, b) => (b.x1 - p.X < E ? lit(C.desk, 0.14) : p.Z > 34 ? dk(C.desk, 0.3) : C.desk) });
  box(B(112, 150, 2, 42, 0, 36), {
    ...shaded(C.desk),
    front: (p, b) => {
      if (b.x1 - p.X < E) return lit(C.desk, 0.14);
      if (p.Z > 34.5) return dk(C.desk, 0.35);
      if (p.Z < 1.5) return dk(C.desk, 0.45);
      const dz = (p.Z - 1.5) % 11;
      if (dz < E) return dk(C.desk, 0.45);
      if (dz > 11 - E) return lit(C.desk, 0.18);
      if (p.X < 113.5 || p.X > 148.5) return dk(C.desk, 0.1);
      const mid = dz - 5.5;
      if (p.X > 127 && p.X < 135 && Math.abs(mid) < 0.75) return mid > 0.25 ? lit(C.accent, 0.35) : C.accent;
      if (p.X > 127 && p.X < 135 && mid < -0.75 && mid > -1.25) return dk(C.desk, 0.3);
      return C.desk;
    },
  });
  const deskTop = lit(C.desk, 0.12);
  box(B(14, 150, 0, 44, 36, 40), {
    top: (p, b) => {
      const { X, Y, px, py } = p;
      if (b.y1 - Y < E || b.x1 - X < E) return lit(C.desk, 0.36);
      let c = deskTop;
      const g = Math.floor(Y * 2);
      if (noise(Math.floor(X / 5), g, 3) < 0.12) c = dk(c, 0.08);
      if (noise(Math.floor(X / 9), g, 4) < 0.05) c = lit(c, 0.05);
      if (X > 22 && X < 112 && Y > 12) {
        let k = rampN([0.24, 0.15, 0.08, 0], (Y - 12) / 32, px, py);
        if (X < 30 || X > 104) k /= 2;
        c = mix(c, C.accent2, k);
      }
      for (const r of contact) if (X > r.x0 - 1 && X < r.x1 + 1.5 && Y > r.y0 - 0.5 && Y < r.y1 + 1.5 && dith(0.7, px, py)) return dk(c, 0.28);
      return c;
    },
    front: (p, b) => (b.x1 - p.X < E ? lit(C.desk, 0.14) : p.Z > 40 - E ? lit(C.desk, 0.25) : p.Z < 36 + E ? dk(C.desk, 0.3) : C.desk),
    side: (p) => (p.Z > 40 - E ? dk(C.desk, 0.12) : dk(C.desk, 0.32)),
  });
  // floor plant
  box(B(8, 20, 70, 82, 0, 10), { ...shaded(C.pot), front: (p, b) => (b.x1 - p.X < E ? lit(C.pot, 0.15) : p.Z < 1 ? dk(C.pot, 0.25) : C.pot) });
  box(B(7.5, 20.5, 69.5, 82.5, 10, 12), {
    ...shaded(lit(C.pot, 0.08)),
    top: (p, b) => (p.X > 9 && p.X < 19 && p.Y > 71 && p.Y < 81 ? (noise(p.px, p.py, 2) < 0.3 ? dk(C.desk, 0.65) : dk(C.desk, 0.55)) : b.y1 - p.Y < E || b.x1 - p.X < E ? lit(C.pot, 0.4) : lit(C.pot, 0.2)),
  });
  box(B(13.5, 14.5, 75.5, 76.5, 12, 17), shaded(C.leaf[0]));
  crossedSprite(leaves(14, 76, 16, 11, 7, [8, 13]), 14, 76, 1);
});

/* ====================== DECOR (not clickable) ====================== */
const CLOCK = B(128, 148, 10, 18, 78, 89);
const DISPLAY = { x0: 129.5, x1: 146.5, z0: 80, z1: 87 };
group('decor', () => {
  box(B(128, 148, 2, 24, 40, 78), {
    top: (p, b) => (b.y1 - p.Y < E || b.x1 - p.X < E ? lit(C.case, 0.3) : Math.floor(p.X * 2) % 3 === 0 && p.Y > 5 && p.Y < 21 ? dk(C.case, 0.35) : lit(C.case, 0.1)),
    front: (p, b) => {
      if (b.x1 - p.X < E) return lit(C.case, 0.2);
      if (p.Z > 78 - E) return lit(C.case, 0.15);
      if (p.X > 145.5 && p.X < 146.5 && p.Z > 44 && p.Z < 74) return Math.abs(p.Z - 59) < 8 ? lit(C.accent2, 0.3) : C.accent2;
      if (p.X > 131 && p.X < 133.5 && p.Z > 73 && p.Z < 75.5) return C.accent2;
      if (p.X > 130 && p.X < 144 && p.Z > 43 && p.Z < 71) {
        if (p.Z > 71 - E || p.X < 130 + E) return dk(C.case, 0.4);
        return (p.px + p.py) % 2 ? dk(C.case, 0.35) : lit(C.case, 0.05);
      }
      return C.case;
    },
    side: (p) => {
      if (!(p.Y > 4 && p.Y < 22 && p.Z > 44 && p.Z < 76)) return dk(C.case, 0.3);
      if ((p.Y + p.Z) % 16 < 1) return mix(C.shadow, C.accent2, 0.35);
      for (const [cy, cz] of [[13, 66], [13, 53]]) {
        const dy = p.Y - cy, dz = p.Z - cz, d = Math.hypot(dy, dz);
        if (d < 5.5) {
          if (d >= 4.5) return C.accent2;
          if (d < 1.2) return lit(C.accent2, 0.35);
          return Math.floor(((Math.atan2(dz, dy) + Math.PI + d * 0.35) / (Math.PI / 3)) % 2) === 0 ? mix(C.accent2, C.shadow, 0.45) : mix(C.shadow, C.accent2, 0.2);
        }
      }
      return mix(C.shadow, C.accent2, 0.14);
    },
  });
  box(CLOCK, {
    top: (p, b) => (b.y1 - p.Y < E || b.x1 - p.X < E ? lit(C.surface2, 0.3) : lit(C.surface2, 0.1)),
    front: (p) => {
      if (p.X > DISPLAY.x0 && p.X < DISPLAY.x1 && p.Z > DISPLAY.z0 && p.Z < DISPLAY.z1) return p.Z > DISPLAY.z1 - E ? mix(C.shadow, C.accent, 0.15) : C.shadow;
      return p.Z > 89 - E ? lit(C.surface2, 0.15) : C.surface2;
    },
    side: dk(C.surface2, 0.35),
  });
  // keyboard with keycaps painted on its top
  const keyCol = (r, i) => {
    if ((r === 1 && i >= 1 && i <= 3) || (r === 2 && i === 2)) return C.accent2;
    if (i === 14 && (r === 1 || r === 2)) return C.accent;
    if (r === 0 && i === 0) return C.horizon;
    return mix(C.muted, C.surface, 0.3);
  };
  box(B(34, 80, 24, 32, 40, 42), {
    ...shaded(C.metalDark),
    top: (p, b) => {
      if (b.y1 - p.Y < E || b.x1 - p.X < E) return lit(C.metalDark, 0.3);
      const r = Math.floor((p.Y - 24.5) / 2), dy = p.Y - 24.5 - r * 2;
      if (r < 0 || r > 3 || dy > 1.5) return C.metalDark;
      let x0, w;
      if (r === 3 && p.X > 47 && p.X < 62.5) (x0 = 47), (w = 15.5);
      else {
        const i = Math.floor((p.X - 35) / 3);
        if (i < 0 || i > 14 || (r === 3 && i >= 4 && i <= 9)) return C.metalDark;
        (x0 = 35 + i * 3), (w = 2.5);
      }
      const dx = p.X - x0;
      if (dx < 0 || dx > w) return C.metalDark;
      const col = r === 3 && w > 3 ? mix(C.muted, C.surface, 0.3) : keyCol(r, Math.floor((p.X - 35) / 3));
      if (dy > 1.5 - E) return dk(col, 0.4); // key's front edge
      if (dx > w - E) return dk(col, 0.25);
      if (dy < E || dx < E) return lit(col, 0.25);
      return col;
    },
  });
  box(B(84, 100, 20, 36, 40, 40.5), {
    top: (p, b) => {
      const e = Math.min(p.X - b.x0, b.x1 - p.X, p.Y - b.y0, b.y1 - p.Y);
      if (e < E) return dk(C.surface2, 0.2);
      if (e < 1 && (p.px + p.py) % 3) return mix(C.accent2, C.surface2, 0.4);
      return mix(C.surface2, C.accent2, 0.1);
    },
    front: dk(C.surface2, 0.3),
    side: dk(C.surface2, 0.4),
  });
  box(B(90, 94, 26, 31, 40.5, 42), shaded(lit(C.muted, 0.1)));
  box(B(90.5, 93.5, 26.5, 30, 42, 42.5), { ...shaded(lit(C.muted, 0.25)), top: (p) => (p.X > 91.5 && p.X < 92.5 && p.Y < 28 ? C.accent2 : lit(C.muted, 0.3)) });
  // coffee mug
  box(B(22, 26, 34, 38, 40, 45), {
    top: (p, b) => (p.X > b.x0 + 0.5 && p.X < b.x1 - 0.5 && p.Y > b.y0 + 0.5 && p.Y < b.y1 - 0.5 ? dk(C.desk, 0.6) : lit(C.text, 0.1)),
    front: (p) => (Math.abs(p.Z - 42.5) < 0.75 ? C.accent : p.Z > 45 - E ? C.text : mix(C.text, C.muted, 0.25)),
    side: (p) => (Math.abs(p.Z - 42.5) < 0.75 ? dk(C.accent, 0.3) : mix(C.muted, C.desk, 0.3)),
  });
  box(B(26, 27, 35.5, 36.5, 41, 44), shaded(mix(C.text, C.muted, 0.3)));
});

/* ====================== CLICKABLE OBJECTS ====================== */
const SCREEN = { x0: 23.5, x1: 110.5, z0: 50.5, z1: 82.5, y: 12 };
group('monitor', () => {
  box(B(58, 82, 3, 11, 40, 41), shaded(C.metal));
  box(B(68, 72, 4, 7.5, 41, 60), shaded(C.metal));
  box(B(22, 112, 8, 12, 48, 84), {
    top: (p, b) => (b.y1 - p.Y < E ? lit(C.metalDark, 0.3) : C.metalDark),
    side: (p) => (p.Z > 84 - E ? dk(C.metalDark, 0.1) : dk(C.metalDark, 0.35)),
    front: (p) => {
      const { X, Z, px, py } = p;
      if (!(X > SCREEN.x0 && X < SCREEN.x1 && Z > SCREEN.z0 && Z < SCREEN.z1)) {
        if (X > 105 && X < 107 && Z > 49 && Z < 50) return C.accent2;
        if (Z > 84 - E || X > 112 - E) return lit(C.metalDark, 0.2);
        return dk(C.metalDark, 0.15);
      }
      const mid = 1 - Math.abs(X - 67) / 44, v = 1 - Math.abs(Z - 66.5) / 16;
      let c = ramp([mix(C.shadow, C.accent2, 0.16), mix(C.shadow, C.accent2, 0.25), mix(C.shadow, C.accent2, 0.34)], mid * 0.7 + v * 0.3, px, py);
      if (py % 2 === 0) c = dk(c, 0.08);
      if (Math.abs(X - Z * 0.6 - 48) < 1.5 || Math.abs(X - Z * 0.6 - 53) < 0.5) c = lit(c, 0.07);
      return c;
    },
  });
});

group('headphones', () => {
  const cup = mix(C.accent2, C.shadow, 0.38);
  box(B(16, 26, 23, 31, 40, 41), shaded(C.metalDark));
  box(B(20.5, 21.5, 26.5, 27.5, 41, 60), shaded(C.metal));
  box(B(19.5, 22.5, 26, 28, 59, 60.5), shaded(C.metal));
  box(B(13, 17, 24, 30, 47, 57), { ...shaded(cup), side: (p) => (Math.hypot(p.Y - 27, p.Z - 52) < 2.2 ? dk(C.shadow, 0.1) : dk(cup, 0.45)) });
  box(B(25, 29, 24, 30, 47, 57), {
    ...shaded(cup),
    side: (p) => {
      const d = Math.hypot(p.Y - 27, p.Z - 52);
      return d > 2 && d < 2.8 ? C.accent2 : d <= 2 ? lit(cup, 0.1) : dk(cup, 0.3);
    },
  });
  // curved band: a see-through panel with the arc painted on it
  const band = lit(C.muted, 0.15);
  face([13, 27, 64.5], [16, 0, 0], [0, 0, -9], (p) => {
    const r = Math.hypot((p.X - 21) / 6.5, (p.Z - 57) / 6);
    if (p.Z < 57 || r < 0.86 || r > 1.06) return null;
    return r > 1.02 ? lit(band, 0.3) : r < 0.9 ? dk(band, 0.25) : band;
  }, { double: true });
});

group('floppy', () => {
  const body = mix(C.accent2, C.shadow, 0.35);
  box(B(102, 113, 27, 38, 40, 41.5), {
    top: (p, b) => {
      const { X, Y } = p;
      if (X > 112 && Y < 28) return null;
      if (X > 104.5 && X < 110.5 && Y < 31) return X > 108 && X < 109.5 && Y > 27.5 && Y < 30 ? C.shadow : Y > 31 - E ? dk(C.muted, 0.2) : lit(C.muted, 0.35);
      if (X > 103.5 && X < 111.5 && Y > 32 && Y < 37.5) {
        if (Y < 33) return C.accent;
        if ((Math.abs(Y - 34.25) < 0.25 || Math.abs(Y - 36) < 0.25) && X > 104.5 && X < 110.5) return C.muted;
        return C.text;
      }
      return b.y1 - Y < E || b.x1 - X < E ? lit(body, 0.3) : body;
    },
    front: dk(body, 0.2),
    side: dk(body, 0.4),
  });
});

group('phone', () => {
  const body = C.accent;
  box(B(120, 134, 25, 38, 40, 43), shaded(body));
  box(B(121, 133, 26, 37, 43, 45), {
    ...shaded(lit(body, 0.05)),
    top: (p, b) => {
      for (const y0 of [31.5, 33.5, 35.5])
        for (const x0 of [123.5, 126, 128.5])
          if (p.X > x0 && p.X < x0 + 1.5 && p.Y > y0 && p.Y < y0 + 1) return p.Y > y0 + 1 - E ? mix(C.text, C.muted, 0.4) : C.text;
      return b.y1 - p.Y < E || b.x1 - p.X < E ? lit(body, 0.35) : lit(body, 0.15);
    },
  });
  box(B(119, 135, 26, 30.5, 45, 47), shaded(dk(body, 0.12)));
  box(B(119, 123, 25.5, 31, 47, 48.5), shaded(dk(body, 0.08)));
  box(B(131, 135, 25.5, 31, 47, 48.5), shaded(dk(body, 0.08)));
});

group('pegboard', () => {
  const board = mix(C.desk, C.text, 0.2);
  const metal = mix(C.muted, C.text, 0.25);
  const base = (p) => {
    const { X, Z } = p;
    if (X < 23.5 || X > 90.5 || Z < 87.5 || Z > 120.5) {
      if (Z > 122 - E || X < 22 + E) return lit(C.wood, 0.2);
      return X > 92 - E || Z < 86 + E ? dk(C.wood, 0.3) : C.wood;
    }
    if (Math.floor(X * 2) % 8 === 0 && Math.floor(Z * 2) % 8 === 0) return dk(C.desk, 0.45);
    if (Math.floor(X * 2) % 8 === 0 && Math.floor(Z * 2) % 8 === 7) return lit(board, 0.1);
    return board;
  };
  const bars = [[73, 12, C.accent2], [76.5, 16, C.accent], [80, 9, C.horizon], [83.5, 13, mix(C.desk, C.text, 0.2)]];
  // tools hung on the board, painted with a little relief (a: X, b: Z)
  const tools = [
    { a0: 29.5, a1: 31, b0: 93, b1: 111, col: metal },
    { a0: 28.5, a1: 32, b0: 111, b1: 116, col: metal },
    { a0: 38.5, a1: 39.5, b0: 95, b1: 105, col: metal },
    { a0: 38, a1: 40, b0: 104.5, b1: 105.5, col: lit(metal, 0.2) },
    { a0: 37.5, a1: 40.5, b0: 105.5, b1: 115, col: C.accent, fill: (p) => (Math.floor(p.Z * 2) % 3 === 0 ? dk(C.accent, 0.2) : null) },
    { a0: 48.5, a1: 50.5, b0: 92, b1: 109, col: mix(C.desk, C.accent, 0.45) },
    { a0: 45, a1: 55, b0: 109, b1: 113.5, col: C.metalDark },
    { a0: 58.5, a1: 66.5, b0: 103, b1: 111, col: C.accent2, fill: (p) => (p.X > 61.5 && p.X < 63.5 && p.Z > 106 && p.Z < 108 ? dk(C.desk, 0.45) : null) },
    {
      a0: 71, a1: 88.5, b0: 92, b1: 117, col: C.text,
      fill: (p) => {
        const { X, Z } = p;
        if (X < 71.5 || X > 88 || Z < 92.5 || Z > 116.5) return C.muted;
        if (Math.abs(Z - 113.75) < 0.25 && X < 83) return dk(C.muted, 0.2);
        if (Math.abs(Z - 94.25) < 0.25 && X > 72 && X < 87) return C.muted;
        for (const [x, h, col] of bars) if (X > x && X < x + 2.5 && Z > 94.5 && Z < 94.5 + h) return X > x + 2 ? dk(col, 0.2) : col;
        if ((Math.abs(X - 72.5) < 0.5 || Math.abs(X - 87) < 0.5) && Z > 115.5) return C.horizon;
        return C.text;
      },
    },
    ...[30.5, 39, 50, 62.5].map((x) => ({ a0: x - 0.5, a1: x + 0.5, b0: x === 30.5 ? 116.5 : x === 39 ? 115.5 : x === 50 ? 114 : 111.5, b1: (x === 30.5 ? 116.5 : x === 39 ? 115.5 : x === 50 ? 114 : 111.5) + 1, col: metal })),
  ];
  box(B(22, 92, 0, 2, 86, 122), { top: lit(board, 0.15), side: dk(board, 0.3), front: decals(tools, base, (p) => p.X, (p) => p.Z) });
});

group('bookshelf', () => {
  for (const x of [106, 146]) {
    box(B(x, x + 2, 0, 1.5, 82, 90), shaded(C.metalDark));
    box(B(x, x + 2, 1.5, 10, 88, 90), shaded(C.metalDark));
  }
  box(B(100, 154, 0, 12, 90, 93), shaded(mix(C.desk, C.text, 0.18)));
  const books = [[4, 20, C.accent2], [3, 17, C.text], [5, 22, C.horizon], [4, 18, mix(C.desk, C.text, 0.32)], [3, 15, C.accent], [4, 21, C.muted], [5, 19, mix(C.accent2, C.shadow, 0.3)], [3, 16, lit(C.horizon, 0.2)]];
  let x = 102;
  for (const [w, h, col] of books) {
    const top = 93 + h;
    box(B(x, x + w, 2, 10, 93, top), {
      top: (p, b) => (b.y1 - p.Y < E ? lit(col, 0.3) : p.Y > 3 && p.Y < 9 && p.X > b.x0 + 0.5 && p.X < b.x1 - 0.5 ? mix(C.text, C.muted, 0.3) : lit(col, 0.15)),
      side: dk(col, 0.35),
      front: (p, b) => {
        if (b.x1 - p.X < E) return lit(col, 0.15);
        if (Math.abs(p.Z - (top - 2.5)) < 0.5 || Math.abs(p.Z - 96) < 0.5) return dk(col, 0.35);
        if (w >= 4 && Math.abs(p.X - (b.x0 + w / 2)) < 0.5 && p.Z > 98 && p.Z < top - 4 && Math.floor(p.Z * 2) % 3) return lit(col, 0.35);
        return col;
      },
    });
    x += w;
  }
  box(B(135, 143, 3, 7, 93, 97), {
    top: (p) => (p.X > 138 && p.X < 140 ? C.accent : lit(C.text, 0.05)),
    front: (p) => (p.X > 138 && p.X < 140 ? C.accent : p.X < 135.5 ? dk(C.text, 0.2) : mix(C.text, C.muted, 0.15)),
    side: dk(C.text, 0.25),
  });
  box(B(145, 152, 3, 10, 93, 99), shaded(C.pot));
  crossedSprite(leaves(148.5, 6.5, 99, 6, 21, [3, 6], 0.5), 148.5, 6.5, 0.5);
});

group('notes', () => {
  const cork = mix(C.desk, C.accent, 0.3);
  const base = (p) => {
    const { Y, Z, px, py } = p;
    if (Y < 9.5 || Y > 34.5 || Z < 67.5 || Z > 100.5) return Z > 100.5 || Y > 34.5 ? lit(C.wood, 0.12) : dk(C.wood, 0.15);
    const n = noise(px, py, 8);
    return n < 0.16 ? dk(cork, 0.25) : n > 0.92 ? lit(cork, 0.15) : cork;
  };
  // on this wall, "across" runs towards smaller Y, so a = -Y keeps highlights/shadows the right way round
  const note = (y0, z0, col, seed) => ({
    a0: -(y0 + 8), a1: -y0, b0: z0, b1: z0 + 8, col,
    fill: (p) => {
      if (y0 + 8 - p.Y + (p.Z - z0) < 1.5) return dk(col, 0.3);
      const line = [z0 + 5.5, z0 + 3.5, z0 + 1.75].find((z) => Math.abs(p.Z - z) < 0.25);
      if (line && p.Y > y0 + 1 && p.Y < y0 + 6.5 && noise(p.px, line * 3, seed) < 0.75) return dk(col, 0.5);
      return null;
    },
  });
  const pin = (y, z, col) => ({ a0: -(y + 1), a1: -y, b0: z, b1: z + 1, col });
  const stickers = [
    note(11, 88, C.accent, 1),
    note(22, 90, C.accent2, 2),
    note(12, 70, C.text, 3),
    {
      a0: -33, a1: -23, b0: 69, b1: 83, col: C.text,
      fill: (p) => {
        const { Y, Z } = p;
        if (!(Y > 24 && Y < 32 && Z > 72.5 && Z < 82)) return null;
        if ((Math.abs(Y - 26.75) < 0.75 && Z > 74 && Z < 76.5) || (Math.abs(Y - 29.25) < 0.75 && Z > 74 && Z < 77)) return C.shadow;
        if ((Math.abs(Y - 26.75) < 0.5 && Z > 76.5 && Z < 77.5) || (Math.abs(Y - 29.25) < 0.5 && Z > 77 && Z < 78)) return C.shadow;
        return Z > 79 ? C.sky : Z > 75.5 ? C.horizon : dk(C.horizon, 0.5);
      },
    },
    pin(15, 95, C.horizon), pin(26, 97, C.accent), pin(16, 77, C.accent2), pin(28, 82, C.horizon),
  ];
  box(B(0, 2, 8, 36, 66, 102), { top: lit(C.wood, 0.2), front: dk(C.wood, 0.3), side: decals(stickers, base, (p) => -p.Y, (p) => p.Z) });
});

// Floor lamp: base, pole and a cone-shaped shade. The shade is drawn twice (on / off).
group('lamp', () => {
  box(B(22, 32, 112, 122, 0, 1.5), shaded(C.metalDark));
  box(B(26.5, 27.5, 116.5, 117.5, 1.5, 68), shaded(C.metal));
  for (const state of ['on', 'off']) {
    const on = state === 'on';
    const sh = on
      ? { lo: mix(C.text, C.accent, 0.2), hi: mix(C.accent, C.text, 0.42), top: dk(C.accent, 0.25), rim: C.text }
      : { lo: mix(C.muted, C.desk, 0.4), hi: mix(C.muted, C.desk, 0.25), top: dk(C.desk, 0.2), rim: dk(C.muted, 0.35) };
    const paint = (dark) => (p) => {
      const c = p.t > 1 - 1 / 22 ? sh.rim : ramp([sh.lo, sh.hi], 1 - p.t, p.px, p.py);
      return dark ? dk(c, 0.2) : c;
    };
    const b = 7, tp = 2.5, cx = 27, cy = 117, z0 = 68, z1 = 78;
    trapezoid([cx - b, cy + b, z0], [cx + b, cy + b, z0], [cx - tp, cy + tp, z1], [cx + tp, cy + tp, z1], paint(false), { state }); // +Y side
    trapezoid([cx + b, cy + b, z0], [cx + b, cy - b, z0], [cx + tp, cy + tp, z1], [cx + tp, cy - tp, z1], paint(true), { state }); // +X side
    face([cx - tp, cy - tp, z1], [tp * 2, 0, 0], [0, tp * 2, 0], () => sh.top, { state });
  }
});

/* ====================== LAMP LIGHT (shown when the lamp is on) ====================== */
const LAMP = { x: 27, y: 117 };
group('glow', () => {
  face([0, 80, 0.12], [72, 0, 0], [0, 50, 0], (p) => {
    const k = rampN([0, 0.1, 0.18, 0.28], 1 - Math.hypot(p.X - LAMP.x, (p.Y - LAMP.y) * 1.1) / 34, p.px, p.py);
    return k ? alpha(C.warm, k) : null;
  });
  face([0.12, RD, RH - 4], [0, -60, 0], [0, 0, -(RH - 4)], (p) => {
    if (inHole(p)) return null;
    const k = rampN([0, 0.06, 0.12, 0.2], 1 - Math.hypot(p.Y - LAMP.y, (p.Z - 76) / 1.7) / 34, p.px, p.py);
    return k ? alpha(C.warm, k) : null;
  });
  const halo = new PixelCanvas(96, 96);
  halo.fillPoly([[0, 0], [96, 0], [96, 96], [0, 96]], (sx, sy, px, py) => {
    const k = rampN([0, 0.06, 0.12, 0.2], 1 - Math.hypot(sx - 48, sy - 48) / 46, px, py);
    return k ? alpha(C.warm, k) : null;
  });
  face([LAMP.x, LAMP.y, 74], [48, 0, 0], [0, 0, -48], null, { canvas: halo, billboard: true });
});

/* ====================== SKY + SKYLINE (outside, behind the window) ====================== */
// Just behind the wall's outer face and almost as big as the wall: the wall always hides it from outside,
// and every view through the window, even at a steep angle, still lands on sky.
const SKY = { x: -T - 0.5, y0: 2, y1: RD - 4, z0: -4, z1: RH - 2, horizonZ: 66 };
{
  const w = (SKY.y1 - SKY.y0) * TX, h = (SKY.z1 - SKY.z0) * TX, HORIZON = (SKY.z1 - SKY.horizonZ) * TX;
  const city = new PixelCanvas(w, h), lights = new PixelCanvas(w, h);
  const r = rng(11);
  const far = mix(C.shadow, C.sky, 0.42), near = mix(C.shadow, C.sky, 0.18), near2 = mix(C.shadow, C.sky, 0.1);
  const skyline = (minW, maxW, minH, maxH, colA, colB, withLights) => {
    let x = -2;
    while (x < w) {
      const bw = minW + Math.floor(r() * (maxW - minW));
      const top = HORIZON - minH - Math.floor(r() * (maxH - minH));
      const col = r() < 0.5 ? colA : colB;
      city.rect(x, top, bw, h - top, col);
      city.rect(x, top, bw, 1, mix(col, C.sky, 0.25));
      if (r() < 0.35) city.rect(x + Math.floor(bw / 2), top - 5 - Math.floor(r() * 6), 1, 6 + Math.floor(r() * 6), col);
      if (r() < 0.25) city.rect(x + 1, top - 3, 4, 3, col);
      if (withLights) for (let wy = top + 3; wy < h - 2; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 2) if (r() < 0.3) lights.set(wx, wy, r() < 0.55 ? alpha(C.accent, 0.9) : r() < 0.8 ? alpha(C.text, 0.85) : alpha(C.accent2, 0.9));
      x += bw;
    }
  };
  skyline(8, 16, 4, 22, far, mix(far, C.sky, 0.15), false);
  skyline(6, 14, -6, 30, near, near2, true);
  city.rect(0, HORIZON + 24, w, h, near2);
  city.save(`${OUT}/skyline.png`);
  lights.save(`${OUT}/skyline-lights.png`);
}

/* ====================== PACK THE ATLAS + WRITE THE SCENE FILE ====================== */
const allFaces = Object.values(groups).flatMap((g) => g.faces);
const AW = 1024, PAD = 1;
{
  let x = 0, y = 0, rowH = 0;
  for (const f of [...allFaces].sort((a, b) => b.cv.h - a.cv.h || b.cv.w - a.cv.w)) {
    const w = f.cv.w + PAD * 2, h = f.cv.h + PAD * 2;
    if (x + w > AW) (x = 0), (y += rowH), (rowH = 0);
    f.ax = x + PAD;
    f.ay = y + PAD;
    x += w;
    rowH = Math.max(rowH, h);
  }
  var AH = Math.ceil((y + rowH) / 8) * 8; // eslint-disable-line no-var
}
const atlas = new PixelCanvas(AW, AH);
for (const f of allFaces) {
  // copy the texture, repeating its edge texels into the padding so edges never bleed
  for (let j = -PAD; j < f.cv.h + PAD; j++)
    for (let i = -PAD; i < f.cv.w + PAD; i++) {
      const si = Math.min(f.cv.w - 1, Math.max(0, i)), sj = Math.min(f.cv.h - 1, Math.max(0, j));
      const k = (sj * f.cv.w + si) * 4, d = ((f.ay + j) * AW + f.ax + i) * 4;
      for (let c = 0; c < 4; c++) atlas.data[d + c] = f.cv.data[k + c];
    }
}
atlas.save(`${OUT}/atlas.png`);

const url = (publicPath) => `${publicPath}?v=${crypto.createHash('md5').update(fs.readFileSync(`public${publicPath}`)).digest('hex').slice(0, 8)}`;
const r4 = (n) => Math.round(n * 10000) / 10000;
const PX = S / TX; // CSS px per texel
/** CSS for one face: size, atlas offset and a matrix3d that puts it in place. */
function faceCss(f) {
  const out = { w: r4(len(f.u) * S), h: r4(len(f.v) * S), bx: -f.ax * PX, by: -f.ay * PX };
  if (f.billboard) {
    out.c = mul(f.o, S).map(r4);
  } else {
    const U = unit(f.u), V = unit(f.v), N = cross(U, V);
    const o = mul(f.o, S);
    out.m = `matrix3d(${[...U, 0, ...V, 0, ...N, 0, ...o, 1].map(r4).join(',')})`;
  }
  if (f.clip) out.clip = f.clip;
  if (f.double) out.double = 1;
  if (f.state) out.state = f.state;
  return out;
}
/** CSS placement for an HTML panel (screen text, clock, sky) given its corner and edges in room units. */
const panel = (o, u, v) => ({ ...faceCss({ o, u, v, ax: 0, ay: 0 }), bx: undefined, by: undefined });

const LABEL_FACES_X = new Set(['notes', 'lamp']); // objects on/against the left (window) wall: their signs run along it
const scene = {
  unit: S,
  atlas: url('/room3d/atlas.png'),
  atlasSize: [AW * PX, AH * PX],
  room: { w: RW, d: RD, h: RH, slab: SLAB },
  groups: Object.fromEntries(
    Object.entries(groups).map(([name, g]) => {
      const xs = g.pts.map((p) => p[0]), ys = g.pts.map((p) => p[1]), zs = g.pts.map((p) => p[2]);
      const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2].map(r4);
      // Hover label: a small sign just in front of the object's main face, parallel to it, sitting on top.
      // Objects on the left wall face +X; everything else faces +Y (towards the open front of the room).
      const facing = LABEL_FACES_X.has(name) ? 'x' : 'y';
      const label = {
        facing,
        at: (facing === 'x' ? [Math.max(...xs) + 0.6, center[1], Math.max(...zs) + 0.8] : [center[0], Math.max(...ys) + 0.6, Math.max(...zs) + 0.8]).map(r4),
      };
      return [name, { center, label, faces: g.faces.map(faceCss) }];
    }),
  ),
  // HTML panels placed just in front of a face
  screen: panel([SCREEN.x0, SCREEN.y + 0.15, SCREEN.z1], [SCREEN.x1 - SCREEN.x0, 0, 0], [0, 0, -(SCREEN.z1 - SCREEN.z0)]),
  clock: panel([DISPLAY.x0, CLOCK.y1 + 0.15, DISPLAY.z1], [DISPLAY.x1 - DISPLAY.x0, 0, 0], [0, 0, -(DISPLAY.z1 - DISPLAY.z0)]),
  sky: {
    ...panel([SKY.x, SKY.y1, SKY.z1], [0, -(SKY.y1 - SKY.y0), 0], [0, 0, -(SKY.z1 - SKY.z0)]),
    horizon: r4((SKY.z1 - SKY.horizonZ) / (SKY.z1 - SKY.z0)),
    skyline: url('/room3d/skyline.png'),
    lights: url('/room3d/skyline-lights.png'),
  },
  // light from the window on the floor (coloured by CSS for each time of day)
  floorLight: {
    ...panel([4, HOLE.y0 + 2, 0.08], [42, 0, 0], [0, HOLE.y1 - HOLE.y0 + 14, 0]),
    clip: `polygon(0 0, 0 ${r4((HOLE.y1 - HOLE.y0 - 2) / (HOLE.y1 - HOLE.y0 + 14)) * 100}%, 100% 100%, 100% ${r4(16 / (HOLE.y1 - HOLE.y0 + 14)) * 100}%)`,
  },
};
fs.mkdirSync('src/scene', { recursive: true });
fs.writeFileSync(
  'src/scene/scene3d.js',
  `// AUTO-GENERATED by scripts/build-room3d.mjs. Run \`npm run art\` to rebuild; don't edit by hand.\n` +
    `// Sizes are CSS px; ${S}px = 1 room unit. Faces are placed with matrix3d inside the camera.\n` +
    `export const SCENE3D = ${JSON.stringify(scene)};\n`,
);
console.log(`3D room: ${allFaces.length} faces, atlas ${AW}x${AH}, groups: ${Object.keys(groups).join(', ')}`);
