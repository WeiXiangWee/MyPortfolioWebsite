// Draws the placeholder isometric pixel room ("The Workbench") as PNG layers.
// Run: npm run art
//
// Output
//   public/room/walls.png      walls, floor, window frame (glass left transparent for the CSS sky)
//   public/room/furniture.png  desk, floor plant, floor lamp
//   public/room/decor.png      desk items that are not clickable (tower, clock, keyboard, mouse)
//   public/room/obj-*.png      one cropped transparent PNG per clickable object
//   public/room/skyline*.png   city silhouette and lit windows seen through the window
//   src/scene/sceneLayout.js   positions, hit polygons and zoom centres (generated, do not edit)
//
// Swap in your own Piskel/Figma art later: keep the same file names and canvas size (400 x 320),
// then update the polygons in sceneLayout.js if your shapes change.
import fs from 'node:fs';
import { PixelCanvas, makeIso, mix, alpha, hull, rng } from './pixel.mjs';

const W = 400, H = 320;
const OX = 185, OY = 152; // screen position of the back floor corner
const RW = 160, RD = 130, RH = 130; // room size: width (X), depth (Y), wall height (Z)
const T = 6, SLAB = 8; // wall thickness, floor slab thickness
const iso = makeIso(OX, OY);
const { P, box, corners } = iso;
const OUT = 'public/room';

/* Palette: the brief's tokens + shades mixed from them (no outside colours except dusky plant greens). */
const C = {
  bg: '#1E1626', surface: '#2C2135', surface2: '#3A2C46', text: '#F6E7D6', muted: '#B9A6B8',
  accent: '#FF9F43', accent2: '#9D8CFF', shadow: '#0E0A12',
  wall: '#2A1F33', sky: '#4B2F5C', horizon: '#B4476A', sun: '#FF9F43', desk: '#4A3242', floor: '#1E1626',
};
Object.assign(C, {
  wallR: mix(C.wall, C.horizon, 0.1),
  wallR2: mix(mix(C.wall, C.horizon, 0.1), C.shadow, 0.08),
  wallL: C.wall,
  wallL2: mix(C.wall, C.shadow, 0.1),
  wallTop: mix(C.wall, C.text, 0.22),
  wallEnd: mix(C.wall, C.shadow, 0.45),
  base: mix(C.desk, C.shadow, 0.35),
  baseTop: mix(C.desk, C.text, 0.12),
  frame: mix(C.wall, C.text, 0.3),
  reveal: mix(C.wall, C.shadow, 0.25),
  plankA: mix(C.desk, C.floor, 0.42),
  plankB: mix(C.desk, C.floor, 0.3),
  seam: C.floor,
  floorEdge: mix(C.desk, C.text, 0.22),
  slabFront: mix(C.desk, C.shadow, 0.55),
  slabSide: mix(C.desk, C.shadow, 0.72),
  rug: mix(C.sky, C.wall, 0.3),
  rugBorder: mix(C.horizon, C.wall, 0.45),
  rugDot: mix(C.accent2, C.wall, 0.5),
  metal: mix(C.surface2, C.muted, 0.25),
  metalDark: mix(C.surface, C.shadow, 0.3),
  case: mix(C.surface, C.shadow, 0.15),
  leaf1: '#3F5A4C', leaf2: '#587A61', leaf3: '#7A9A78',
  pot: mix(C.horizon, C.desk, 0.45),
});

/** Default shading for a solid box: lit top with highlighted front edges, darker side. */
function shaded(base, o = {}) {
  const top = o.top ?? mix(base, C.text, 0.14);
  const hi = o.hi ?? mix(base, C.text, 0.32);
  const side = o.side ?? mix(base, C.shadow, 0.32);
  return {
    top: (p, b) => (b.y1 - p.Y < 1 || b.x1 - p.X < 1 ? hi : top),
    front: (p, b) => (b.x1 - p.X < 1 ? mix(base, C.text, 0.1) : base),
    side,
  };
}
const B = (x0, x1, y0, y1, z0, z1) => ({ x0, x1, y0, y1, z0, z1 });

/* ====================== 1. WALLS + FLOOR ====================== */
const walls = new PixelCanvas(W, H);
const HOLE = { y0: 44, y1: 100, z0: 54, z1: 112 }; // window opening in the left wall (plane X = 0)
const inHole = (p) => p.Y > HOLE.y0 && p.Y < HOLE.y1 && p.Z > HOLE.z0 && p.Z < HOLE.z1;
const nearHole = (p, m) => p.Y > HOLE.y0 - m && p.Y < HOLE.y1 + m && p.Z > HOLE.z0 - m && p.Z < HOLE.z1 + m;

function wallSurface(u, p, a, b) {
  if (p.Z < 0) return C.wallEnd;
  if (p.Z < 4) return C.base;
  if (p.Z < 5) return C.baseTop;
  if (p.Z > RH - 1) return C.wallTop;
  if (p.Z > RH - 4) return mix(a, C.text, 0.06);
  return Math.floor(u / 8) % 2 ? a : b;
}
// right wall (inner face is the box's front face at Y = 0)
box(walls, B(0, RW, -T, 0, -SLAB, RH), {
  front: (p) => wallSurface(p.X, p, C.wallR, C.wallR2),
  top: C.wallTop,
  side: C.wallEnd,
});
// left wall (inner face is the box's side face at X = 0) with the window hole
box(walls, B(-T, 0, 0, RD, -SLAB, RH), {
  side: (p) => (inHole(p) ? 'clear' : nearHole(p, 3) ? C.frame : wallSurface(p.Y, p, C.wallL, C.wallL2)),
  top: C.wallTop,
  front: C.wallEnd,
});
walls.fillPoly([P(-T, -T, RH), P(0, -T, RH), P(0, 0, RH), P(-T, 0, RH)], C.wallTop); // corner post
// window reveals (wall thickness seen through the hole)
walls.fillPoly([P(-T, HOLE.y0, HOLE.z1), P(0, HOLE.y0, HOLE.z1), P(0, HOLE.y0, HOLE.z0), P(-T, HOLE.y0, HOLE.z0)], C.reveal);
walls.fillPoly([P(-T, HOLE.y0, HOLE.z0), P(0, HOLE.y0, HOLE.z0), P(0, HOLE.y1, HOLE.z0), P(-T, HOLE.y1, HOLE.z0)], mix(C.reveal, C.text, 0.1));
// window frame and cross bars, drawn on the wall plane
const holePoly = [P(0, HOLE.y0, HOLE.z1), P(0, HOLE.y1, HOLE.z1), P(0, HOLE.y1, HOLE.z0), P(0, HOLE.y0, HOLE.z0)];
walls.fillPoly(holePoly, (sx, sy) => {
  const p = iso.onFaceX(sx, sy, 0);
  const edge = p.Y < HOLE.y0 + 2 || p.Y > HOLE.y1 - 2 || p.Z < HOLE.z0 + 2 || p.Z > HOLE.z1 - 2;
  const bar = Math.abs(p.Y - 72) < 1 || Math.abs(p.Z - 83) < 1;
  return edge || bar ? C.frame : null;
});
box(walls, B(0, 4, 40, 104, 50, 54), shaded(C.frame)); // sill

// floor
const lampGlow = (col, p) => {
  const d = Math.hypot(p.X - 27, p.Y - 117);
  return d < 13 ? mix(col, C.accent, 0.2) : d < 22 ? mix(col, C.accent, 0.1) : col;
};
box(walls, B(0, RW, 0, RD, -SLAB, 0), {
  top: (p) => {
    if (p.Y > RD - 1 || p.X > RW - 1) return C.floorEdge;
    const row = Math.floor(p.Y / 10);
    if (p.Y % 10 < 1 || (p.X + row * 37) % 56 < 1) return C.seam;
    return lampGlow(row % 2 ? C.plankA : C.plankB, p);
  },
  front: (p) => (p.Z > -1 ? C.floorEdge : C.slabFront),
  side: (p) => (p.Z > -1 ? mix(C.floorEdge, C.shadow, 0.2) : C.slabSide),
});
// rug
const RUG = B(46, 124, 58, 112, 0, 0);
walls.fillPoly([P(RUG.x0, RUG.y0, 0), P(RUG.x1, RUG.y0, 0), P(RUG.x1, RUG.y1, 0), P(RUG.x0, RUG.y1, 0)], (sx, sy) => {
  const p = iso.onTop(sx, sy, 0);
  const e = Math.min(p.X - RUG.x0, RUG.x1 - p.X, p.Y - RUG.y0, RUG.y1 - p.Y);
  if (e < 1) return C.rugBorder;
  if (e < 3) return mix(C.rugBorder, C.text, 0.12);
  if (e < 4) return C.rugBorder;
  const u = ((p.X % 10) + 10) % 10 - 5, v = ((p.Y % 10) + 10) % 10 - 5;
  return lampGlow(Math.abs(u) + Math.abs(v) < 2 ? C.rugDot : C.rug, p);
});
walls.save(`${OUT}/walls.png`);

/* ====================== 2. FURNITURE ====================== */
const furn = new PixelCanvas(W, H);
const deskCol = C.desk;
box(furn, B(14, 18, 2, 42, 0, 36), shaded(deskCol)); // left leg panel
box(furn, B(112, 150, 2, 42, 0, 36), {
  ...shaded(deskCol),
  front: (p, b) => {
    if (b.x1 - p.X < 1) return mix(deskCol, C.text, 0.1);
    if (Math.abs(p.Z - 12) < 0.5 || Math.abs(p.Z - 24) < 0.5) return mix(deskCol, C.shadow, 0.45);
    const handle = p.X > 127 && p.X < 135 && [6, 18, 30].some((z) => Math.abs(p.Z - z) < 0.5);
    return handle ? C.accent : deskCol;
  },
});
const DESK = B(14, 150, 0, 44, 36, 40);
const deskTop = mix(deskCol, C.text, 0.12);
box(furn, DESK, {
  top: (p, b) => {
    if (b.y1 - p.Y < 1 || b.x1 - p.X < 1) return mix(deskCol, C.text, 0.32);
    let col = Math.floor(p.Y / 3) % 4 === 0 && Math.floor(p.X / 9) % 3 === 0 ? mix(deskTop, C.shadow, 0.06) : deskTop;
    if (p.X > 22 && p.X < 112 && p.Y > 12) {
      // lavender glow from the monitor, in hard pixel bands
      const t = (p.Y - 12) / 32;
      let k = t < 0.33 ? 0.22 : t < 0.66 ? 0.14 : 0.07;
      if (p.X < 30 || p.X > 104) k /= 2;
      col = mix(col, C.accent2, k);
    }
    return col;
  },
  front: (p, b) => (b.x1 - p.X < 1 ? mix(deskCol, C.text, 0.1) : p.Z > 39 ? mix(deskCol, C.text, 0.18) : deskCol),
  side: mix(deskCol, C.shadow, 0.3),
});
// floor plant under the window
box(furn, B(8, 20, 70, 82, 0, 12), { ...shaded(C.pot), top: mix(C.shadow, C.desk, 0.3) });
{
  const r = rng(7);
  const leaves = [];
  for (let i = 0; i < 18; i++) {
    const s = 3 + Math.floor(r() * 3);
    const x = 6 + Math.floor(r() * 12), y = 68 + Math.floor(r() * 12), z = 12 + Math.floor((i / 18) * 30);
    leaves.push(B(x, x + s, y, y + s, z, z + 2 + Math.floor(r() * 3)));
  }
  leaves.sort((a, b) => a.z0 - b.z0 || a.x0 + a.y0 - (b.x0 + b.y0));
  leaves.forEach((l, i) => box(furn, l, shaded([C.leaf1, C.leaf2, C.leaf3][i % 3])));
}
// floor lamp (switched on)
box(furn, B(22, 32, 112, 122, 0, 2), shaded(C.metalDark));
box(furn, B(26, 28, 116, 118, 2, 70), shaded(C.metal));
box(furn, B(20, 34, 110, 124, 70, 80), {
  top: mix(C.accent, C.shadow, 0.35),
  front: (p) => (p.Z < 71 ? C.text : mix(C.accent, C.text, 0.55)),
  side: (p) => (p.Z < 71 ? mix(C.text, C.accent, 0.3) : mix(C.accent, C.text, 0.25)),
});
furn.save(`${OUT}/furniture.png`);

/* ====================== 3. DECOR (desk items you can't click) ====================== */
const decor = new PixelCanvas(W, H);
const TOWER = B(128, 148, 2, 24, 40, 78);
box(decor, TOWER, {
  top: (p) => (Math.floor(p.X) % 3 === 0 && p.Y > 5 && p.Y < 21 ? C.metalDark : mix(C.case, C.text, 0.1)),
  front: (p, b) => {
    if (b.x1 - p.X < 1) return mix(C.case, C.text, 0.12);
    if (p.X > 144 && p.X < 146 && p.Z > 44 && p.Z < 72) return C.accent2;
    if (p.X > 131 && p.X < 134 && p.Z > 73 && p.Z < 76) return C.accent2;
    if (p.Z > 46 && p.Z < 66 && p.X > 131 && p.X < 141 && Math.floor(p.Z) % 2 === 0) return C.metalDark;
    return C.case;
  },
  side: (p) => {
    const glass = p.Y > 4 && p.Y < 22 && p.Z > 44 && p.Z < 76;
    if (!glass) return mix(C.case, C.shadow, 0.3);
    for (const [cy, cz] of [[13, 66], [13, 53]]) {
      const d = Math.max(Math.abs(p.Y - cy), Math.abs(p.Z - cz));
      if (d >= 4 && d < 5) return C.accent2;
      if (d < 1.5) return mix(C.accent2, C.text, 0.3);
    }
    return mix(C.shadow, C.accent2, 0.22);
  },
});
const CLOCK = B(128, 148, 10, 18, 78, 89);
const DISPLAY = { x0: 129, x1: 147, z0: 80, z1: 87 };
box(decor, CLOCK, {
  top: mix(C.surface2, C.text, 0.12),
  front: (p) => (p.X > DISPLAY.x0 && p.X < DISPLAY.x1 && p.Z > DISPLAY.z0 && p.Z < DISPLAY.z1 ? C.shadow : C.surface2),
  side: mix(C.surface2, C.shadow, 0.35),
});
box(decor, B(34, 80, 24, 32, 40, 42), {
  top: (p, b) => {
    if (b.y1 - p.Y < 1 || b.x1 - p.X < 1 || p.X - b.x0 < 1 || p.Y - b.y0 < 1) return mix(C.case, C.text, 0.2);
    const key = Math.floor(p.X) % 3 !== 0 && Math.floor(p.Y) % 2 === 1;
    if (!key) return C.metalDark;
    if (p.X > 72 && p.Y > 26 && p.Y < 30) return C.accent; // enter key
    if (p.X < 44 && p.Y < 28) return C.accent2;
    return mix(C.muted, C.surface, 0.25);
  },
  front: C.case,
  side: mix(C.case, C.shadow, 0.3),
});
box(decor, B(84, 100, 20, 36, 40, 41), {
  top: (p, b) => (b.y1 - p.Y < 1 || b.x1 - p.X < 1 ? mix(C.accent2, C.shadow, 0.4) : mix(C.surface2, C.accent2, 0.12)),
  front: C.surface,
  side: C.surface,
});
box(decor, B(90, 94, 26, 31, 41, 43), shaded(mix(C.muted, C.surface, 0.2)));
decor.save(`${OUT}/decor.png`);

/* ====================== 4. CLICKABLE OBJECTS ====================== */
const objects = {};
function object(name, depth, draw, pad = 1) {
  const cv = new PixelCanvas(W, H);
  const pts = [];
  const add = (b, style) => {
    box(cv, b, style);
    pts.push(...corners(b));
  };
  draw(add, cv);
  const bb = cv.bounds();
  const crop = { x: bb.x - 2, y: bb.y - 2, w: bb.w + 4, h: bb.h + 4 };
  cv.crop(crop).save(`${OUT}/obj-${name}.png`);
  const poly = hull(pts, pad);
  const cx = Math.round(poly.reduce((s, p) => s + p[0], 0) / poly.length);
  const cy = Math.round(poly.reduce((s, p) => s + p[1], 0) / poly.length);
  objects[name] = {
    src: `/room/obj-${name}.png`,
    depth,
    ...crop,
    polygon: poly.map(([x, y]) => [x - crop.x, y - crop.y]),
    center: [cx, cy],
  };
}

// Ultrawide monitor -> Projects
const SCREEN = { x0: 24, x1: 110, z0: 51, z1: 82, y: 12 };
object('monitor', 'items', (add) => {
  add(B(60, 80, 3, 11, 40, 42), shaded(C.metal));
  add(B(68, 72, 4, 8, 42, 60), shaded(C.metal));
  add(B(22, 112, 8, 12, 48, 84), {
    top: C.metalDark,
    side: mix(C.metalDark, C.shadow, 0.3),
    front: (p) => {
      const inScreen = p.X > SCREEN.x0 && p.X < SCREEN.x1 && p.Z > SCREEN.z0 && p.Z < SCREEN.z1;
      if (!inScreen) return p.X > 105 && p.X < 108 && p.Z < 50.5 ? C.accent2 : mix(C.shadow, C.surface, 0.35);
      const mid = 1 - Math.abs(p.X - 67) / 43;
      const base = mix(C.shadow, C.accent2, mid > 0.66 ? 0.24 : mid > 0.33 ? 0.2 : 0.16);
      return Math.floor(p.Z) % 2 ? base : mix(base, C.shadow, 0.12);
    },
  });
});

// Headphones on a stand -> About
object('headphones', 'items', (add) => {
  const cup = mix(C.accent2, C.shadow, 0.35);
  add(B(16, 26, 23, 31, 40, 42), shaded(C.metalDark));
  add(B(20, 22, 26, 28, 42, 60), shaded(C.metal));
  const cupStyle = {
    ...shaded(cup),
    side: (p) => (Math.abs(p.Z - 54) < 3 && Math.abs(p.Y - 27) < 2 ? C.accent2 : mix(cup, C.shadow, 0.3)),
  };
  add(B(13, 17, 24, 30, 49, 59), cupStyle);
  add(B(25, 29, 24, 30, 49, 59), cupStyle);
  add(B(14, 28, 25, 29, 59, 62), shaded(mix(C.muted, C.text, 0.3)));
});

// Floppy disk -> Download CV
object('floppy', 'items', (add) => {
  const body = mix(C.accent2, C.shadow, 0.35);
  add(B(102, 113, 27, 38, 40, 42), {
    top: (p, b) => {
      if (p.X > 105 && p.X < 110 && p.Y < 31) return p.X > 107 && p.X < 109 && p.Y > 28 && p.Y < 30 ? C.shadow : mix(C.muted, C.text, 0.3);
      if (p.X > 104 && p.X < 111 && p.Y > 32 && p.Y < 37) return Math.abs(p.Y - 34.5) < 0.5 ? C.muted : C.text;
      if (b.y1 - p.Y < 1 || b.x1 - p.X < 1) return mix(body, C.text, 0.25);
      return body;
    },
    front: mix(body, C.shadow, 0.2),
    side: mix(body, C.shadow, 0.4),
  });
}, 3);

// Retro phone -> Contact
object('phone', 'items', (add) => {
  const body = C.accent;
  add(B(120, 134, 25, 38, 40, 45), {
    top: (p, b) => {
      if (b.y1 - p.Y < 1 || b.x1 - p.X < 1) return mix(body, C.text, 0.35);
      if (p.Y > 32 && p.Y < 37 && p.X > 123 && p.X < 132 && Math.floor(p.X) % 3 === 0 && Math.floor(p.Y) % 2 === 0) return C.text;
      return mix(body, C.text, 0.12);
    },
    front: body,
    side: mix(body, C.shadow, 0.3),
  });
  add(B(119, 135, 26, 31, 45, 48), shaded(mix(body, C.shadow, 0.18)));
}, 2);

// Pegboard with tools -> Skills
object('pegboard', 'wall', (add) => {
  const board = mix(C.desk, C.text, 0.2);
  add(B(22, 92, 0, 2, 86, 122), {
    top: board,
    side: mix(board, C.shadow, 0.3),
    front: (p) => {
      if (p.X < 23 || p.X > 91 || p.Z < 87 || p.Z > 121) return mix(C.desk, C.shadow, 0.15);
      if (Math.floor(p.X) % 4 === 0 && Math.floor(p.Z) % 4 === 0) return mix(C.desk, C.shadow, 0.4);
      return board;
    },
  });
  const metal = mix(C.muted, C.text, 0.2);
  add(B(30, 32, 2, 4, 92, 112), shaded(metal)); // wrench
  add(B(29, 34, 2, 4, 112, 117), shaded(metal));
  add(B(39, 40, 2, 4, 94, 106), shaded(metal)); // screwdriver
  add(B(38, 41, 2, 4, 106, 116), shaded(C.accent));
  add(B(49, 51, 2, 4, 92, 110), shaded(mix(C.desk, C.accent, 0.45))); // hammer
  add(B(45, 55, 2, 4, 110, 114), shaded(C.metalDark));
  add(B(59, 66, 2, 4, 104, 111), {
    ...shaded(C.accent2),
    front: (p) => (p.X > 61 && p.X < 64 && p.Z > 106 && p.Z < 109 ? mix(C.desk, C.shadow, 0.4) : C.accent2),
  });
  // a little skills chart card
  add(B(71, 88, 2, 3, 92, 117), {
    top: C.text,
    side: C.muted,
    front: (p) => {
      if (p.X < 72 || p.X > 87 || p.Z < 93 || p.Z > 116) return C.muted;
      if (Math.abs(p.Z - 113.5) < 0.5 && p.X < 83) return C.muted;
      const bars = [[73, 12, C.accent2], [77, 16, C.accent], [81, 9, C.horizon], [85, 13, mix(C.desk, C.text, 0.2)]];
      for (const [x, h, col] of bars) if (p.X > x && p.X < x + 2 && p.Z > 95 && p.Z < 95 + h) return col;
      return C.text;
    },
  });
});

// Wall shelf with books -> Certifications
object('bookshelf', 'wall', (add) => {
  add(B(106, 108, 0, 9, 84, 90), shaded(C.metalDark));
  add(B(146, 148, 0, 9, 84, 90), shaded(C.metalDark));
  add(B(100, 154, 0, 12, 90, 94), shaded(mix(C.desk, C.text, 0.15)));
  const books = [[4, 20, C.accent2], [3, 17, C.text], [5, 22, C.horizon], [4, 18, mix(C.desk, C.text, 0.3)], [3, 15, C.accent], [4, 21, C.muted], [5, 19, mix(C.accent2, C.shadow, 0.35)], [3, 16, C.text]];
  let x = 102;
  for (const [w, h, col] of books) {
    const b = B(x, x + w, 2, 10, 94, 94 + h);
    add(b, {
      top: mix(col, C.text, 0.2),
      side: mix(col, C.shadow, 0.35),
      front: (p) => (Math.abs(p.Z - (94 + h - 3)) < 0.5 || Math.abs(p.Z - 97) < 0.5 ? mix(col, C.shadow, 0.3) : col),
    });
    x += w;
  }
  add(B(135, 143, 3, 7, 94, 98), { // rolled certificate
    ...shaded(C.text),
    front: (p) => (p.X > 138 && p.X < 140 ? C.accent : C.text),
    top: (p) => (p.X > 138 && p.X < 140 ? C.accent : mix(C.text, C.muted, 0.2)),
  });
  add(B(145, 152, 3, 10, 94, 100), shaded(C.pot)); // little plant
  add(B(146, 149, 4, 7, 100, 106), shaded(C.leaf2));
  add(B(148, 151, 6, 9, 100, 109), shaded(C.leaf3));
});

// Corkboard with sticky notes and a photo -> Community work
object('notes', 'wall', (add) => {
  const cork = mix(C.desk, C.accent, 0.28);
  const r = rng(3);
  const speck = new Map();
  add(B(0, 2, 8, 36, 66, 102), {
    top: mix(C.desk, C.text, 0.1),
    front: mix(C.desk, C.shadow, 0.3),
    side: (p) => {
      if (p.Y < 9 || p.Y > 35 || p.Z < 67 || p.Z > 101) return mix(C.desk, C.shadow, 0.1);
      const k = `${Math.floor(p.Y)},${Math.floor(p.Z)}`;
      if (!speck.has(k)) speck.set(k, r() < 0.18);
      return speck.get(k) ? mix(cork, C.shadow, 0.25) : cork;
    },
  });
  const note = (y0, z0, col, lines = true) =>
    add(B(2, 3, y0, y0 + 8, z0, z0 + 8), {
      top: mix(col, C.text, 0.2),
      front: mix(col, C.shadow, 0.3),
      side: (p) => (lines && p.Y > y0 + 1 && p.Y < y0 + 6 && [z0 + 5, z0 + 3].some((z) => Math.abs(p.Z - z) < 0.5) ? mix(col, C.shadow, 0.35) : col),
    });
  note(11, 88, C.accent);
  note(22, 90, C.accent2);
  note(12, 70, C.text);
  add(B(2, 3, 23, 33, 69, 83), { // polaroid photo
    top: C.text,
    front: C.muted,
    side: (p) => {
      if (p.Y > 24 && p.Y < 32 && p.Z > 73 && p.Z < 82) return p.Z > 78 ? C.sky : p.Z > 75 ? C.horizon : C.shadow;
      return C.text;
    },
  });
  for (const [y, z, col] of [[15, 95, C.horizon], [26, 97, C.accent], [16, 77, C.accent2], [28, 82, C.horizon]])
    add(B(3, 4, y, y + 1, z, z + 1), { top: col, front: col, side: col });
});

/* ====================== 5. SKYLINE (behind the window glass) ====================== */
const glass = hull(holePoly, 0);
const gx = Math.min(...glass.map((p) => p[0])), gy = Math.min(...glass.map((p) => p[1]));
const gw = Math.max(...glass.map((p) => p[0])) - gx, gh = Math.max(...glass.map((p) => p[1])) - gy;
const HORIZON = 52;
{
  const city = new PixelCanvas(gw, gh), lights = new PixelCanvas(gw, gh);
  const r = rng(11);
  const dark = mix(C.shadow, C.sky, 0.3), dark2 = mix(C.shadow, C.sky, 0.15);
  let x = 0;
  while (x < gw) {
    const w = 4 + Math.floor(r() * 6), top = HORIZON - 4 - Math.floor(r() * 14);
    const col = r() < 0.5 ? dark : dark2;
    city.rect(x, top, w, gh - top, col);
    for (let wy = top + 2; wy < gh - 2; wy += 3)
      for (let wx = x + 1; wx < x + w - 1; wx += 2)
        if (r() < 0.32) lights.set(wx, wy, r() < 0.6 ? alpha(C.accent, 0.9) : alpha(C.text, 0.8));
    x += w;
  }
  city.rect(0, HORIZON + 6, gw, gh, dark2);
  city.save(`${OUT}/skyline.png`);
  lights.save(`${OUT}/skyline-lights.png`);
}

/* ====================== 6. LAYOUT FILE ====================== */
const rect = (x0, x1, y, z1, z0) => {
  const [x, top] = P(x0, y, z1);
  return { x, y: top, w: x1 - x0, h: z1 - z0 };
};
const layout = {
  width: W,
  height: H,
  layers: { walls: '/room/walls.png', furniture: '/room/furniture.png', decor: '/room/decor.png' },
  objects,
  // HTML overlays on front faces (they need transform: skewY(26.565deg) to sit on the face)
  screen: rect(SCREEN.x0, SCREEN.x1, SCREEN.y, SCREEN.z1, SCREEN.z0),
  clock: rect(DISPLAY.x0, DISPLAY.x1, CLOCK.y1, DISPLAY.z1, DISPLAY.z0),
  sky: {
    x: gx, y: gy, w: gw, h: gh, horizon: HORIZON,
    polygon: holePoly.map(([x, y]) => [x - gx, y - gy]),
    skyline: '/room/skyline.png',
    lights: '/room/skyline-lights.png',
  },
  floorLight: [P(4, 46, 0), P(4, 100, 0), P(46, 116, 0), P(46, 62, 0)],
};
fs.mkdirSync('src/scene', { recursive: true });
fs.writeFileSync(
  'src/scene/sceneLayout.js',
  `// AUTO-GENERATED by scripts/draw-room.mjs. Run \`npm run art\` to rebuild; don't edit by hand.\n` +
    `// All numbers are in room pixels (the room canvas is ${W} x ${H}).\n` +
    `export const SCENE = ${JSON.stringify(layout, null, 2)};\n`,
);
console.log('Room art written to', OUT, '| objects:', Object.keys(objects).join(', '));
