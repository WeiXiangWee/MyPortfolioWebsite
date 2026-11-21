import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Time of day in Singapore: dawn 6–8, day 8–17, dusk 17–20, night 20–6. */
export function periodFor(hour) {
  if (hour >= 6 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function read() {
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  // For demos: add ?sky=day (or dawn / dusk / night) to the URL to preview another sky.
  const forced = new URLSearchParams(window.location.search).get('sky');
  const period = ['dawn', 'day', 'dusk', 'night'].includes(forced) ? forced : periodFor(hour);
  return { label: `${parts.hour}:${parts.minute}`, hour, period };
}

/** Real Singapore time, updated every 15 seconds. */
export function useSingaporeTime() {
  const [time, setTime] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setTime(read()), 15000);
    return () => clearInterval(id);
  }, []);
  return time;
}
