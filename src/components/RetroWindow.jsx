import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PixelIcon } from './PixelIcon.jsx';
import './RetroWindow.css';

// A spot in the window footer, next to "Back to desk", that content inside the window can fill
const FooterSlot = createContext(null);

/** Renders its children in the window footer (beside "Back to desk"), or in place if there's no window */
export function WindowFooterAction({ children }) {
  const slot = useContext(FooterSlot);
  return slot ? createPortal(children, slot) : children;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Retro OS window, e.g. "about.exe  _ x".
 * - Esc, the x button, "_" and "Back to desk" all close it
 * - focus moves inside when it opens and stays inside (focus trap)
 * - the body scrolls; the title bar stays fixed
 */
export function RetroWindow({ title, phase, onClose, focusKey, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const [slot, setSlot] = useState(null);

  // Move focus into the window when it opens (or when it switches to a different window)
  useEffect(() => {
    if (phase === 'open') ref.current?.focus({ preventScroll: true });
  }, [phase, focusKey]);

  // Esc closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep Tab / Shift+Tab inside the window
  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <section
      ref={ref}
      className="win"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="win__bar">
        <h2 id={titleId} className="win__title">
          {title}
        </h2>
        <div className="win__controls">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Minimise (back to desk)">
            <PixelIcon name="minimise" size={12} />
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close window">
            <PixelIcon name="close" size={12} />
          </button>
        </div>
      </header>
      <div className="win__body">
        <FooterSlot.Provider value={slot}>{children}</FooterSlot.Provider>
      </div>
      <footer className="win__foot">
        <div className="win__foot-actions">
          {/* e.g. "← All projects" when a project is open */}
          <div ref={setSlot} className="win__foot-slot" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            <PixelIcon name="back" size={14} />
            Back to desk
          </button>
        </div>
        <span className="win__hint" aria-hidden="true">
          esc to close
        </span>
      </footer>
    </section>
  );
}
