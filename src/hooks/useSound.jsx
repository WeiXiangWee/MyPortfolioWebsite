import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Short 8-bit sounds made by scripts/make-extras.mjs. Muted by default.
const NAMES = ['hover', 'click', 'open', 'close', 'zoom'];
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

  // Load the audio files once
  useEffect(() => {
    for (const name of NAMES) {
      const audio = new Audio(`/sfx/${name}.wav`);
      audio.preload = 'auto';
      audio.volume = 0.6;
      sounds.current[name] = audio;
    }
  }, []);

  const play = useCallback(
    (name) => {
      if (!enabled) return;
      const audio = sounds.current[name];
      if (!audio) return;
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
