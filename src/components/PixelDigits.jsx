// 3x5 pixel font for the desk clock (digits and colon only).
const GLYPHS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  ':': ['.', '#', '.', '#', '.'],
};

/** Renders text like "21:04" as crisp pixel digits (SVG). */
export function PixelDigits({ text }) {
  const rects = [];
  let x = 0;
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, y) =>
      [...row].forEach((c, dx) => {
        if (c === '#') rects.push(<rect key={`${i}-${y}-${dx}`} x={x + dx} y={y} width="1" height="1" className={ch === ':' ? 'blink-colon' : undefined} />);
      }),
    );
    x += g[0].length + 1;
  });
  const width = x - 1;
  return (
    <svg viewBox={`0 0 ${width} 5`} width={width} height="5" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      {rects}
    </svg>
  );
}
