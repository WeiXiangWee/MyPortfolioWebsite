import { useEffect, useState } from 'react';

/**
 * Types out lines one character at a time once `start` is true.
 * Returns { lines, done }. With reduced motion everything appears at once.
 */
export function useTypewriter(allLines, start, reduced, speed = 38) {
  const total = allLines.join('').length;
  const [count, setCount] = useState(reduced ? total : 0);

  useEffect(() => {
    if (!start) return;
    if (reduced) {
      setCount(total);
      return;
    }
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= total) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [start, reduced, total, speed]);

  let left = count;
  const lines = allLines.map((line) => {
    const part = line.slice(0, Math.max(0, left));
    left -= line.length;
    return part;
  });
  return { lines, done: count >= total };
}
