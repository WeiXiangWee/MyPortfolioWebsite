import { useEffect, useRef, useState } from 'react';
import { profile } from '../data/content.js';
import './BootScreen.css';

const SEEN_KEY = 'wx-boot-seen';
const LINES = [
  'WX-BIOS v1.0 · workbench edition',
  'checking keyboard ............ ok',
  'loading design.sys ........... ok',
  'loading code.sys ............. ok',
  'loading deploy.sys ........... ok',
  'mounting /desk ............... ok',
];

function seenBefore() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Opening boot screen. Name and role show straight away; it's short, skippable, and shorter on repeat visits. */
export function BootScreen({ onDone }) {
  const [duration] = useState(() => (seenBefore() ? 900 : 2400));
  const [shown, setShown] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const skipRef = useRef(null);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setLeaving(true);
    setTimeout(onDone, 400);
  };

  useEffect(() => {
    skipRef.current?.focus();
    const step = duration / LINES.length;
    const id = setInterval(() => setShown((n) => Math.min(LINES.length, n + 1)), step);
    const t = setTimeout(finish, duration);
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(id);
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`boot${leaving ? ' is-leaving' : ''}`} role="status" aria-label="Loading the workbench">
      <div className="boot__inner">
        <p className="boot__name">{profile.name}</p>
        <p className="boot__role">{profile.role}</p>
        <ol className="boot__log" aria-hidden="true">
          {LINES.slice(0, shown).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <div className="boot__bar" aria-hidden="true">
          <span style={{ animationDuration: `${duration}ms` }} />
        </div>
        <button ref={skipRef} type="button" className="btn btn--ghost boot__skip" onClick={finish}>
          Skip <span aria-hidden="true">»</span>
        </button>
      </div>
    </div>
  );
}
