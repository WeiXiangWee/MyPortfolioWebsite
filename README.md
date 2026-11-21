# wx · The Workbench

Portfolio site for **wx**, a full-stack student who connects design, code and deployment, turning rough ideas into working products.

The site is a cosy isometric pixel-art room at dusk. Hold the mouse button and drag to turn the room; let go and it eases back. Each object on the desk opens a section in a retro OS-style window. A plain text menu at the top does the same for anyone who doesn't want to explore the room.

Built with **React (Vite), JavaScript and plain CSS** only. No animation or UI libraries; motion uses CSS transitions, transforms, `IntersectionObserver` and small React hooks. React Router handles the URLs.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run art      # redraw the pixel room, cursors, favicon and sounds
```

## Where things live

| What | File |
| --- | --- |
| **All text content** (placeholders in `[BRACKETS]`) | `src/data/content.js` |
| Which object opens which section + URLs | `src/data/sections.js` |
| Design tokens: colours, fonts, sizes, motion | `src/styles/tokens.css` |
| Room: drag to turn, zoom, clickable objects | `src/components/Room.jsx`, `Room.css` |
| Retro window (focus trap, Esc, scroll) | `src/components/RetroWindow.jsx` |
| Section contents | `src/sections/*.jsx` |
| Pixel art generator | `scripts/draw-room.mjs` |
| Room positions + hit polygons (generated) | `src/scene/sceneLayout.js` |

## Routes

| URL | Room object | Window |
| --- | --- | --- |
| `/` | none | Home (room + intro) |
| `/about` | Headphones | about.exe |
| `/skills` | Pegboard | skills.exe |
| `/portfolio/projects` | Ultrawide monitor | Portfolio, Projects tab |
| `/portfolio/certifications` | Wall shelf | Portfolio, Certifications tab |
| `/portfolio/community` | Corkboard notes | Portfolio, Community tab |
| `/contact` | Desk phone | contact.exe |
| anything else | Monitor | error.exe (404) |

The floppy disk on the desk is the **Download CV** button, and clicking the **floor lamp** switches its warm light on and off. The desk clock shows the real time in Singapore, and that time sets the sky outside the window (dawn / day / dusk / night). Add `?sky=day` (or `dawn`, `dusk`, `night`) to any URL to preview another sky.

## Replacing the pixel art with your own

The room in `public/room/` is placeholder art drawn by `scripts/draw-room.mjs` on a 2:1 isometric grid (canvas 800 × 640, shown at whole-number scales so pixels stay crisp). It uses dithered light and shadow, 1px edge highlights and dark inner outlines. To use your own Piskel/Figma drawings:

1. Keep the same file names. `walls.png`, `lamp-glow.png`, `furniture.png` and `decor.png` are full 800 × 640 layers. Each `obj-*.png` is cropped to its object (the lamp has `obj-lamp.png` for on and `obj-lamp-off.png` for off).
2. If an object's shape or position changes, update its `x`, `y`, `polygon` (clickable area) and `center` (zoom target) in `src/scene/sceneLayout.js`.
3. Leave the window glass transparent in `walls.png`, because the CSS sky shows through it.

## Filling in content

Open `src/data/content.js` and replace each `[PLACEHOLDER]`. Placeholders show on the site with a dashed underline. Links that are still placeholders render as plain text, so the site never ships a broken link. Images (`screenshot`, `avatar`) and the CV (`resumeUrl`) take paths to files in `public/`, e.g. `'/resume.pdf'`.

In `index.html`, set `og:image` and `og:url` once the site has a live URL.

## Accessibility

- Every room object is a real `<button>` with a label, reachable by Tab, with an `--color-accent-2` outline on focus.
- Windows trap focus, close with Esc / x / the dimmed background, and return focus to the object that opened them.
- `prefers-reduced-motion` turns off drag-to-turn, the zoom animation, typing and reveals; windows just appear.
- All text colours pass WCAG AA against their backgrounds.

## Hidden extra

Type ↑ ↑ ↓ ↓ ← → ← → B A anywhere.

## Deploy

`vercel.json` (Vercel) and `public/_redirects` (Netlify) send every URL to `index.html`, so links like `/about` work when opened directly.
