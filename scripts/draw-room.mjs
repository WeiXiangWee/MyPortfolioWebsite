// Draws the placeholder isometric pixel room ("The Workbench") as PNG layers.
// Run: npm run art
//
// Output
//   public/room/walls.png         walls, floor, window, curtains (glass left transparent for the CSS sky)
//   public/room/lamp-glow.png     warm light from the floor lamp (shown only when the lamp is on)
//   public/room/furniture.png     desk and floor plant
//   public/room/decor.png         desk items you can't click (tower, clock, keyboard, mouse, mug)
//   public/room/obj-*.png         one cropped transparent PNG per clickable object (+ obj-lamp-off.png)
//   public/room/skyline*.png      city silhouette and lit windows seen through the window
//   src/scene/sceneLayout.js      positions, hit polygons and zoom centres (generated, do not edit)
//
// Pixel-art techniques used: 2:1 isometric grid, ordered (Bayer) dithering for gradients and light,
// 1px edge highlights, ambient shadows in corners and under furniture, and dark inner outlines.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PixelCanvas, makeIso, mix, alpha, hull, rng, dith, ramp, rampN, noise } from './pixel.mjs';

/** Public URL with a content fingerprint, so browsers never show an old cached picture after a redraw. */
const url = (publicPath) => {
  const hash = crypto.createHash('md5').update(fs.readFileSync(`public${publicPath}`)).digest('hex').slice(0, 8);
  return `${publicPath}?v=${hash}`;
};

const U = 2; // pixels per room unit
const W = 800, H = 640;
const OX = 370, OY = 304; // screen position of the back floor corner
const RW = 160, RD = 130, RH = 130; // room size: width (X), depth (Y), wall height (Z)
const T = 6, SLAB = 8; // wall thickness, floor slab thickness
const E = 1 / U; // one screen pixel, in room units
const iso = makeIso(OX, OY, U);
const { P, box, corners, plane } = iso;
const OUT = 'public/room';

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
  ink: C.shadow,
});

const B = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });
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
/** Draw small cubes (voxels) back to front. list: [{ x, y, z, c, top? }] */
function voxels(draw, list, s = 1) {
  const seen = new Map();
  for (const v of list) {
    const x = Math.floor(v.x / s) * s, y = Math.floor(v.y / s) * s, z = Math.floor(v.z / s) * s;
    seen.set(`${x},${y},${z}`, { ...v, x, y, z });
  }
  [...seen.values()]
    .sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.z - b.z)
    .forEach((v) => draw(B(v.x, v.x + s, v.y, v.y + s, v.z, v.z + s), { top: v.top ?? lit(v.c, 0.2), front: v.c, side: dk(v.c, 0.3) }));
}
/** Leaves fanning out from a stem, as chains of voxels. */
function leaves(cx, cy, cz, count, seed, [l0, l1], s = 1) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.7;
    const L = l0 + r() * (l1 - l0);
    const rise = 0.8 + r() * 0.7;
    for (let d = 0; d <= L; d += s) {
      const t = d / L;
      out.push({
        x: cx + Math.cos(a) * d * 0.75,
        y: cy + Math.sin(a) * d * 0.75,
        z: cz + d * rise - d * d * 0.06,
        c: C.leaf[Math.min(2, Math.floor(t * 3))],
        top: t > 0.4 ? C.leaf[3] : C.leaf[2],
      });
    }
  }
  return out;
}

/* ====================== 1. WALLS + FLOOR ====================== */
const walls = new PixelCanvas(W, H);
const HOLE = { y0: 52, y1: 108, z0: 54, z1: 112 }; // window opening in the left wall (plane X = 0)
const MID = (HOLE.y0 + HOLE.y1) / 2; // the window's vertical cross bar
const inHole = (p) => p.Y > HOLE.y0 && p.Y < HOLE.y1 && p.Z > HOLE.z0 && p.Z < HOLE.z1;
const ring = (p, m) => p.Y > HOLE.y0 - m && p.Y < HOLE.y1 + m && p.Z > HOLE.z0 - m && p.Z < HOLE.z1 + m;

/** Shared wall surface: baseboard, wainscot boards, rail, wallpaper with a dithered shade, crown moulding. */
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
    const stripe = Math.floor(u / 4) % 2 === 0;
    const b2 = stripe ? base : dk(base, 0.05);
    const t = (Z - 40) / (RH - 44); // darker towards the ceiling
    c = ramp([b2, dk(b2, 0.1), dk(b2, 0.2)], t * 1.1, px, py);
  }
  if (cornerDist < 6 && dith((1 - cornerDist / 6) * 0.85, px, py)) c = dk(c, 0.22); // corner shadow
  return c;
}
// right wall: inner face is the box's front face (Y = 0). The monitor throws a lavender halo on it.
box(walls, B(0, RW, -T, 0, -SLAB, RH), {
  front: (p) => {
    let c = wallSurface(p, p.X, C.wallR, p.X);
    if (p.Z > 0) {
      const d = Math.hypot((p.X - 67) / 1.5, p.Z - 66);
      const k = rampN([0, 0.05, 0.1, 0.16], 1 - d / 52, p.px, p.py);
      if (k) c = mix(c, C.accent2, k);
    }
    return c;
  },
  top: C.wallTop,
  side: (p) => (p.Z > RH - E ? C.wallTop : C.wallEnd),
});
// left wall with the window
box(walls, B(-T, 0, 0, RD, -SLAB, RH), {
  side: (p) => {
    if (inHole(p)) return 'clear';
    if (ring(p, 3)) {
      // window casing with a bevel: light top/left, dark bottom/right, dark outer line
      if (!ring(p, 2.5)) return dk(C.frame, 0.4);
      if (p.Z > HOLE.z1 || p.Y > HOLE.y1) return lit(C.frame, 0.18);
      return dk(C.frame, 0.12);
    }
    return wallSurface(p, p.Y, C.wallL, p.Y);
  },
  top: C.wallTop,
  front: (p) => (p.Z > RH - E ? C.wallTop : C.wallEnd),
});
walls.fillPoly([P(-T, -T, RH), P(0, -T, RH), P(0, 0, RH), P(-T, 0, RH)], C.wallTop); // corner post
// window reveals (wall thickness seen through the hole)
plane(walls, 'y', HOLE.y0, [[-T, HOLE.y0, HOLE.z1], [0, HOLE.y0, HOLE.z1], [0, HOLE.y0, HOLE.z0], [-T, HOLE.y0, HOLE.z0]], (p) =>
  ramp([dk(C.wall, 0.15), dk(C.wall, 0.35)], (p.X + T) / T, p.px, p.py),
);
plane(walls, 'top', HOLE.z0, [[-T, HOLE.y0, HOLE.z0], [0, HOLE.y0, HOLE.z0], [0, HOLE.y1, HOLE.z0], [-T, HOLE.y1, HOLE.z0]], () => mix(C.frame, C.wall, 0.4));
// frame + cross bars on the wall plane
plane(walls, 'x', 0, [[0, HOLE.y0, HOLE.z1], [0, HOLE.y1, HOLE.z1], [0, HOLE.y1, HOLE.z0], [0, HOLE.y0, HOLE.z0]], (p) => {
  const edge = p.Y < HOLE.y0 + 2 || p.Y > HOLE.y1 - 2 || p.Z < HOLE.z0 + 2 || p.Z > HOLE.z1 - 2;
  const barY = Math.abs(p.Y - MID) < 1, barZ = Math.abs(p.Z - 83) < 1;
  if (!edge && !barY && !barZ) return null;
  if (barZ && p.Z > 83.5) return lit(C.frame, 0.2);
  if (barY && p.Y > MID + 0.5) return lit(C.frame, 0.2);
  return C.frame;
});
box(walls, B(0, 5, HOLE.y0 - 4, HOLE.y1 + 4, 50, 54), shaded(C.frame)); // sill
// tiny cactus on the sill
box(walls, B(1, 4, HOLE.y1 - 11, HOLE.y1 - 8, 54, 57), shaded(C.pot));
voxels((b, s) => box(walls, b, s), [
  ...[57, 57.5, 58, 58.5, 59, 59.5, 60, 60.5, 61].map((z) => ({ x: 2, y: HOLE.y1 - 10, z, c: C.leaf[2] })),
  { x: 1.5, y: HOLE.y1 - 10, z: 59, c: C.leaf[2] }, { x: 1.5, y: HOLE.y1 - 10, z: 59.5, c: C.leaf[2] },
  { x: 3, y: HOLE.y1 - 10, z: 58, c: C.leaf[2] }, { x: 3, y: HOLE.y1 - 10, z: 58.5, c: C.leaf[2] },
  { x: 2, y: HOLE.y1 - 10, z: 61.5, c: C.accent },
], 0.5);
// curtains + rod
function curtain(y0, y1) {
  box(walls, B(0, 2, y0, y1, 50, 118), {
    top: dk(C.curtain, 0.2),
    front: dk(C.curtain, 0.3),
    side: (p) => {
      const f = (p.Y * 2) % 6; // soft folds
      let c = f < 2 ? lit(C.curtain, 0.12) : f < 4 ? C.curtain : dk(C.curtain, 0.18);
      if (p.Z < 52) c = dk(c, 0.2); // hem
      if (p.Z > 116) c = dk(c, 0.25); // gathered under the rod
      return c;
    },
  });
}
curtain(HOLE.y0 - 10, HOLE.y0 + 2);
curtain(HOLE.y1 - 2, HOLE.y1 + 10);
box(walls, B(1, 3, HOLE.y0 - 12, HOLE.y1 + 12, 118, 119.5), shaded(C.metal));
box(walls, B(1, 3, HOLE.y1 + 10.5, HOLE.y1 + 13, 117.5, 120.5), shaded(C.accent)); // finial
// floor
const pots = [[14, 76, 8], [27, 117, 6]]; // contact shadows: plant pot, lamp base
box(walls, B(0, RW, 0, RD, -SLAB, 0), {
  top: (p) => {
    const { X, Y, px, py } = p;
    if (Y > RD - E || X > RW - E) return C.floorEdge;
    const row = Math.floor(Y / 8);
    const off = (row * 23) % 40;
    const seg = Math.floor((X + off) / 40);
    const along = (X + off) % 40;
    if (Y % 8 < E || along < E) return C.seam;
    let c = [C.plankA, C.plankB, C.plankC][Math.floor(noise(row, seg, 5) * 3)];
    if (Y % 8 > 8 - E) c = lit(c, 0.1); // plank edge catch light
    const inPlank = Y % 8;
    if ((Math.abs(inPlank - 3) < E || Math.abs(inPlank - 5.5) < E) && noise(Math.floor(X / 3), row * 2 + (inPlank > 4 ? 1 : 0), 9) < 0.45) c = dk(c, 0.1); // grain
    if (along > 1 && along < 1.5 && (Math.abs(inPlank - 2) < E || Math.abs(inPlank - 6) < E)) c = dk(c, 0.35); // nails
    // ambient shadow along the walls
    const wd = Math.min(X, Y);
    if (wd < 7 && dith((1 - wd / 7) * 0.9, px, py)) c = dk(c, 0.25);
    // shadow under the desk (soft front edge)
    if (X > 12 && X < 153 && Y < 48) {
      const edge = Math.min(48 - Y, X - 12, 153 - X) / 4;
      if (dith(Math.min(1, edge), px, py)) c = dk(c, 0.38);
    }
    for (const [cx, cy, r] of pots) {
      const d = Math.hypot(X - cx, Y - cy);
      if (d < r && dith(Math.min(1, (r - d) / 3), px, py)) c = dk(c, 0.3);
    }
    return c;
  },
  front: (p) => (p.Z > -E ? C.floorEdge : p.Z > -2 ? dk(C.desk, 0.35) : Math.abs(p.Z + 5) < E ? dk(C.desk, 0.75) : dk(C.desk, 0.55)),
  side: (p) => (p.Z > -E ? dk(C.floorEdge, 0.2) : p.Z > -2 ? dk(C.desk, 0.5) : Math.abs(p.Z + 5) < E ? dk(C.desk, 0.85) : dk(C.desk, 0.7)),
});
// rug with border bands, diamond pattern and fringe
const RUG = B(46, 124, 58, 112, 0, 0);
plane(walls, 'top', 0, [[RUG.x0, RUG.y0, 0], [RUG.x1, RUG.y0, 0], [RUG.x1, RUG.y1, 0], [RUG.x0, RUG.y1, 0]], (p) => {
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
});
for (const x of [RUG.x0 - 2, RUG.x1]) // fringe on the short ends
  plane(walls, 'top', 0, [[x, RUG.y0 + 1, 0], [x + 2, RUG.y0 + 1, 0], [x + 2, RUG.y1 - 1, 0], [x, RUG.y1 - 1, 0]], (p) => (Math.floor(p.Y * 2) % 3 === 0 ? null : lit(C.rugBand, 0.15)));
walls.save(`${OUT}/walls.png`);

/* ====================== 2. LAMP LIGHT (separate layer, toggled by the lamp) ====================== */
const glow = new PixelCanvas(W, H);
const LAMP = { x: 27, y: 117 };
plane(glow, 'top', 0, [[0, 0, 0], [RW, 0, 0], [RW, RD, 0], [0, RD, 0]], (p) => {
  const d = Math.hypot(p.X - LAMP.x, (p.Y - LAMP.y) * 1.1);
  const k = rampN([0, 0.1, 0.18, 0.28], 1 - d / 34, p.px, p.py);
  return k ? alpha(C.warm, k) : null;
});
plane(glow, 'x', 0, [[0, 70, 0], [0, RD, 0], [0, RD, RH], [0, 70, RH]], (p) => {
  if (inHole(p)) return null;
  const d = Math.hypot(p.Y - LAMP.y, (p.Z - 76) / 1.7);
  const k = rampN([0, 0.06, 0.12, 0.2], 1 - d / 34, p.px, p.py);
  return k ? alpha(C.warm, k) : null;
});
{
  const [hx, hy] = P(LAMP.x, LAMP.y, 74);
  glow.fillPoly([[hx - 60, hy - 60], [hx + 60, hy - 60], [hx + 60, hy + 60], [hx - 60, hy + 60]], (sx, sy, px, py) => {
    const k = rampN([0, 0.06, 0.12, 0.2], 1 - Math.hypot(sx - hx, (sy - hy) * 1.2) / 56, px, py);
    return k ? alpha(C.warm, k) : null;
  });
}
glow.save(`${OUT}/lamp-glow.png`);

/* ====================== 3. FURNITURE ====================== */
const furn = new PixelCanvas(W, H);
const fbox = (b, s) => box(furn, b, s);
box(furn, B(14, 18, 2, 42, 0, 36), {
  ...shaded(C.desk),
  front: (p, b) => (b.x1 - p.X < E ? lit(C.desk, 0.14) : p.Z > 34 ? dk(C.desk, 0.3) : C.desk),
}); // left leg panel
// drawer cabinet: three drawers with bevels and orange handles
box(furn, B(112, 150, 2, 42, 0, 36), {
  ...shaded(C.desk),
  front: (p, b) => {
    if (b.x1 - p.X < E) return lit(C.desk, 0.14);
    if (p.Z > 34.5) return dk(C.desk, 0.35); // shadow under the desk top
    if (p.Z < 1.5) return dk(C.desk, 0.45); // kick plate
    const dz = (p.Z - 1.5) % 11;
    if (dz < E) return dk(C.desk, 0.45);
    if (dz > 11 - E) return lit(C.desk, 0.18);
    if (p.X < 113.5 || p.X > 148.5) return dk(C.desk, 0.1);
    const mid = dz - 5.5;
    if (p.X > 127 && p.X < 135 && Math.abs(mid) < 0.75) return mid > 0.25 ? lit(C.accent, 0.35) : C.accent;
    if (p.X > 127 && p.X < 135 && mid < -0.75 && mid > -1.25) return dk(C.desk, 0.3); // handle shadow
    return C.desk;
  },
});
// desk top: grain, monitor glow, contact shadows
const contact = [B(60, 80, 3, 11), B(34, 80, 24, 32), B(88, 96, 25, 32), B(120, 134, 25, 38), B(128, 148, 2, 24), B(16, 26, 23, 31), B(22, 26, 34, 38), B(102, 113, 27, 38), B(84, 100, 20, 36)];
const deskTop = lit(C.desk, 0.12);
box(furn, B(14, 150, 0, 44, 36, 40), {
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
    for (const r of contact)
      if (X > r.x0 - 1 && X < r.x1 + 1.5 && Y > r.y0 - 0.5 && Y < r.y1 + 1.5 && dith(0.7, px, py)) {
        c = dk(c, 0.28);
        break;
      }
    return c;
  },
  front: (p, b) => (b.x1 - p.X < E ? lit(C.desk, 0.14) : p.Z > 40 - E ? lit(C.desk, 0.25) : p.Z < 36 + E ? dk(C.desk, 0.3) : C.desk),
  side: (p) => (p.Z > 40 - E ? dk(C.desk, 0.12) : dk(C.desk, 0.32)),
});
// floor plant: pot with rim, soil, leafy voxels
fbox(B(8, 20, 70, 82, 0, 10), { ...shaded(C.pot), front: (p, b) => (b.x1 - p.X < E ? lit(C.pot, 0.15) : p.Z < 1 ? dk(C.pot, 0.25) : C.pot) });
fbox(B(7.5, 20.5, 69.5, 82.5, 10, 12), shaded(lit(C.pot, 0.08)));
plane(furn, 'top', 11.75, [[9, 71, 11.75], [19, 71, 11.75], [19, 81, 11.75], [9, 81, 11.75]], (p) => (noise(p.px, p.py, 2) < 0.3 ? dk(C.desk, 0.65) : dk(C.desk, 0.55)));
voxels(fbox, [...[12, 13, 14, 15, 16].map((z) => ({ x: 14, y: 76, z, c: C.leaf[0] })), ...leaves(14, 76, 16, 11, 7, [8, 13])], 1);
// lamp cable across the floor to the wall
voxels(fbox, Array.from({ length: 60 }, (_, i) => {
  const t = i / 59;
  return { x: 27 - 26 * t, y: 119 - 8 * t + 5 * Math.sin(Math.PI * t), z: 0, c: dk(C.surface, 0.3) };
}), 0.5);
furn.innerOutline(C.ink, 0.45);
furn.save(`${OUT}/furniture.png`);

/* ====================== 4. DECOR (desk items you can't click) ====================== */
const decor = new PixelCanvas(W, H);
const dbox = (b, s) => box(decor, b, s);
// PC tower: mesh front, RGB strip, glass side with glowing fans
box(decor, B(128, 148, 2, 24, 40, 78), {
  top: (p, b) => (b.y1 - p.Y < E || b.x1 - p.X < E ? lit(C.case, 0.3) : Math.floor(p.X * 2) % 3 === 0 && p.Y > 5 && p.Y < 21 ? dk(C.case, 0.35) : lit(C.case, 0.1)),
  front: (p, b) => {
    if (b.x1 - p.X < E) return lit(C.case, 0.2);
    if (p.Z > 78 - E) return lit(C.case, 0.15);
    if (p.X > 145.5 && p.X < 146.5 && p.Z > 44 && p.Z < 74) return Math.abs(p.Z - 59) < 8 ? lit(C.accent2, 0.3) : C.accent2;
    if (p.X > 131 && p.X < 133.5 && p.Z > 73 && p.Z < 75.5) return C.accent2;
    if (p.X > 130 && p.X < 144 && p.Z > 43 && p.Z < 71) {
      if (p.Z > 71 - E || p.X < 130 + E) return dk(C.case, 0.4);
      return (p.px + p.py) % 2 ? dk(C.case, 0.35) : lit(C.case, 0.05); // mesh
    }
    return C.case;
  },
  side: (p) => {
    const glass = p.Y > 4 && p.Y < 22 && p.Z > 44 && p.Z < 76;
    if (!glass) return dk(C.case, 0.3);
    if ((p.Y + p.Z) % 16 < 1) return mix(C.shadow, C.accent2, 0.35); // glass reflection
    for (const [cy, cz] of [[13, 66], [13, 53]]) {
      const dy = p.Y - cy, dz = p.Z - cz, d = Math.hypot(dy, dz);
      if (d < 5.5) {
        if (d >= 4.5) return C.accent2;
        if (d < 1.2) return lit(C.accent2, 0.35);
        const blade = Math.floor(((Math.atan2(dz, dy) + Math.PI + d * 0.35) / (Math.PI / 3)) % 2) === 0;
        return blade ? mix(C.accent2, C.shadow, 0.45) : mix(C.shadow, C.accent2, 0.2);
      }
    }
    return mix(C.shadow, C.accent2, 0.14);
  },
});
// desk clock sitting on the tower (digits are drawn live in HTML)
const CLOCK = B(128, 148, 10, 18, 78, 89);
const DISPLAY = { x0: 129.5, x1: 146.5, z0: 80, z1: 87 };
box(decor, CLOCK, {
  top: (p, b) => (b.y1 - p.Y < E || b.x1 - p.X < E ? lit(C.surface2, 0.3) : lit(C.surface2, 0.1)),
  front: (p) => {
    const inD = p.X > DISPLAY.x0 && p.X < DISPLAY.x1 && p.Z > DISPLAY.z0 && p.Z < DISPLAY.z1;
    if (inD) return p.Z > DISPLAY.z1 - E ? mix(C.shadow, C.accent, 0.15) : C.shadow;
    return p.Z > 89 - E ? lit(C.surface2, 0.15) : C.surface2;
  },
  side: dk(C.surface2, 0.35),
});
// keyboard: case + individual keycaps
box(decor, B(34, 80, 24, 32, 40, 41.5), shaded(C.metalDark));
for (let r = 0; r < 4; r++) {
  const y0 = 24.5 + r * 2;
  for (let i = 0; i < 15; i++) {
    const x0 = 35 + i * 3;
    if (r === 3 && i >= 4 && i <= 9) {
      if (i === 4) box(decor, B(47, 62.5, y0, y0 + 1.5, 41.5, 42.5), shaded(mix(C.muted, C.surface, 0.3)));
      continue;
    }
    let col = mix(C.muted, C.surface, 0.3);
    if ((r === 1 && i >= 1 && i <= 3) || (r === 2 && i === 2)) col = C.accent2;
    if (i === 14 && (r === 1 || r === 2)) col = C.accent;
    if (r === 0 && i === 0) col = C.horizon;
    box(decor, B(x0, x0 + 2.5, y0, y0 + 1.5, 41.5, 42.5), shaded(col));
  }
}
// mousepad + mouse
box(decor, B(84, 100, 20, 36, 40, 40.5), {
  top: (p, b) => {
    const e = Math.min(p.X - b.x0, b.x1 - p.X, p.Y - b.y0, b.y1 - p.Y);
    if (e < E) return dk(C.surface2, 0.2);
    if (e < 1 && (p.px + p.py) % 3) return mix(C.accent2, C.surface2, 0.4); // stitched edge
    return mix(C.surface2, C.accent2, 0.1);
  },
  front: dk(C.surface2, 0.3),
  side: dk(C.surface2, 0.4),
});
dbox(B(90, 94, 26, 31, 40.5, 42), shaded(lit(C.muted, 0.1)));
dbox(B(90.5, 93.5, 26.5, 30, 42, 42.5), shaded(lit(C.muted, 0.25)));
dbox(B(91.5, 92.5, 27, 28, 42.5, 43), shaded(C.accent2));
// coffee mug with a little steam
box(decor, B(22, 26, 34, 38, 40, 45), {
  top: (p, b) => (p.X > b.x0 + 0.5 && p.X < b.x1 - 0.5 && p.Y > b.y0 + 0.5 && p.Y < b.y1 - 0.5 ? dk(C.desk, 0.6) : lit(C.text, 0.1)),
  front: (p) => (Math.abs(p.Z - 42.5) < 0.75 ? C.accent : p.Z > 45 - E ? C.text : mix(C.text, C.muted, 0.25)),
  side: (p) => (Math.abs(p.Z - 42.5) < 0.75 ? dk(C.accent, 0.3) : mix(C.muted, C.desk, 0.3)),
});
voxels(dbox, [[26, 36, 43.5], [26.5, 36, 43], [26.5, 36, 42], [26.5, 36, 41.5], [26, 36, 41]].map(([x, y, z]) => ({ x, y, z, c: mix(C.text, C.muted, 0.3) })), 0.5);
voxels(dbox, [[23.5, 35.5, 46], [24, 35.5, 47], [23.5, 35.5, 48], [24.5, 36, 49.5]].map(([x, y, z]) => ({ x, y, z, c: alpha(C.text, 0.25), top: alpha(C.text, 0.3) })), 0.5);
decor.innerOutline(C.ink, 0.45);
decor.save(`${OUT}/decor.png`);

/* ====================== 5. CLICKABLE OBJECTS ====================== */
const objects = {};
/** Draw one object on its own canvas, crop it, and record its hit polygon + zoom centre. */
function object(name, depth, draw, { pad = 2, variants } = {}) {
  const render = (variant) => {
    const cv = new PixelCanvas(W, H);
    const pts = [];
    const add = (b, style) => {
      box(cv, b, style);
      pts.push(...corners(b));
    };
    draw(add, cv, variant);
    cv.innerOutline(C.ink, 0.5);
    return { cv, pts };
  };
  const main = render(variants?.[0]);
  const bb = main.cv.bounds();
  const crop = { x: bb.x - 2, y: bb.y - 2, w: bb.w + 4, h: bb.h + 4 };
  main.cv.crop(crop).save(`${OUT}/obj-${name}.png`);
  const extra = {};
  for (const v of variants?.slice(1) ?? []) {
    render(v).cv.crop(crop).save(`${OUT}/obj-${name}-${v}.png`);
    extra[`src${v[0].toUpperCase()}${v.slice(1)}`] = url(`/room/obj-${name}-${v}.png`);
  }
  const poly = hull(main.pts, pad);
  const cx = Math.round(poly.reduce((s, p) => s + p[0], 0) / poly.length);
  const cy = Math.round(poly.reduce((s, p) => s + p[1], 0) / poly.length);
  objects[name] = { src: url(`/room/obj-${name}.png`), ...extra, depth, ...crop, polygon: poly.map(([x, y]) => [x - crop.x, y - crop.y]), center: [cx, cy] };
}

// Ultrawide monitor -> Projects
const SCREEN = { x0: 23.5, x1: 110.5, z0: 50.5, z1: 82.5, y: 12 };
object('monitor', 'items', (add) => {
  add(B(58, 82, 3, 11, 40, 41), shaded(C.metal));
  add(B(68, 72, 4, 7.5, 41, 60), shaded(C.metal));
  add(B(22, 112, 8, 12, 48, 84), {
    top: (p, b) => (b.y1 - p.Y < E ? lit(C.metalDark, 0.3) : C.metalDark),
    side: (p) => (p.Z > 84 - E ? dk(C.metalDark, 0.1) : dk(C.metalDark, 0.35)),
    front: (p) => {
      const { X, Z, px, py } = p;
      const inScreen = X > SCREEN.x0 && X < SCREEN.x1 && Z > SCREEN.z0 && Z < SCREEN.z1;
      if (!inScreen) {
        if (X > 105 && X < 107 && Z > 49 && Z < 50) return C.accent2; // power LED
        if (Z > 84 - E || X > 112 - E) return lit(C.metalDark, 0.2);
        return dk(C.metalDark, 0.15);
      }
      // screen: dithered lavender glow, brighter in the middle, scanlines and a soft glare
      const mid = 1 - Math.abs(X - 67) / 44;
      const v = 1 - Math.abs(Z - 66.5) / 16;
      let c = ramp([mix(C.shadow, C.accent2, 0.16), mix(C.shadow, C.accent2, 0.25), mix(C.shadow, C.accent2, 0.34)], mid * 0.7 + v * 0.3, px, py);
      if (py % 2 === 0) c = dk(c, 0.08);
      if (Math.abs(X - Z * 0.6 - 48) < 1.5 || Math.abs(X - Z * 0.6 - 53) < 0.5) c = lit(c, 0.07); // glare
      return c;
    },
  });
});

// Headphones on a stand -> About
object('headphones', 'items', (add) => {
  const cup = mix(C.accent2, C.shadow, 0.38);
  add(B(16, 26, 23, 31, 40, 41), shaded(C.metalDark));
  add(B(20.5, 21.5, 26.5, 27.5, 41, 60), shaded(C.metal));
  add(B(19.5, 22.5, 26, 28, 59, 60.5), shaded(C.metal)); // hook
  add(B(13, 17, 24, 30, 47, 57), {
    ...shaded(cup),
    side: (p) => (Math.hypot(p.Y - 27, p.Z - 52) < 2.2 ? dk(C.shadow, 0.1) : dk(cup, 0.45)), // cushion (inner side)
  });
  add(B(25, 29, 24, 30, 47, 57), {
    ...shaded(cup),
    side: (p) => {
      const d = Math.hypot(p.Y - 27, p.Z - 52);
      if (d > 2 && d < 2.8) return C.accent2; // LED ring
      return d <= 2 ? lit(cup, 0.1) : dk(cup, 0.3);
    },
  });
  // band: an arc of small boxes over the top
  const seen = new Set();
  const arc = [];
  for (let a = 0; a <= Math.PI + 0.001; a += Math.PI / 48) {
    const x = Math.round((21 + 6.5 * Math.cos(a)) * 2) / 2, z = Math.round((57 + 6 * Math.sin(a)) * 2) / 2;
    if (!seen.has(`${x},${z}`)) seen.add(`${x},${z}`) && arc.push([x, z]);
  }
  const band = lit(C.muted, 0.15);
  arc
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .forEach(([x, z]) => add(B(x - 0.5, x + 0.5, 26, 28, z, z + 1), { top: lit(band, 0.2), front: band, side: band }));
});

// Floppy disk -> Download CV
object('floppy', 'items', (add) => {
  const body = mix(C.accent2, C.shadow, 0.35);
  add(B(102, 113, 27, 38, 40, 41.5), {
    top: (p, b) => {
      const { X, Y } = p;
      if (X > 112 && Y < 28) return null; // corner notch
      if (X > 104.5 && X < 110.5 && Y < 31) {
        if (X > 108 && X < 109.5 && Y > 27.5 && Y < 30) return C.shadow;
        return Y > 31 - E ? dk(C.muted, 0.2) : lit(C.muted, 0.35); // metal shutter
      }
      if (X > 103.5 && X < 111.5 && Y > 32 && Y < 37.5) {
        if (Y < 33) return C.accent;
        if ((Math.abs(Y - 34.25) < 0.25 || Math.abs(Y - 36) < 0.25) && X > 104.5 && X < 110.5) return C.muted;
        return C.text; // label
      }
      if (b.y1 - Y < E || b.x1 - X < E) return lit(body, 0.3);
      return body;
    },
    front: dk(body, 0.2),
    side: dk(body, 0.4),
  });
}, { pad: 3 });

// Retro phone -> Contact
object('phone', 'items', (add) => {
  const body = C.accent;
  add(B(120, 134, 25, 38, 40, 43), shaded(body));
  add(B(121, 133, 26, 37, 43, 45), shaded(lit(body, 0.05)));
  for (const y0 of [31.5, 33.5, 35.5]) for (const x0 of [123.5, 126, 128.5]) add(B(x0, x0 + 1.5, y0, y0 + 1, 45, 45.5), shaded(C.text));
  add(B(119, 135, 26, 30.5, 45, 47), shaded(dk(body, 0.12)));
  add(B(119, 123, 25.5, 31, 47, 48.5), shaded(dk(body, 0.08)));
  add(B(131, 135, 25.5, 31, 47, 48.5), shaded(dk(body, 0.08)));
  // coiled cord
  const cord = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    cord.push({ x: 118.5 - 1.5 * t, y: 30 + 8 * t + 0.6 * Math.sin(t * 28), z: 45 - 4.5 * t + 0.6 * Math.cos(t * 28), c: dk(body, 0.25) });
  }
  voxels(add, cord, 0.5);
}, { pad: 2 });

// Pegboard with tools -> Skills
object('pegboard', 'wall', (add) => {
  const board = mix(C.desk, C.text, 0.2);
  add(B(22, 92, 0, 1.5, 86, 122), {
    top: lit(board, 0.15),
    side: dk(board, 0.3),
    front: (p) => {
      const { X, Z } = p;
      if (X < 23.5 || X > 90.5 || Z < 87.5 || Z > 120.5) {
        if (Z > 122 - E || X < 22 + E) return lit(C.wood, 0.2);
        return X > 92 - E || Z < 86 + E ? dk(C.wood, 0.3) : C.wood;
      }
      if (Math.floor(X * 2) % 8 === 0 && Math.floor(Z * 2) % 8 === 0) return dk(C.desk, 0.45);
      if (Math.floor(X * 2) % 8 === 0 && Math.floor(Z * 2) % 8 === 7) return lit(board, 0.1);
      return board;
    },
  });
  const metal = mix(C.muted, C.text, 0.25);
  const peg = (x, z) => add(B(x - 0.5, x + 0.5, 1.5, 3.5, z, z + 1), shaded(metal));
  add(B(29.5, 31, 1.5, 3, 93, 111), shaded(metal)); // wrench
  add(B(28.5, 32, 1.5, 3, 111, 116), shaded(metal));
  peg(30.5, 116.5);
  add(B(38.5, 39.5, 1.5, 3, 95, 105), shaded(metal)); // screwdriver
  add(B(38, 40, 1.5, 3, 104.5, 105.5), shaded(lit(metal, 0.2)));
  add(B(37.5, 40.5, 1.5, 3, 105.5, 115), { ...shaded(C.accent), front: (p, b) => (b.x1 - p.X < E ? lit(C.accent, 0.2) : Math.floor(p.Z * 2) % 3 === 0 ? dk(C.accent, 0.2) : C.accent) });
  peg(39, 115.5);
  add(B(48.5, 50.5, 1.5, 3, 92, 109), shaded(mix(C.desk, C.accent, 0.45))); // hammer
  add(B(45, 55, 1.5, 3, 109, 113.5), shaded(C.metalDark));
  peg(50, 114);
  add(B(58.5, 66.5, 1.5, 3.5, 103, 111), {
    ...shaded(C.accent2),
    front: (p, b) => (p.X > 61.5 && p.X < 63.5 && p.Z > 106 && p.Z < 108 ? dk(C.desk, 0.45) : b.x1 - p.X < E ? lit(C.accent2, 0.2) : C.accent2),
  }); // tape
  peg(62.5, 111.5);
  // skills chart card pinned to the board
  add(B(71, 88.5, 1.5, 2, 92, 117), {
    top: C.text,
    side: C.muted,
    front: (p) => {
      const { X, Z } = p;
      if (X < 71.5 || X > 88 || Z < 92.5 || Z > 116.5) return C.muted;
      if (Math.abs(Z - 113.75) < 0.25 && X < 83) return dk(C.muted, 0.2);
      if (Math.abs(Z - 94.25) < 0.25 && X > 72 && X < 87) return C.muted; // axis
      const bars = [[73, 12, C.accent2], [76.5, 16, C.accent], [80, 9, C.horizon], [83.5, 13, mix(C.desk, C.text, 0.2)]];
      for (const [x, h, col] of bars) if (X > x && X < x + 2.5 && Z > 94.5 && Z < 94.5 + h) return X > x + 2 ? dk(col, 0.2) : col;
      return C.text;
    },
  });
  add(B(72, 73, 2, 2.5, 115.5, 116.5), shaded(C.horizon));
  add(B(86.5, 87.5, 2, 2.5, 115.5, 116.5), shaded(C.horizon));
});

// Wall shelf with books -> Certifications
object('bookshelf', 'wall', (add) => {
  for (const x of [106, 146]) {
    add(B(x, x + 2, 0, 1.5, 82, 90), shaded(C.metalDark));
    add(B(x, x + 2, 0, 10, 88, 90), shaded(C.metalDark));
  }
  add(B(100, 154, 0, 12, 90, 93), shaded(mix(C.desk, C.text, 0.18)));
  const books = [[4, 20, C.accent2], [3, 17, C.text], [5, 22, C.horizon], [4, 18, mix(C.desk, C.text, 0.32)], [3, 15, C.accent], [4, 21, C.muted], [5, 19, mix(C.accent2, C.shadow, 0.3)], [3, 16, lit(C.horizon, 0.2)]];
  let x = 102;
  for (const [w, h, col] of books) {
    const top = 93 + h;
    add(B(x, x + w, 2, 10, 93, top), {
      top: (p, b) => (b.y1 - p.Y < E ? lit(col, 0.3) : p.Y > 3 && p.Y < 9 && p.X > b.x0 + 0.5 && p.X < b.x1 - 0.5 ? mix(C.text, C.muted, 0.3) : lit(col, 0.15)),
      side: dk(col, 0.35),
      front: (p, b) => {
        if (b.x1 - p.X < E) return lit(col, 0.15);
        if (Math.abs(p.Z - (top - 2.5)) < 0.5 || Math.abs(p.Z - 96) < 0.5) return dk(col, 0.35); // spine bands
        if (w >= 4 && Math.abs(p.X - (b.x0 + w / 2)) < 0.5 && p.Z > 98 && p.Z < top - 4 && Math.floor(p.Z * 2) % 3) return lit(col, 0.35); // title
        return col;
      },
    });
    x += w;
  }
  add(B(135, 143, 3, 7, 93, 97), {
    top: (p) => (p.X > 138 && p.X < 140 ? C.accent : lit(C.text, 0.05)),
    front: (p) => (p.X > 138 && p.X < 140 ? C.accent : p.X < 135.5 ? dk(C.text, 0.2) : mix(C.text, C.muted, 0.15)),
    side: dk(C.text, 0.25),
  }); // rolled certificate
  add(B(145, 152, 3, 10, 93, 99), shaded(C.pot));
  voxels(add, leaves(148.5, 6.5, 99, 6, 21, [3, 6], 0.5), 0.5);
});

// Corkboard with sticky notes and a photo -> Community work
object('notes', 'wall', (add) => {
  const cork = mix(C.desk, C.accent, 0.3);
  add(B(0, 2, 8, 36, 66, 102), {
    top: lit(C.wood, 0.2),
    front: dk(C.wood, 0.3),
    side: (p) => {
      const { Y, Z, px, py } = p;
      if (Y < 9.5 || Y > 34.5 || Z < 67.5 || Z > 100.5) return Z > 100.5 || Y > 34.5 ? lit(C.wood, 0.12) : dk(C.wood, 0.15);
      const n = noise(px, py, 8);
      return n < 0.16 ? dk(cork, 0.25) : n > 0.92 ? lit(cork, 0.15) : cork;
    },
  });
  const note = (y0, z0, col, seed) =>
    add(B(2, 2.5, y0, y0 + 8, z0, z0 + 8), {
      top: lit(col, 0.2),
      front: dk(col, 0.3),
      side: (p) => {
        if (y0 + 8 - p.Y + (p.Z - z0) < 1.5) return dk(col, 0.3); // folded corner
        const line = [z0 + 5.5, z0 + 3.5, z0 + 1.75].find((z) => Math.abs(p.Z - z) < 0.25);
        if (line && p.Y > y0 + 1 && p.Y < y0 + 6.5 && noise(p.px, line * 3, seed) < 0.75) return dk(col, 0.5);
        return col;
      },
    });
  note(11, 88, C.accent, 1);
  note(22, 90, C.accent2, 2);
  note(12, 70, C.text, 3);
  add(B(2, 2.5, 23, 33, 69, 83), {
    top: C.text,
    front: C.muted,
    side: (p) => {
      const { Y, Z } = p;
      if (Y > 24 && Y < 32 && Z > 72.5 && Z < 82) {
        if ((Math.abs(Y - 26.75) < 0.75 && Z > 74 && Z < 76.5) || (Math.abs(Y - 29.25) < 0.75 && Z > 74 && Z < 77)) return C.shadow; // two little people
        if ((Math.abs(Y - 26.75) < 0.5 && Z > 76.5 && Z < 77.5) || (Math.abs(Y - 29.25) < 0.5 && Z > 77 && Z < 78)) return C.shadow;
        return Z > 79 ? C.sky : Z > 75.5 ? C.horizon : dk(C.horizon, 0.5);
      }
      return C.text;
    },
  });
  for (const [y, z, col] of [[15, 95, C.horizon], [26, 97, C.accent], [16, 77, C.accent2], [28, 82, C.horizon]]) {
    add(B(2.5, 3.5, y, y + 1, z, z + 1), shaded(col));
  }
});

// Floor lamp -> switches the lamp light on/off (two versions: on and off)
object(
  'lamp',
  'furniture',
  (add, cv, state) => {
    const on = state === 'on';
    add(B(22, 32, 112, 122, 0, 1.5), shaded(C.metalDark));
    add(B(26.5, 27.5, 116.5, 117.5, 1.5, 68), shaded(C.metal));
    const shade = on
      ? { lo: mix(C.text, C.accent, 0.2), hi: mix(C.accent, C.text, 0.42), top: dk(C.accent, 0.25), rim: C.text }
      : { lo: mix(C.muted, C.desk, 0.4), hi: mix(C.muted, C.desk, 0.25), top: dk(C.desk, 0.2), rim: dk(C.muted, 0.35) };
    // a cone-shaped shade built from thin rings that narrow towards the top
    const face = (p) => (p.Z < 68 + E ? shade.rim : ramp([shade.lo, shade.hi], (p.Z - 68) / 10, p.px, p.py));
    for (let i = 0; i < 10; i++) {
      const s = i * 0.5;
      add(B(20 + s, 34 - s, 110 + s, 124 - s, 68 + i, 69 + i), {
        top: (p) => face({ ...p, Z: 69 + i }),
        front: face,
        side: (p) => dk(face(p), 0.22),
      });
    }
    add(B(25, 29, 115, 119, 78, 78.5), { top: shade.top, front: dk(shade.top, 0.2), side: dk(shade.top, 0.35) });
  },
  { variants: ['on', 'off'] },
);

/* ====================== 6. SKYLINE (behind the window glass) ====================== */
const holePoly = [P(0, HOLE.y0, HOLE.z1), P(0, HOLE.y1, HOLE.z1), P(0, HOLE.y1, HOLE.z0), P(0, HOLE.y0, HOLE.z0)];
const gx = Math.min(...holePoly.map((p) => p[0])), gy = Math.min(...holePoly.map((p) => p[1]));
const gw = Math.max(...holePoly.map((p) => p[0])) - gx, gh = Math.max(...holePoly.map((p) => p[1])) - gy;
const HORIZON = 104;
{
  const city = new PixelCanvas(gw, gh), lights = new PixelCanvas(gw, gh);
  const r = rng(11);
  const far = mix(C.shadow, C.sky, 0.42), near = mix(C.shadow, C.sky, 0.18), near2 = mix(C.shadow, C.sky, 0.1);
  const skyline = (minW, maxW, minH, maxH, colA, colB, lit) => {
    let x = -2;
    while (x < gw) {
      const w = minW + Math.floor(r() * (maxW - minW));
      const top = HORIZON - minH - Math.floor(r() * (maxH - minH));
      const col = r() < 0.5 ? colA : colB;
      city.rect(x, top, w, gh - top, col);
      city.rect(x, top, w, 1, mix(col, C.sky, 0.25)); // roof edge
      if (r() < 0.35) city.rect(x + Math.floor(w / 2), top - 5 - Math.floor(r() * 6), 1, 6 + Math.floor(r() * 6), col); // antenna
      if (r() < 0.25) city.rect(x + 1, top - 3, 4, 3, col); // water tank
      if (lit) for (let wy = top + 3; wy < gh - 2; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < 0.3) lights.set(wx, wy, r() < 0.55 ? alpha(C.accent, 0.9) : r() < 0.8 ? alpha(C.text, 0.85) : alpha(C.accent2, 0.9));
      x += w;
    }
  };
  skyline(8, 16, 4, 26, far, mix(far, C.sky, 0.15), false);
  skyline(6, 14, -6, 34, near, near2, true);
  city.rect(0, HORIZON + 18, gw, gh, near2);
  city.save(`${OUT}/skyline.png`);
  lights.save(`${OUT}/skyline-lights.png`);
}

/* ====================== 7. LAYOUT FILE ====================== */
const rect = (x0, x1, y, z1, z0) => {
  const [x, top] = P(x0, y, z1);
  return { x, y: top, w: (x1 - x0) * U, h: (z1 - z0) * U };
};
const layout = {
  width: W,
  height: H,
  layers: { walls: url('/room/walls.png'), furniture: url('/room/furniture.png'), decor: url('/room/decor.png') },
  lampGlow: url('/room/lamp-glow.png'),
  objects,
  // HTML overlays on front faces (they need transform: skewY(26.565deg) to sit on the face)
  screen: rect(SCREEN.x0, SCREEN.x1, SCREEN.y, SCREEN.z1, SCREEN.z0),
  clock: rect(DISPLAY.x0, DISPLAY.x1, CLOCK.y1, DISPLAY.z1, DISPLAY.z0),
  sky: {
    x: gx, y: gy, w: gw, h: gh, horizon: HORIZON,
    polygon: holePoly.map(([x, y]) => [x - gx, y - gy]),
    skyline: url('/room/skyline.png'),
    lights: url('/room/skyline-lights.png'),
  },
  floorLight: [P(4, HOLE.y0 + 2, 0), P(4, HOLE.y1, 0), P(46, HOLE.y1 + 16, 0), P(46, HOLE.y0 + 18, 0)],
};
fs.mkdirSync('src/scene', { recursive: true });
fs.writeFileSync(
  'src/scene/sceneLayout.js',
  `// AUTO-GENERATED by scripts/draw-room.mjs. Run \`npm run art\` to rebuild; don't edit by hand.\n` +
    `// All numbers are in room pixels (the room canvas is ${W} x ${H}).\n` +
    `export const SCENE = ${JSON.stringify(layout, null, 2)};\n`,
);
console.log('Room art written to', OUT, '| objects:', Object.keys(objects).join(', '));
