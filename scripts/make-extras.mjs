// Generates the pixel cursors, the "wx" favicon and the 8-bit sound effects.
// Run: npm run art
import fs from 'node:fs';
import { PixelCanvas } from './pixel.mjs';

const INK = '#0E0A12', CREAM = '#F6E7D6', ORANGE = '#FF9F43', BG = '#1E1626';

/* ---------- cursors (16x16 bitmaps drawn at 2x = 32x32) ---------- */
const arrow = [
  'X...............',
  'XX..............',
  'XOX.............',
  'XOOX............',
  'XOOOX...........',
  'XOOOOX..........',
  'XOOOOOX.........',
  'XOOOOOOX........',
  'XOOOOOOOX.......',
  'XOOOOOOOOX......',
  'XOOOOOXXXXX.....',
  'XOOXOOX.........',
  'XOX.XOOX........',
  'XX..XOOX........',
  '.....XOOX.......',
  '.....XXXX.......',
];
const hand = [
  '.....XX.........',
  '....XOOX........',
  '....XOOX........',
  '....XOOX........',
  '....XOOXXX......',
  '....XOOXOOXX....',
  '.XX.XOOXOOXOXX..',
  'XOOXXOOOOOOOOX..',
  'XOOOXOOOOOOOOX..',
  '.XOOOOOOOOOOOX..',
  '..XOOOOOOOOOOX..',
  '..XOOOOOOOOOX...',
  '...XOOOOOOOOX...',
  '....XOOOOOOX....',
  '....XOOOOOOX....',
  '....XXXXXXXX....',
];
for (const [name, rows] of [['arrow', arrow], ['hand', hand]]) {
  const cv = new PixelCanvas(32, 32);
  cv.bitmap(0, 0, rows, { X: INK, O: CREAM }, 2);
  cv.save(`public/cursor/${name}.png`);
}

/* ---------- favicon: "wx" ---------- */
const fav = [
  'BBBBBBBBBBBBBBBB',
  'BCCCCCCCCCCCCCCB',
  'BCKKKKKKKKKKKKCB',
  'BCKKKKKKKKKKKKCB',
  'BCKKKKKKKKKKKKCB',
  'BCKOKKKOKOKKKOCB',
  'BCKOKKKOKKOKOKCB',
  'BCKOKOKOKKKOKKCB',
  'BCKOKOKOKKOKOKCB',
  'BCKKOKOKKOKKKOCB',
  'BCKKKKKKKKKKKKCB',
  'BCKKKKKKKKKKKKCB',
  'BCKKKKKKKKKKKKCB',
  'BCCCCCCCCCCCCCCB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
];
const icon = new PixelCanvas(32, 32);
icon.bitmap(0, 0, fav, { B: BG, C: CREAM, K: BG, O: ORANGE }, 2);
icon.save('public/favicon.png');

/* ---------- 8-bit sound effects (square waves, 8-bit mono WAV) ---------- */
const RATE = 22050;
function wav(samples) {
  const data = Buffer.from(samples.map((s) => Math.max(0, Math.min(255, Math.round(128 + s * 127)))));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
/** notes: [[startHz, endHz, seconds], ...] played one after another */
function tone(notes, vol = 0.25) {
  const out = [];
  let phase = 0;
  for (const [f0, f1, dur] of notes) {
    const n = Math.floor(dur * RATE);
    for (let i = 0; i < n; i++) {
      const f = f0 + (f1 - f0) * (i / n);
      phase += f / RATE;
      const env = Math.min(1, i / 60, (n - i) / 200); // tiny fade in/out to avoid clicks
      out.push((phase % 1 < 0.5 ? 1 : -1) * vol * env);
    }
  }
  return out;
}
const sfx = {
  hover: tone([[880, 880, 0.03]], 0.12),
  click: tone([[660, 660, 0.03], [990, 990, 0.04]], 0.18),
  open: tone([[523, 523, 0.05], [659, 659, 0.05], [784, 784, 0.05], [1047, 1047, 0.07]], 0.16),
  close: tone([[1047, 1047, 0.05], [784, 784, 0.05], [523, 523, 0.07]], 0.16),
  zoom: tone([[220, 880, 0.28]], 0.12),
};
fs.mkdirSync('public/sfx', { recursive: true });
for (const [name, s] of Object.entries(sfx)) fs.writeFileSync(`public/sfx/${name}.wav`, wav(s));
console.log('Cursors, favicon and sounds written.');
