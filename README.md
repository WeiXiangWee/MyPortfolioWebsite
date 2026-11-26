# wx · The Workbench

Portfolio site for **wx**, a full-stack student who connects design, code and deployment, turning rough ideas into working products.

The site is a cosy pixel-art room at dusk, built as a real 3D diorama with CSS 3D transforms. Hold the mouse button and drag to turn the room; let go and it eases back. Each object on the desk opens a section in a retro OS-style window. A plain text menu at the top does the same for anyone who doesn't want to explore the room.

Built with **React (Vite), JavaScript and plain CSS** only. No animation or UI libraries; motion uses CSS transitions, transforms, `IntersectionObserver` and small React hooks. React Router handles the URLs.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run art      # rebuild the 3D room textures, cursors, favicon and sounds
```

## Where things live

| What | File |
| --- | --- |
| **All text content** (placeholders in `[BRACKETS]`) | `src/data/content.js` |
| Which object opens which section + URLs | `src/data/sections.js` |
| Design tokens: colours, fonts, sizes, motion | `src/styles/tokens.css` |
| 3D room: camera, drag to turn, zoom, clickable objects | `src/components/Room.jsx`, `Room.css` |
| Retro window (focus trap, Esc, scroll) | `src/components/RetroWindow.jsx` |
| Section contents | `src/sections/*.jsx` |
| 3D room builder (shapes + pixel textures) | `scripts/build-room3d.mjs` |
| Face positions + texture atlas (generated) | `src/scene/scene3d.js`, `public/room3d/` |

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

The floppy disk on the desk is the **Download CV** button, and clicking the **floor lamp** switches its warm light on and off. Click the **gaming chair** and it swivels round to face you, revealing the poodle on the seat; click the **poodle** and it barks (sound plays when the speaker in the top bar is on).

The speaker button also plays quiet background music (`public/music/dusk-lofi-loop.mp3`, looped without gaps). It plays at 25% volume, just under the sound effects, and dips to half whenever an effect plays. To change its level, edit `MUSIC_VOLUME` in `src/hooks/backgroundMusic.js`. The desk clock shows the real time in Singapore, and that time sets the sky outside the window (dawn / day / dusk / night). Add `?sky=day` (or `dawn`, `dusk`, `night`) to any URL to preview another sky.

## How the 3D room works

`scripts/build-room3d.mjs` describes the room as boxes and flat panels in "room units" (the room is 160 × 130 units, 130 high). For every visible face it paints a small pixel-art texture (2 art pixels per unit) using dithered light and shadow, 1px edge highlights and ambient shadows, then packs all textures into one atlas (`public/room3d/atlas.png`). It writes each face's size, atlas position and `matrix3d` placement to `src/scene/scene3d.js`.

`Room.jsx` renders each face as a `div` inside a CSS 3D camera (`perspective` + `rotateX` + `rotateZ`). The browser does the rest: depth sorting, perspective and real parallax when you drag. The camera always looks from the open front of the room, so only the top, front and right side of each box are drawn.

- The **sky and city** are a separate panel outside the window, so they shift behind the glass as the room turns.
- **Plants** are two crossed see-through panels; tooltips and the lamp's halo always turn to face you.
- The **monitor text** and **desk clock** are real HTML laid onto 3D faces.
- To change the room, edit `build-room3d.mjs` and run `npm run art`. Image URLs get a `?v=` fingerprint, so browsers always pick up new art.

## Filling in content

Open `src/data/content.js` and replace each `[PLACEHOLDER]`. Each project has a `categories` list; the names come from `projectCategories`, which sets the filter buttons under the Projects heading (a button only appears once a project uses it, and the chosen filter shows in the URL, e.g. `/portfolio/projects?category=devops`). Placeholders show on the site with a dashed underline. Links that are still placeholders render as plain text, so the site never ships a broken link. Images (`screenshot`, `avatar`) and the CV (`resumeUrl`) take paths to files in `public/`, e.g. `'/resume.pdf'`.

In `index.html`, set `og:image` and `og:url` once the site has a live URL.

## Accessibility

- Every room object is a labelled button (`role="button"`), reachable by Tab and opened with Enter or Space; its faces show an `--color-accent-2` ring on focus.
- Windows trap focus, close with Esc / x / the dimmed background, and return focus to the object that opened them.
- `prefers-reduced-motion` turns off drag-to-turn, the zoom animation, typing and reveals; windows just appear.
- All text colours pass WCAG AA against their backgrounds.

## Hidden extra

Type ↑ ↑ ↓ ↓ ← → ← → B A anywhere.

## Deploy

`vercel.json` (Vercel) and `public/_redirects` (Netlify) send every URL to `index.html`, so links like `/about` work when opened directly.
