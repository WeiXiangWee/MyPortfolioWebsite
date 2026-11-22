import { useEffect, useRef } from 'react';
import { meteorShower } from './meteorShower.js';

/** Animated meteor-shower sky behind the whole site (decorative). */
export function StarSky() {
  const ref = useRef(null);
  useEffect(() => {
    const sky = meteorShower(ref.current);
    return () => sky.stop();
  }, []);
  return <canvas ref={ref} className="star-sky" aria-hidden="true" />;
}
