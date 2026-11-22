/*
  Meteor Shower background (chosen in the Design Board project; ported from star-backgrounds/sky-shower.js).
  A plum sky that glows lilac at the horizon, crisp square stars and plus-shaped sparkles, and every
  5–9 s a "shower" of 2–4 parallel warm comets (cream → orange → rose) that shed golden glitter.

  Colours come from the design tokens in src/styles/tokens.css (read once at start-up), so the sky
  always matches the site's palette. Plain canvas 2D, no libraries.

  Usage:  const sky = meteorShower(canvasElement);   sky.shoot();   sky.stop();
  - resizes itself (ResizeObserver), caps devicePixelRatio at 2
  - pauses while the tab is hidden
  - prefers-reduced-motion: draws a still starry sky, no meteors or twinkling
*/

/** Read a design token (a hex colour) from :root. */
const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
/** Mix two hex colours (t = 0 → a, t = 1 → b). */
const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

function readPalette() {
  const cream = token('--color-text', '#F6E7D6');
  const lilac = token('--color-accent-2', '#9D8CFF');
  const orange = token('--color-accent', '#FF9F43');
  const rose = token('--scene-horizon', '#B4476A');
  const gold = token('--scene-sun-day', '#FFE7B0');
  const peach = token('--scene-sun-dawn', '#FFC38A');
  const lilacLight = mix(lilac, cream, 0.45);
  return {
    cream, lilac, orange, rose, gold,
    sky: [token('--scene-sky-night', '#130E1D'), token('--color-bg', '#1E1626'), token('--color-surface', '#2C2135'), token('--scene-sky', '#4B2F5C')],
    stars: [mix(cream, '#ffffff', 0.4), cream, cream, lilacLight, lilac, peach],
    dust: [lilac, lilacLight, rose, cream],
  };
}

function makeGlow(P, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, rgba(P.cream, 1));
  grad.addColorStop(0.2, rgba(P.gold, 0.8));
  grad.addColorStop(0.5, rgba(P.orange, 0.22));
  grad.addColorStop(1, rgba(P.orange, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function meteorShower(canvas) {
  const ctx = canvas.getContext('2d');
  const P = readPalette();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glow = makeGlow(P);
  let w = 1, h = 1, dpr = 1, backdrop = null, stars = [], meteors = [], sparks = [], queue = [];
  let raf = 0, last = 0, clock = 0, nextShower = 0, running = true;

  function buildBackdrop() {
    // Static layer: gradient, horizon glow and dense dust near the bottom.
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const sky = g.createLinearGradient(0, 0, 0, h);
    [0, 0.45, 0.78, 1].forEach((stop, i) => sky.addColorStop(stop, P.sky[i]));
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h * 1.08);
    g.scale(1, 0.35);
    const hz = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.75);
    hz.addColorStop(0, rgba(P.lilac, 0.45));
    hz.addColorStop(0.5, rgba(P.rose, 0.14));
    hz.addColorStop(1, rgba(P.lilac, 0));
    g.fillStyle = hz;
    g.fillRect(-w, -h * 3, w * 2, h * 6);
    g.restore();
    const dust = Math.round((w * h) / 900);
    for (let i = 0; i < dust; i++) {
      const y = h * (1 - Math.pow(Math.random(), 2.2) * 0.32); // denser towards the bottom
      g.globalAlpha = 0.25 + Math.random() * 0.55;
      g.fillStyle = P.dust[(Math.random() * P.dust.length) | 0];
      g.fillRect(Math.round(Math.random() * w), Math.round(y), 1, 1);
    }
    return c;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop = buildBackdrop();
    stars = Array.from({ length: Math.round((w * h) / 1700) }, () => ({
      x: Math.round(Math.random() * w),
      y: Math.round(Math.random() * h * 0.9),
      kind: Math.random() < 0.8 ? 'dot' : 'cross',
      size: Math.random() < 0.2 ? 2 : 1,
      color: P.stars[(Math.random() * P.stars.length) | 0],
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.8,
    }));
    draw();
  }

  // A shower: 2–4 meteors on the same angle, spaced sideways and in time.
  function scheduleShower(count) {
    const angle = (30 + Math.random() * 10) * (Math.PI / 180);
    const ux = -Math.cos(angle), uy = Math.sin(angle);
    const startX = w * (0.55 + Math.random() * 0.4), startY = h * (-0.05 + Math.random() * 0.15);
    for (let i = 0; i < count; i++) {
      const side = (i - (count - 1) / 2) * (60 + Math.random() * 50); // perpendicular offset
      queue.push({
        at: clock + i * (0.15 + Math.random() * 0.35),
        x: startX - uy * side + (Math.random() - 0.5) * 40,
        y: startY + ux * side + (Math.random() - 0.5) * 40,
        ux,
        uy,
        speed: 520 + Math.random() * 220,
        len: 170 + Math.random() * 110,
        age: 0,
        dur: 1.3 + Math.random() * 0.6,
      });
    }
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(backdrop, 0, 0, w, h);

    for (const s of stars) {
      const tw = reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(clock * s.speed + s.phase);
      ctx.globalAlpha = 0.3 + 0.7 * tw;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size);
      if (s.kind === 'cross') {
        const arm = 2 + Math.round(tw * 2);
        ctx.globalAlpha *= 0.7;
        ctx.fillRect(s.x - arm, s.y, arm * 2 + 1, 1);
        ctx.fillRect(s.x, s.y - arm, 1, arm * 2 + 1);
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    for (const m of meteors) {
      const fade = Math.min(1, m.age * 4, (m.dur - m.age) * 3);
      const tx = m.x - m.ux * m.len, ty = m.y - m.uy * m.len;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, rgba(P.cream, 1));
      grad.addColorStop(0.3, rgba(P.orange, 0.6));
      grad.addColorStop(1, rgba(P.rose, 0));
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.globalAlpha = fade * 0.3;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.drawImage(glow, m.x - 16, m.y - 16, 32, 32);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;

    if (!nextShower) nextShower = clock + 1;
    if (clock > nextShower) {
      scheduleShower(2 + ((Math.random() * 3) | 0));
      nextShower = clock + 5 + Math.random() * 4;
    }
    queue = queue.filter((m) => {
      if (m.at <= clock) {
        meteors.push(m);
        return false;
      }
      return true;
    });

    for (const m of meteors) {
      m.x += m.ux * m.speed * dt;
      m.y += m.uy * m.speed * dt;
      m.age += dt;
      if (Math.random() < 0.6) {
        sparks.push({
          x: m.x - m.ux * Math.random() * 30,
          y: m.y - m.uy * Math.random() * 30,
          vx: (Math.random() - 0.5) * 20,
          vy: 10 + Math.random() * 25,
          size: Math.random() < 0.3 ? 2 : 1,
          age: 0,
          life: 0.5 + Math.random() * 0.8,
          color: Math.random() < 0.5 ? P.gold : P.cream,
        });
      }
    }
    for (const p of sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
    }
    meteors = meteors.filter((m) => m.age < m.dur);
    sparks = sparks.filter((p) => p.age < p.life);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    cancelAnimationFrame(raf);
    if (!document.hidden && running && !reduceMotion) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  if (!reduceMotion) raf = requestAnimationFrame(frame);

  return {
    shoot() {
      if (!reduceMotion) scheduleShower(3);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
