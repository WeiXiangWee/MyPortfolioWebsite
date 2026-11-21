import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SCENE } from '../scene/sceneLayout.js';
import { OBJECTS } from '../data/sections.js';
import { Sky } from './Sky.jsx';
import { PixelDigits } from './PixelDigits.jsx';
import './Room.css';

const PERSPECTIVE = 1400;
// Depth of each layer (px). Kept tiny on purpose so the desk items stay "glued" to the desk while
// the room turns. Bigger gaps make layers slide apart (they looked like they were floating).
// The 1px steps only keep the paint order right (items in front of the furniture and walls).
const DEPTH = { wall: 0, furniture: 1, items: 2 };
const ZOOM = 2.2; // keep in sync with --zoom-scale in tokens.css
const REST = { rx: 6, ry: -6 }; // resting angle (deg) the room settles back to
const LIMITS = { rx: [-8, 20], ry: [-26, 26] }; // how far you can turn it (deg)
const DRAG_SPEED = 0.2; // degrees per pixel dragged
const DRAG_THRESHOLD = 5; // px the pointer must move before a press counts as a drag

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** Screen reader label for each clickable object. */
function labelFor(obj) {
  if (obj.action === 'resume') return `${obj.name}: download CV`;
  if (obj.action === 'lamp') return `${obj.name}: light`;
  return `${obj.name}: open ${obj.tooltip.replace('> ', '')}`;
}
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
  // Whole-number scales keep every art pixel the same size (crisp pixel art).
  // Only on small screens does it drop below 1x.
  const fit = Math.min(availW / RW, availH / RH);
  const scale = fit >= 1 ? Math.floor(fit) : Math.max(0.5, Math.floor(fit * 4) / 4);
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
  lampOn,
  onExplore,
  onActivate,
  onHoverSound,
  interactive,
}) {
  const stageRef = useRef(null);
  const tiltRef = useRef(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 56 });
  const [hovered, setHovered] = useState(null);

  // Preload both lamp pictures so switching it on/off never flickers
  useEffect(() => {
    const { src, srcOff } = SCENE.objects.lamp;
    for (const url of [src, srcOff]) new Image().src = url;
  }, []);

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
  const strength = reduced ? 0 : zoomObject ? 0.3 : 1; // the angle softens to 30% while zoomed

  // ---- Drag to rotate: hold the mouse button and drag to turn the room ----
  const angle = useRef({ ...REST });
  const drag = useRef(null);
  const justDragged = useRef(false);
  const [dragging, setDragging] = useState(false);

  const applyAngle = (rx, ry) => {
    angle.current = { rx, ry };
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', `${rx * strength}deg`);
    el.style.setProperty('--ry', `${ry * strength}deg`);
  };

  const onPointerDown = (e) => {
    if (reduced || zoomObject || e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: { ...angle.current }, active: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // still a normal click, not a drag
      d.active = true;
      stageRef.current.setPointerCapture(d.id);
      setDragging(true);
    }
    applyAngle(clamp(d.start.rx - dy * DRAG_SPEED, LIMITS.rx), clamp(d.start.ry + dx * DRAG_SPEED, LIMITS.ry));
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setDragging(false);
    applyAngle(REST.rx, REST.ry); // let go: the room eases back to its resting angle
    // A drag ends with a click event; ignore it so letting go over an object doesn't open it
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
  };
  const onClickCapture = (e) => {
    if (!justDragged.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

  // Re-apply the angle when the strength changes (zooming in/out, reduced motion)
  useEffect(() => {
    applyAngle(angle.current.rx, angle.current.ry);
  }, [strength]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomed = Boolean(zoomObject);
  const stageClass = [
    'room-stage',
    `sky--${period}`,
    loaded ? 'is-loaded' : 'is-loading',
    zoomed ? 'is-zoomed' : '',
    dragging ? 'is-dragging' : '',
    lampOn ? 'lamp-on' : '',
    reduced ? '' : 'can-drag',
    interactive ? '' : 'is-inert',
  ].join(' ');

  return (
    <div
      ref={stageRef}
      className={stageClass}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onClickCapture={onClickCapture}
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
            <img className="room-lamp-glow" src={SCENE.lampGlow} alt="" width={RW} height={RH} />
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
                <img className="room-art" src={obj.id === 'lamp' && !lampOn ? o.srcOff : o.src} alt="" width={o.w} height={o.h} />
                {obj.id === 'monitor' && (
                  <MonitorScreen lines={screenLines} done={screenDone} loaded={loaded} offsetX={SCENE.screen.x - o.x} offsetY={SCENE.screen.y - o.y} />
                )}
                <button
                  type="button"
                  id={`hit-${obj.id}`}
                  className="room-hit"
                  style={{ clipPath: `polygon(${o.polygon.map(([x, y]) => `${x}px ${y}px`).join(',')})` }}
                  aria-label={labelFor(obj)}
                  aria-pressed={obj.action === 'lamp' ? lampOn : undefined}
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
                  {obj.action === 'lamp' && lampOn ? obj.tooltipOn : obj.tooltip}
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
