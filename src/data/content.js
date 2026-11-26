// =====================================================================
// ALL SITE CONTENT LIVES HERE. Edit this file only. No component changes needed.
// Anything in [SQUARE BRACKETS] is a placeholder that still needs real content.
// Placeholders show up on the site with a dashed underline so they're easy to spot.
// =====================================================================

export const profile = {
  name: "wx",
  role: "Full-Stack Developer",
  school: "Year 2 student at Republic Polytechnic",
  oneLiner:
    "A full-stack developer who connects design, code and deployment, turning rough ideas into working products.",
  story: "[YOUR STORY]",
  interests: "[YOUR INTERESTS]",
  avatar: "[PHOTO OR PIXEL AVATAR]", // later: an image path like '/avatar.png'
  areas: [
    "Web development",
    "DevOps",
    "Data analytics",
    "AI / automation",
    "Design",
  ],
  resumeUrl: "[RESUME PDF]", // later: put the PDF in /public and write '/resume.pdf'
};

export const contact = {
  email: "[EMAIL]",
  linkedin: "[LINKEDIN URL]",
  github: "[GITHUB URL]",
};

// Lines typed on the monitor when the site opens
export const monitorIntro = [
  "> whoami",
  `${profile.name}: ${profile.role.toLowerCase()}`,
  "> cat focus.txt",
  "design · code · deploy",
];

export const skills = {
  stack: ["React", "JavaScript", "CSS", "React Native", "[MORE SKILLS]"],
  // One tile per area from the brief. Add your real tools for each.
  byArea: profile.areas.map((area) => ({ area, items: ["[MORE SKILLS]"] })),
};

const projectPlaceholder = {
  name: "[PROJECT NAME]",
  problem: "[PROBLEM]",
  role: "[YOUR ROLE]",
  tech: ["[TECH USED]"],
  result: "[RESULT]",
  screenshot: "[SCREENSHOT]", // later: an image path like '/projects/app.png'
  screenshotAlt: "[SCREENSHOT ALT TEXT]",
  github: "[GITHUB LINK]",
  demo: "[LIVE DEMO LINK]",
};
// Categories for the filter bar under the Projects heading, in the order they appear.
// A category only shows up once at least one project uses it.
export const projectCategories = [
  "Web development",
  "DevOps",
  "Data analytics",
  "AI / automation",
  "Design",
];

// Placeholder categories so the filter bar has something to show.
// Replace with each project's real categories (one or more names from projectCategories).
const placeholderCategories = [
  ["Web development"],
  ["Web development", "AI / automation"],
  ["DevOps"],
  ["Data analytics"],
];
export const projects = [1, 2, 3, 4].map((n) => ({
  id: `project-${n}`,
  ...projectPlaceholder,
  categories: placeholderCategories[n - 1],
}));

export const certifications = [1, 2, 3].map((n) => ({
  id: `cert-${n}`,
  name: "[CERT NAME]",
  issuer: "[ISSUER]",
  date: "[DATE]",
  link: "[CERT LINK]",
}));

export const community = [1, 2, 3].map((n) => ({
  id: `community-${n}`,
  activity: "[ACTIVITY]",
  role: "[ROLE]",
  date: "[DATE]",
  description: "[WHAT YOU DID]",
}));

// Hidden terminal (Konami code: ↑ ↑ ↓ ↓ ← → ← → B A). Exact surprise: [TBD by wx]
export const easterEgg = {
  greeting: 'wx-term v0.1. type "help" to see commands.',
  hireReply: "permission granted. opening contact.exe ...",
  openContactOnHire: true,
};
