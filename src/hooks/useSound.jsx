import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createMusic } from './backgroundMusic.js';

// Short sound effects (mostly 8-bit ones from scripts/make-extras.mjs; the bark is a real recording)
// plus quiet background music. Everything is muted until the visitor turns sound on.
const NAMES = ['hover', 'click', 'open', 'close', 'zoom', 'bark'];
const EFFECT_VOLUME = 0.6;
const STORAGE_KEY = 'wx-sound-on';

const SoundContext = createContext({ enabled: false, toggle: () => {}, play: () => {} });

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(readSaved);
  const sounds = useRef({});
  const music = useRef(null);
  if (!music.current) music.current = createMusic();

  // Load the sound effects once
  useEffect(() => {
    for (const name of NAMES) {
      const audio = new Audio(`/sfx/${name}.wav`);
      audio.preload = 'auto';
      audio.volume = EFFECT_VOLUME;
      sounds.current[name] = audio;
    }
  }, []);

  // Background music follows the sound switch
  useEffect(() => {
    const m = music.current;
    if (!enabled) {
      m.stop();
      return;
    }
    m.start();
    // If sound was left on from a previous visit, browsers wait for a click or key press before playing
    const unlock = () => m.start();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const onVisibility = () => m.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  const play = useCallback(
    (name) => {
      if (!enabled) return;
      const audio = sounds.current[name];
      if (!audio) return;
      if (name !== 'hover') music.current.duck(); // let the effect cut through the music
      audio.currentTime = 0;
      audio.play().catch(() => {}); // browsers may block audio until the first click
    },
    [enabled],
  );

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* storage can be blocked; the toggle still works for this visit */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export const useSound = () => useContext(SoundContext);
