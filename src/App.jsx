import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SECTIONS, sectionFromPath, objectForKey } from './data/sections.js';
import { monitorIntro, profile } from './data/content.js';
import { useReducedMotion } from './hooks/useReducedMotion.js';
import { useSingaporeTime } from './hooks/useSingaporeTime.js';
import { useSound } from './hooks/useSound.jsx';
import { useKonami } from './hooks/useKonami.js';
import { useTypewriter } from './hooks/useTypewriter.js';
import { isPlaceholder } from './components/Placeholder.jsx';
import { TopBar } from './components/TopBar.jsx';
import { Room } from './components/Room.jsx';
import { IntroPanel } from './components/IntroPanel.jsx';
import { BootScreen } from './components/BootScreen.jsx';
import { RetroWindow } from './components/RetroWindow.jsx';
import { About } from './sections/About.jsx';
import { Skills } from './sections/Skills.jsx';
import { Portfolio } from './sections/Portfolio.jsx';
import { Contact } from './sections/Contact.jsx';
import { NotFound } from './sections/NotFound.jsx';
import { Terminal } from './sections/Terminal.jsx';
import './App.css';

const ZOOM_THEN_OPEN_MS = 750; // --zoom-window-delay
const WINDOW_MS = 400; // --dur-window

const titleFor = (key) => SECTIONS[key]?.title ?? (key === 'terminal' ? 'terminal.exe' : 'error.exe');
const groupFor = (key) => (SECTIONS[key]?.tab ? 'portfolio' : key);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const time = useSingaporeTime();
  const { play } = useSound();

  // ---------- Opening: boot screen (only when landing on the home page) ----------
  const [booted, setBooted] = useState(() => location.pathname !== '/');
  const [typingStarted, setTypingStarted] = useState(false);
  useEffect(() => {
    if (!booted) return;
    const t = setTimeout(() => setTypingStarted(true), reduced ? 0 : 1300); // after the room loads and the monitor flickers on
    return () => clearTimeout(t);
  }, [booted, reduced]);
  const screen = useTypewriter(monitorIntro, typingStarted, reduced);

  // ---------- Toast messages ----------
  const [toast, setToast] = useState(null);
  const showToast = useCallback((text) => setToast({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- Hidden terminal (Konami code) ----------
  const [terminalOpen, setTerminalOpen] = useState(false);
  const openTerminalAfterNav = useRef(false);
  const routeKey = sectionFromPath(location.pathname);
  useKonami(
    useCallback(() => {
      if (sectionFromPath(window.location.pathname)) {
        openTerminalAfterNav.current = true;
        navigate('/');
      } else setTerminalOpen(true);
    }, [navigate]),
  );
  useEffect(() => {
    setTerminalOpen(openTerminalAfterNav.current);
    openTerminalAfterNav.current = false;
  }, [location.pathname]);

  // ---------- Window flow: zoom into the object, then open its window ----------
  const activeKey = terminalOpen ? 'terminal' : routeKey;
  const [shownKey, setShownKey] = useState(null);
  const [phase, setPhase] = useState('closed'); // closed | open | closing
  const [zoomObject, setZoomObject] = useState(null);
  const phaseRef = useRef(phase);
  const zoomRef = useRef(zoomObject);
  const returnFocus = useRef(null);
  phaseRef.current = phase;
  zoomRef.current = zoomObject;

  useEffect(() => {
    const current = phaseRef.current;
    let timer;
    if (activeKey) {
      const target = objectForKey(activeKey);
      if (current === 'closed') {
        const el = document.activeElement;
        returnFocus.current = el && el !== document.body ? el : null;
      }
      if (target && target !== zoomRef.current) play('zoom');
      setZoomObject(target);
      if (current === 'open') {
        setShownKey(activeKey); // switching windows/tabs: no re-pop, the camera just pans
      } else {
        const wait = reduced || !target || current === 'closing' ? 0 : ZOOM_THEN_OPEN_MS;
        timer = setTimeout(() => {
          setShownKey(activeKey);
          setPhase('open');
          play('open');
        }, wait);
      }
    } else if (current !== 'closed') {
      if (current === 'open') play('close');
      setPhase('closing');
      const closingObject = zoomRef.current;
      timer = setTimeout(() => {
        setPhase('closed');
        setShownKey(null);
        setZoomObject(null);
        // Return focus to what opened the window (or the room object it belongs to)
        const prev = returnFocus.current;
        const fallback = document.getElementById(closingObject ? `hit-${closingObject}` : 'intro');
        const target = prev && prev.isConnected && !prev.closest('.win') ? prev : fallback;
        target?.focus({ preventScroll: true });
      }, reduced ? 0 : WINDOW_MS);
    } else {
      setZoomObject(null);
    }
    return () => clearTimeout(timer);
  }, [activeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeWindow = useCallback(() => {
    if (terminalOpen) setTerminalOpen(false);
    else navigate('/');
  }, [terminalOpen, navigate]);

  // ---------- Opening → Home: "Explore the desk" ----------
  const [explored, setExplored] = useState(false);
  const [pinging, setPinging] = useState(false);
  const explore = useCallback(() => {
    setExplored(true);
    setPinging(true);
    play('click');
    setTimeout(() => setPinging(false), 2400);
    document.getElementById('hit-monitor')?.focus({ preventScroll: true });
  }, [play]);
  const showPrompt = booted && screen.done && !explored && !activeKey && phase === 'closed';
  useEffect(() => {
    if (!showPrompt) return;
    const onKey = (e) => {
      const idle = document.activeElement === document.body || document.activeElement?.id === 'intro';
      if (e.key === 'Enter' && idle) explore();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPrompt, explore]);

  // ---------- Clicking objects in the room ----------
  const onActivate = (obj) => {
    play('click');
    if (obj.action === 'resume') {
      if (isPlaceholder(profile.resumeUrl)) showToast(`${profile.resumeUrl} not added yet`);
      else {
        const a = document.createElement('a');
        a.href = profile.resumeUrl;
        a.download = '';
        a.click();
      }
      return;
    }
    navigate(SECTIONS[obj.section].path);
  };

  const windowContent = (key) => {
    switch (key) {
      case 'about':
        return <About />;
      case 'skills':
        return <Skills />;
      case 'projects':
      case 'certifications':
      case 'community':
        return <Portfolio tab={key} />;
      case 'contact':
        return <Contact onToast={showToast} />;
      case 'terminal':
        return (
          <Terminal
            onExit={() => setTerminalOpen(false)}
            onHire={() => {
              setTerminalOpen(false);
              navigate(SECTIONS.contact.path);
            }}
          />
        );
      default:
        return <NotFound />;
    }
  };

  const anyWindow = Boolean(activeKey) || phase !== 'closed';

  return (
    <div className="app">
      <a className="btn skip-link" href="#intro">
        Skip to content
      </a>
      <TopBar time={time} />

      <main className="desk">
        <Room
          zoomObject={zoomObject}
          reduced={reduced}
          loaded={booted}
          period={time.period}
          timeLabel={time.label}
          screenLines={screen.lines}
          screenDone={screen.done}
          showPrompt={showPrompt}
          pinging={pinging}
          onExplore={explore}
          onActivate={onActivate}
          onHoverSound={() => play('hover')}
          interactive={booted && !anyWindow}
        />

        <IntroPanel hidden={anyWindow} onExplore={explore} onToast={showToast} />

        {phase !== 'closed' && <div className="scrim" data-phase={phase} onClick={closeWindow} />}
        {shownKey && phase !== 'closed' && (
          <RetroWindow title={titleFor(shownKey)} phase={phase} onClose={closeWindow} focusKey={groupFor(shownKey)}>
            {windowContent(shownKey)}
          </RetroWindow>
        )}

        <div className="toast-region" role="status" aria-live="polite">
          {toast && (
            <p key={toast.id} className="toast">
              <span aria-hidden="true">&gt; </span>
              {toast.text}
            </p>
          )}
        </div>
      </main>

      {!booted && <BootScreen onDone={() => setBooted(true)} />}
    </div>
  );
}
