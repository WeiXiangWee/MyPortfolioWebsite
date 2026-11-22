import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SCENE3D } from '../scene/scene3d.js';
import { OBJECTS } from '../data/sections.js';
import { PixelDigits } from './PixelDigits.jsx';
import './Room.css';

/*
  The room is a real 3D diorama built with CSS 3D transforms:
    stage (overflow hidden, handles dragging)
      └ world (time-of-day lighting filter)
          └ camera (perspective + rotateX/rotateZ + zoom)
              └ groups (walls, desk, each clickable object…)
                  └ faces (flat pixel-art panels placed with matrix3d)
  The faces and their textures come from scripts/build-room3d.mjs.
*/

const U = SCENE3D.unit; // CSS px per room unit
const PERSPECTIVE = 2600; // px; smaller = stronger depth
const ZOOM = 2.2; // keep in sync with --zoom-scale in tokens.css
const REST = { rx: 60, rz: 45 }; // resting camera angle (deg): looking down at the back corner
const LIMITS = { rx: [46, 72], rz: [18, 72] }; // how far you can turn it
const DRAG_SPEED = { rx: 0.15, rz: 0.25 }; // degrees per pixel dragged
const DRAG_THRESHOLD = 5; // px the pointer must move before a press counts as a drag
const ZOOMED_STRENGTH = 0.3; // the angle softens to 30% while zoomed into an object
const INTRO_SPACE = 400; // px kept free on the left for the intro panel (22rem + gutters)

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const rad = (d) => (d * Math.PI) / 180;
const { room } = SCENE3D;
const ROOM_FOCUS = [room.w / 2, room.d / 2, (room.h - room.slab) / 2];
const ROOM_CORNERS = [0, room.w].flatMap((x) => [0, room.d].flatMap((y) => [-room.slab, room.h].map((z) => [x, y, z])));
const atlasStyle = { '--atlas': `url(${SCENE3D.atlas})`, '--atlas-size': `${SCENE3D.atlasSize[0]}px ${SCENE3D.atlasSize[1]}px` };

/** Where a room point lands on screen (before zoom/perspective), for the resting camera angle. */
function project([x, y, z]) {
  const cz = Math.cos(rad(REST.rz)), sz = Math.sin(rad(REST.rz));
  const x1 = (x * cz - y * sz) * U;
  const y1 = (x * sz + y * cz) * U;
  return [x1, y1 * Math.cos(rad(REST.rx)) - z * U * Math.sin(rad(REST.rx))];
}

/** Camera position: the whole room fitted beside the intro panel, or zoomed into one object. */
function computeCamera(size, zoomObject) {
  const { w, h } = size;
  const availW = Math.max(200, w - INTRO_SPACE - 24);
  const availH = Math.max(200, h - 48);
  const [fx, fy] = project(ROOM_FOCUS);
  const pts = ROOM_CORNERS.map((c) => project(c)).map(([x, y]) => [x - fx, y - fy]);
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const kHome = Math.min(availW / (maxX - minX), availH / (maxY - minY)) * 0.94;
  if (!zoomObject) {
    const sx = INTRO_SPACE + availW / 2 - (kHome * (minX + maxX)) / 2;
    const sy = h / 2 - (kHome * (minY + maxY)) / 2;
    return { k: kHome, focus: ROOM_FOCUS, sx, sy, bottom: sy + kHome * maxY };
  }
  const windowWidth = Math.min(736, w * 0.56); // same as --window-w: min(46rem, 56vw)
  const freeW = w - windowWidth - 24;
  return { k: kHome * ZOOM, focus: SCENE3D.groups[zoomObject].center, sx: Math.max(freeW / 2, 160), sy: h / 2, bottom: h };
}

/** Screen reader label for each clickable object. */
function labelFor(obj) {
  if (obj.action === 'resume') return `${obj.name}: download CV`;
  if (obj.action === 'lamp') return `${obj.name}: light`;
  return `${obj.name}: open ${obj.tooltip.replace('> ', '')}`;
}

/**
 * Hover label as a little sign parallel to the object's front, standing on its top edge.
 * rotateX(-90deg) stands the sign up facing +Y; for left-wall objects, rotateZ(-90deg) turns it to face +X.
 */
const LABEL = { font: 20, padX: 10, border: 2 }; // keep in sync with .room-tip > span in Room.css
function labelTransform({ at, facing }, text) {
  // Slide the sign sideways if it would poke into a wall (IBM Plex Mono is ~0.6em per character)
  const halfWidth = (text.length * LABEL.font * 0.6 + 2 * (LABEL.padX + LABEL.border)) / 2 / U;
  const along = facing === 'x' ? 1 : 0; // the room axis the sign runs along
  const limit = facing === 'x' ? room.d : room.w;
  const p = [...at];
  p[along] = clamp(p[along], [halfWidth + 1, limit - halfWidth - 1]);
  const pos = `translate3d(${p[0] * U}px, ${p[1] * U}px, ${p[2] * U}px)`;
  // translate(-50%, -100%) centres the sign on its anchor and sits it on top. It's part of the sign's own
  // transform (not a child offset) so the element's box IS the visible sign; an empty box beside it would
  // otherwise get painted as a black rectangle in 3D.
  const stand = facing === 'x' ? 'rotateZ(-90deg) rotateX(-90deg)' : 'rotateX(-90deg)';
  return `${pos} ${stand} translate(-50%, -100%)`;
}

/** One flat pixel-art panel. Billboards (c) always turn to face the camera. */
function Face({ f }) {
  const style = { width: f.w, height: f.h, backgroundPosition: `${f.bx}px ${f.by}px` };
  if (f.c) style.transform = `translate3d(${f.c[0]}px, ${f.c[1]}px, ${f.c[2]}px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(-50%, -50%)`;
  else style.transform = f.m;
  if (f.clip) style.clipPath = f.clip;
  const cls = ['f', f.double && 'f--double', f.c && 'f--sprite', f.state && `f--${f.state}`].filter(Boolean).join(' ');
  return <div className={cls} style={style} />;
}

/** A panel that always turns to face the camera, anchored at a room point. */
const billboard = ([x, y, z], anchor = '-50%, -100%') =>
  `translate3d(${x * U}px, ${y * U}px, ${z * U}px) rotateZ(calc(-1 * var(--rz))) rotateX(calc(-1 * var(--rx))) translate(${anchor})`;

const BARK_TEXT = 'WOOF!';

/**
 * The gaming chair (Racer design) and the poodle sitting on it.
 * Click the chair: it swivels to face you (and back). Click the poodle: it barks and hops.
 * The poodle stands on the chair's swivel axis, so it can stay facing you while the chair turns underneath.
 */
function GamingChair({ turned, barks, interactive, pinging, hovered, setHovered, onActivate, onHoverSound }) {
  const { chair, groups } = SCENE3D;
  const top = chair.top;
  const [barking, setBarking] = useState(false);
  useEffect(() => {
    if (!barks) return;
    setBarking(true);
    const t = setTimeout(() => setBarking(false), 1300);
    return () => clearTimeout(t);
  }, [barks]);

  const chairObj = OBJECTS.find((o) => o.id === 'chair');
  const dogObj = OBJECTS.find((o) => o.id === 'dog');
  // swivel angle: 0 = facing the desk; facing you = 180° minus the camera's turn
  const angle = turned ? 'calc(180deg - var(--rz))' : '0deg';
  const ax = chair.x * U, ay = chair.y * U;
  const buttonProps = (obj, label) => ({
    id: `hit-${obj.id}`,
    role: 'button',
    tabIndex: interactive ? 0 : -1,
    'aria-label': label,
    onClick: (e) => onActivate(obj, e.currentTarget),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate(obj, e.currentTarget);
      }
    },
    onPointerEnter: () => {
      setHovered(obj.id);
      onHoverSound();
    },
    onPointerLeave: () => setHovered((h) => (h === obj.id ? null : h)),
    onFocus: () => setHovered(obj.id),
    onBlur: () => setHovered((h) => (h === obj.id ? null : h)),
  });

  return (
    <>
      <div
        className={`chair${turned ? ' is-turned' : ''}`}
        style={{ transform: `translate3d(${ax}px, ${ay}px, 0px) rotateZ(${angle}) translate3d(${-ax}px, ${-ay}px, 0px)` }}
      >
        <div
          {...buttonProps(chairObj, turned ? 'Gaming chair: turn back to the desk' : 'Gaming chair: turn to face you')}
          className={`g g--obj g--chair${hovered === 'chair' ? ' is-hot' : ''}${pinging ? ' is-pinging' : ''}`}
          style={{ '--i': 6, '--ping-delay': '960ms' }}
        >
          {groups.chair.faces.map((f, j) => (
            <Face key={j} f={f} />
          ))}
        </div>
      </div>

      <div
        {...buttonProps(dogObj, 'Poodle on the chair: bark')}
        className={`g g--obj g--dog${hovered === 'dog' ? ' is-hot' : ''}${barking ? ' is-barking' : ''}`}
        style={{ '--i': 6.5 }}
      >
        <div className="dog-hop">
          {groups.dog.faces.map((f, j) => (
            <Face key={j} f={f} />
          ))}
        </div>
      </div>

      {/* hover labels and the bark bubble always face you */}
      <span className={`room-tip${hovered === 'chair' ? ' is-shown' : ''}`} aria-hidden="true" style={{ transform: billboard([chair.x, chair.y, top + 3]) }}>
        <span>{chairObj.tooltip}</span>
      </span>
      <span className={`room-tip${hovered === 'dog' && !barking ? ' is-shown' : ''}`} aria-hidden="true" style={{ transform: billboard([chair.x, chair.y, chair.dogTop + 2]) }}>
        <span>{dogObj.tooltip}</span>
      </span>
      {barking && (
        <div key={barks} className="bark" aria-hidden="true" style={{ transform: billboard([chair.x, chair.y, chair.dogTop - 3], '-50%, -50%') }}>
          <span className="bark__bubble">{BARK_TEXT}</span>
        </div>
      )}
      <span className="visually-hidden" role="status">
        {barking ? BARK_TEXT : ''}
      </span>
    </>
  );
}

/** An HTML panel (screen text, clock, sky) placed in 3D like a face. */
const panelStyle = (p) => ({ width: p.w, height: p.h, transform: p.m });

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
  chairTurned,
  barks,
  onExplore,
  onActivate,
  onHoverSound,
  interactive,
}) {
  const stageRef = useRef(null);
  const cameraRef = useRef(null);
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

  const cam = computeCamera(size, zoomObject);

  // ---- Drag to rotate: hold the mouse button and drag to turn the room ----
  const angle = useRef({ ...REST });
  const drag = useRef(null);
  const justDragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const strength = zoomObject ? ZOOMED_STRENGTH : 1;

  const applyAngle = (rx, rz) => {
    angle.current = { rx, rz };
    const el = cameraRef.current;
    if (!el) return;
    el.style.setProperty('--rx', `${REST.rx + (rx - REST.rx) * strength}deg`);
    el.style.setProperty('--rz', `${REST.rz + (rz - REST.rz) * strength}deg`);
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
    applyAngle(clamp(d.start.rx + dy * DRAG_SPEED.rx, LIMITS.rx), clamp(d.start.rz - dx * DRAG_SPEED.rz, LIMITS.rz));
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    setDragging(false);
    applyAngle(REST.rx, REST.rz); // let go: the room eases back to its resting angle
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

  // Re-apply the angle when zooming in/out changes its strength
  useEffect(() => {
    applyAngle(angle.current.rx, angle.current.rz);
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

  const { groups } = SCENE3D;
  const objects = OBJECTS.filter((o) => groups[o.id] && !o.special);
  const scenery = ['walls', 'furniture', 'decor'];

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
    >
      <div className="room-world">
        <div
          ref={cameraRef}
          className="room-camera"
          style={{
            ...atlasStyle,
            '--k': cam.k,
            transform:
              `translate(${cam.sx}px, ${cam.sy}px) scale(${cam.k}) perspective(${PERSPECTIVE}px) ` +
              `rotateX(var(--rx)) rotateZ(var(--rz)) ` +
              `translate3d(${-cam.focus[0] * U}px, ${-cam.focus[1] * U}px, ${-cam.focus[2] * U}px)`,
          }}
        >
          {/* outside: the sky and city, seen through the window */}
          <Sky />
          <div className="room-floor-light" style={{ ...panelStyle(SCENE3D.floorLight), clipPath: SCENE3D.floorLight.clip }} />

          {scenery.map((name, i) => (
            <div key={name} className={`g g--${name}`} style={{ '--i': i }}>
              {groups[name].faces.map((f, j) => (
                <Face key={j} f={f} />
              ))}
              {name === 'decor' && (
                <div className="room-clock" style={panelStyle(SCENE3D.clock)} role="img" aria-label={`Desk clock: ${timeLabel} in Singapore`}>
                  <PixelDigits text={timeLabel} />
                </div>
              )}
            </div>
          ))}

          {/* warm light from the floor lamp */}
          <div className="g g--glow" aria-hidden="true">
            {groups.glow.faces.map((f, j) => (
              <Face key={j} f={f} />
            ))}
          </div>

          {/* clickable objects: real buttons for keyboard + screen readers */}
          {objects.map((obj, index) => {
            const g = groups[obj.id];
            const isHot = hovered === obj.id;
            const faces = g.faces.filter((f) => !f.state || f.state === (lampOn ? 'on' : 'off'));
            const activate = (e) => onActivate(obj, e.currentTarget);
            const tip = obj.action === 'lamp' && lampOn ? obj.tooltipOn : obj.tooltip;
            return (
              <div
                key={obj.id}
                id={`hit-${obj.id}`}
                className={`g g--obj${isHot ? ' is-hot' : ''}${pinging ? ' is-pinging' : ''}`}
                style={{ '--i': 3 + index * 0.5, '--ping-delay': `${index * 120}ms` }}
                role="button"
                tabIndex={interactive ? 0 : -1}
                aria-label={labelFor(obj)}
                aria-pressed={obj.action === 'lamp' ? lampOn : undefined}
                onClick={activate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate(e);
                  }
                }}
                onPointerEnter={() => {
                  setHovered(obj.id);
                  onHoverSound();
                }}
                onPointerLeave={() => setHovered((h) => (h === obj.id ? null : h))}
                onFocus={() => setHovered(obj.id)}
                onBlur={() => setHovered((h) => (h === obj.id ? null : h))}
              >
                {faces.map((f, j) => (
                  <Face key={`${j}-${f.state ?? ''}`} f={f} />
                ))}
                {obj.id === 'monitor' && <MonitorScreen lines={screenLines} done={screenDone} loaded={loaded} />}
                <span className="room-tip" aria-hidden="true" style={{ transform: labelTransform(g.label, tip) }}>
                  <span>{tip}</span>
                </span>
              </div>
            );
          })}

          <GamingChair
            turned={chairTurned}
            barks={barks}
            interactive={interactive}
            pinging={pinging}
            hovered={hovered}
            setHovered={setHovered}
            onActivate={onActivate}
            onHoverSound={onHoverSound}
          />
        </div>
      </div>

      {showPrompt && (
        <button type="button" className="room-prompt" onClick={onExplore} style={{ left: cam.sx, top: Math.min(size.h - 56, cam.bottom - 8) }}>
          <span aria-hidden="true">&gt; </span>Explore the desk <kbd>Enter</kbd>
          <span className="cursor-blink" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** The sky outside the window: colour bands, sun or moon, stars and the city skyline. */
function Sky() {
  const { sky } = SCENE3D;
  return (
    <div className="sky" style={panelStyle(sky)} aria-hidden="true">
      <div className="sky__bands" style={{ height: `${sky.horizon * 100}%` }}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="sky__ground" style={{ top: `${sky.horizon * 100}%` }} />
      <div className="sky__stars" />
      <div className="sky__sun" />
      <img className="sky__city" src={sky.skyline} alt="" />
      <img className="sky__lights" src={sky.lights} alt="" />
    </div>
  );
}

/** Terminal text on the monitor's screen (decorative copy of the intro). */
function MonitorScreen({ lines, done, loaded }) {
  return (
    <div className={`room-screen${loaded ? ' is-on' : ''}`} style={panelStyle(SCENE3D.screen)} aria-hidden="true">
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
