// How the room objects, URLs and windows connect.
// (Text content is in content.js; this file is the site's "map".)

export const SECTIONS = {
  about: { path: '/about', label: 'About', title: 'about.exe', object: 'headphones' },
  skills: { path: '/skills', label: 'Skills', title: 'skills.exe', object: 'pegboard' },
  projects: { path: '/portfolio/projects', label: 'Projects', title: 'portfolio/projects.exe', object: 'monitor', tab: true },
  certifications: { path: '/portfolio/certifications', label: 'Certifications', title: 'portfolio/certs.exe', object: 'bookshelf', tab: true },
  community: { path: '/portfolio/community', label: 'Community work', title: 'portfolio/community.exe', object: 'notes', tab: true },
  contact: { path: '/contact', label: 'Contact', title: 'contact.exe', object: 'phone' },
};

// The three Portfolio tabs, in order
export const PORTFOLIO_TABS = ['projects', 'certifications', 'community'];

// Clickable things in the room. Order = keyboard Tab order.
export const OBJECTS = [
  { id: 'monitor', section: 'projects', name: 'Ultrawide monitor', tooltip: '> projects.exe' },
  { id: 'headphones', section: 'about', name: 'Headphones on a stand', tooltip: '> about.exe' },
  { id: 'bookshelf', section: 'certifications', name: 'Wall shelf with books', tooltip: '> certs.exe' },
  { id: 'pegboard', section: 'skills', name: 'Pegboard with tools', tooltip: '> skills.exe' },
  { id: 'notes', section: 'community', name: 'Corkboard with sticky notes and a photo', tooltip: '> community.exe' },
  { id: 'phone', section: 'contact', name: 'Desk phone', tooltip: '> contact.exe' },
  { id: 'floppy', action: 'resume', name: 'Floppy disk', tooltip: '> download_cv.pdf' },
];

/** Which window a URL opens. null = home (no window), 'notfound' = 404 window. */
export function sectionFromPath(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return null;
  if (clean === '/portfolio') return 'projects';
  const hit = Object.entries(SECTIONS).find(([, s]) => s.path === clean);
  return hit ? hit[0] : 'notfound';
}

/** Which room object the camera zooms into for a window. */
export function objectForKey(key) {
  if (key === 'terminal' || key === 'notfound') return 'monitor';
  return SECTIONS[key]?.object ?? null;
}
