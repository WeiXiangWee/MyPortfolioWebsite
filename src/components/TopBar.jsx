import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { PORTFOLIO_TABS, SECTIONS } from '../data/sections.js';
import { useSound } from '../hooks/useSound.jsx';
import { PixelIcon } from './PixelIcon.jsx';
import './TopBar.css';

/** Text navigation for recruiters who don't explore the room (and for keyboard / screen reader users). */
export function TopBar({ time }) {
  const { pathname } = useLocation();
  const { enabled, toggle, play } = useSound();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const inPortfolio = pathname.startsWith('/portfolio');

  // Close the dropdown on outside click or Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Close it after navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="topbar">
      <Link to="/" className="topbar__logo" aria-label="wx, back to the desk">
        wx<span className="cursor-blink" aria-hidden="true" />
      </Link>

      <nav aria-label="Main">
        <ul className="topbar__nav">
          <li>
            <NavLink to={SECTIONS.about.path} className="topbar__link" onClick={() => play('click')}>
              About
            </NavLink>
          </li>
          <li
            className="topbar__menu"
            ref={menuRef}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}
          >
            <button
              type="button"
              className={`topbar__link${inPortfolio ? ' active' : ''}`}
              aria-expanded={open}
              aria-controls="portfolio-menu"
              onClick={() => setOpen((o) => !o)}
            >
              Portfolio
              <span className={`topbar__caret${open ? ' is-open' : ''}`}>
                <PixelIcon name="caret" size={10} />
              </span>
            </button>
            <ul id="portfolio-menu" className="topbar__dropdown" hidden={!open}>
              {PORTFOLIO_TABS.map((key) => (
                <li key={key}>
                  <NavLink to={SECTIONS[key].path} onClick={() => play('click')}>
                    {SECTIONS[key].label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <NavLink to={SECTIONS.contact.path} className="topbar__link" onClick={() => play('click')}>
              Contact
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="topbar__right">
        <span className="topbar__time" title="Real time in Singapore (it sets the sky outside the window)">
          SGT {time.label} · {time.period}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={enabled}
          aria-label={enabled ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'}
          onClick={toggle}
        >
          <PixelIcon name={enabled ? 'soundOn' : 'soundOff'} size={14} />
        </button>
      </div>
    </header>
  );
}
