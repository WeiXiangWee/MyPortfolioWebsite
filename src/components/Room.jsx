import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SCENE } from '../scene/sceneLayout.js';
import { OBJECTS } from '../data/sections.js';
import { Sky } from './Sky.jsx';
import { PixelDigits } from './PixelDigits.jsx';
import './Room.css';

// Depth of each layer (px). Bigger numbers float further towards the viewer when the room tilts.
const PERSPECTIVE = 1400;
const DEPTH = { wall: 0, furniture: 40, items: 80 };
const ZOOM = 2.2; // keep in sync with --zoom-scale in tokens.css
const REST = { rx: 6, ry: -6 }; // resting angle (deg) when the mouse leaves
const RANGE = { rx: 5, ry: 8 }; // how far the mouse can tilt it
const INTRO_SPACE = 400; // px kept free on the left for the intro panel (22rem + gutters)

const RW = SCENE.width, RH = SCENE.height;

/** transform for a layer at depth z, scaled back so it still lines up when the room is flat */
function depthStyle(z, originX = RW / 2, originY = RH / 2) {
  return {
    transform: `translateZ(${z}px) scale(${(PERSPECTIVE - z) / PERSPECTIVE})`,
    transformOrigin: `${originX}px ${originY}px`,
  };
}

/** Where the room sits on screen: home view or zoomed into one object. */
function computeCamera(size, zoomObject, windowWidth) {
  const { w, h } = size;
  const availW = Math.max(200, w - INTRO_SPACE - 24);
  const availH = Math.max(200, h - 48);
  const scale = Math.max(1, Math.floor(Math.min(availW / RW, availH / RH) * 2) / 2);
  if (!zoomObject) {
    return { scale, k: scale, cx: INTRO_SPACE + availW / 2, cy: h / 2 };
  }
  const k = scale * ZOOM;
  const [tx, ty] = SCENE.objects[zoomObject].center;
  const freeW = w - windowWidth - 24; // space left of the open window
  const fx = Math.max(freeW / 2, 160);
  const fy = h / 2;
  return { scale, k, cx: fx - k * (tx - RW / 2), cy: fy - k * (ty - RH / 2) };
}

export function Room({
  zoomObject,
  reduced,
  loaded,
  period,
  timeLabel,
  screenLines,
  screenDone,
  showPrompt,
  pinging,
  onExplore,
  onActivate,
  onHoverSound,
  interactive,
}) {
  const stageRef = useRef(null);
  const tiltRef = useRef(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 56 });
  const [hovered, setHovered] = useState(null);

  // Track the stage size
  useLayoutEffect(() => {
    const el = stageRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const windowWidth = Math.min(736, size.w * 0.56); // same as --window-w: min(46rem, 56vw)
  const cam = computeCamera(size, zoomObject, windowWidth);
  const strength = reduced ? 0 : zoomObject ? 0.3 : 1; // tilt softens to 30% while zoomed

  // ---- Tilting diorama ----
  const pointer = useRef({ nx: 0, ny: 0 });
  const setTilt = (nx, ny) => {
    const el = tiltRef.current;
    if (!el) return;
    pointer.current = { nx, ny };
    const rx = reduced ? 0 : (REST.rx - ny * RANGE.rx) * strength;
    const ry = reduced ? 0 : (REST.ry + nx * RANGE.ry) * strength;
    el.style.setProperty('--rx', `${rx}deg`);
    el.style.setProperty('--ry', `${ry}deg`);
  };
  const onMouseMove = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    setTilt(nx, ny);
  };
  const onMouseLeave = () => setTilt(0, 0);
  // Re-apply the tilt when the strength changes (zooming in/out, reduced motion)
  useEffect(() => {
    setTilt(pointer.current.nx, pointer.current.ny);
  }, [strength]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomed = Boolean(zoomObject);
  const stageClass = [
    'room-stage',
    `sky--${period}`,
    loaded ? 'is-loaded' : 'is-loading',
    zoomed ? 'is-zoomed' : '',
    interactive ? '' : 'is-inert',
  ].join(' ');

  return (
    <div
      ref={stageRef}
      className={stageClass}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ perspectiveOrigin: `${cam.cx}px ${cam.cy}px`, perspective: `${PERSPECTIVE}px`, '--s': cam.k }}
    >
      <div
        className="room-zoom"
        style={{
          width: RW,
          height: RH,
          transform: `translate(${cam.cx - RW / 2}px, ${cam.cy - RH / 2}px) scale(${cam.k})`,
        }}
      >
        <div className="room-tilt" ref={tiltRef}>
          {/* Layer 1: wall, window sky, floor */}
          <div className="room-layer" style={{ ...depthStyle(DEPTH.wall), '--i': 0 }}>
            <Sky />
            <img className="room-art" src={SCENE.layers.walls} alt="" width={RW} height={RH} />
            <div className="room-floor-light" style={{ clipPath: `polygon(${SCENE.floorLight.map(([x, y]) => `${x}px ${y}px`).join(',')})` }} />
          </div>
          {/* Layer 2: desk and furniture */}
          <div className="room-layer" style={{ ...depthStyle(DEPTH.furniture), '--i': 1 }}>
            <img className="room-art" src={SCENE.layers.furniture} alt="" width={RW} height={RH} />
          </div>
          {/* Layer 3: desk items that aren't clickable + the desk clock */}
          <div className="room-layer" style={{ ...depthStyle(DEPTH.items), '--i': 2 }}>
            <img className="room-art" src={SCENE.layers.decor} alt="" width={RW} height={RH} />
            <div
              className="room-clock"
              style={{ left: SCENE.clock.x, top: SCENE.clock.y, width: SCENE.clock.w, height: SCENE.clock.h }}
              role="img"
              aria-label={`Desk clock: ${timeLabel} in Singapore`}
            >
              <PixelDigits text={timeLabel} />
            </div>
          </div>

          {/* Clickable objects: each is its own PNG, positioned over the room */}
          {OBJECTS.map((obj, index) => {
            const o = SCENE.objects[obj.id];
            const isHot = hovered === obj.id;
            return (
              <div
                key={obj.id}
                className={`room-obj room-obj--${obj.id}${isHot ? ' is-hot' : ''}${pinging ? ' is-pinging' : ''}`}
                style={{
                  left: o.x,
                  top: o.y,
                  width: o.w,
                  height: o.h,
                  ...depthStyle(DEPTH[o.depth], RW / 2 - o.x, RH / 2 - o.y),
                  '--i': 3 + index * 0.35,
                  '--ping-delay': `${index * 120}ms`,
                }}
              >
                <img className="room-art" src={o.src} alt="" width={o.w} height={o.h} />
                {obj.id === 'monitor' && (
                  <MonitorScreen lines={screenLines} done={screenDone} loaded={loaded} offsetX={SCENE.screen.x - o.x} offsetY={SCENE.screen.y - o.y} />
                )}
                <button
                  type="button"
                  id={`hit-${obj.id}`}
                  className="room-hit"
                  style={{ clipPath: `polygon(${o.polygon.map(([x, y]) => `${x}px ${y}px`).join(',')})` }}
                  aria-label={obj.action === 'resume' ? `${obj.name}: download CV` : `${obj.name}: open ${obj.tooltip.replace('> ', '')}`}
                  tabIndex={interactive ? 0 : -1}
                  onClick={(e) => onActivate(obj, e.currentTarget)}
                  onPointerEnter={() => {
                    setHovered(obj.id);
                    onHoverSound();
                  }}
                  onPointerLeave={() => setHovered((h) => (h === obj.id ? null : h))}
                  onFocus={() => setHovered(obj.id)}
                  onBlur={() => setHovered((h) => (h === obj.id ? null : h))}
                />
                <span className="room-tip" aria-hidden="true">
                  {obj.tooltip}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showPrompt && (
        <button
          type="button"
          className="room-prompt"
          onClick={onExplore}
          style={{ left: cam.cx, top: Math.min(size.h - 56, cam.cy + (RH / 2) * cam.k - 24) }}
        >
          <span aria-hidden="true">&gt; </span>Explore the desk <kbd>Enter</kbd>
          <span className="cursor-blink" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Terminal text on the monitor's screen face (decorative copy of the intro). */
function MonitorScreen({ lines, done, loaded, offsetX, offsetY }) {
  const { w, h } = SCENE.screen;
  return (
    <div
      className={`room-screen${loaded ? ' is-on' : ''}`}
      style={{ left: offsetX, top: offsetY, width: w, height: h }}
      aria-hidden="true"
    >
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith('>') ? 'room-screen__cmd' : undefined}>
          {line}
          {!done && i === lines.findLastIndex((l) => l.length > 0) && <span className="cursor-blink" />}
        </div>
      ))}
      {done && (
        <div className="room-screen__cmd">
          &gt; <span className="cursor-blink" />
        </div>
      )}
    </div>
  );
}
