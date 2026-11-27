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
  // Public copy of the resume (no phone number). The full version stays offline for applications.
  resumeUrl: "/Wee-Wei-Xiang-Resume.pdf",
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

// Categories for the filter bar under the Projects heading, in the order they appear.
// A category only shows up once at least one project uses it.
export const projectCategories = [
  "Web development",
  "Mobile development",
  "DevOps",
  "Data analytics",
  "AI / automation",
  "Design",
];

// Projects, in the order they appear. Each one:
//   name, date, problem, role, tech (list), result, categories (names from projectCategories)
//   images: pictures for the carousel, each { src, alt, caption }. src is a file in /public,
//           e.g. '/projects/app.jpg'. The first one is also the gallery card picture. [] until you have some.
//   github / demo: a full https:// link, a "[PLACEHOLDER]" (shown as plain text), or "" to hide that link
//   demoLabel (optional): text for the demo link instead of "Live demo"
export const projects = [
  {
    id: "rp-sports-booking",
    name: "RP Sports Facility Booking System",
    date: "Jun – Aug 2026",
    categories: ["DevOps", "Web development"],
    problem:
      "Booking a sports facility at Republic Polytechnic was done by hand: there was no online system, no way to see which slots were free, no alerts when a booking was cancelled, and no way for admins to schedule maintenance.",
    role:
      "Team of 5 (C270 DevOps). I built the Search & Availability feature (dynamic time-slot generation, Sunday and public-holiday blocking, Saturday time limits, past-date checks), set up Docker Compose and Trivy security scans, and moved the MySQL database to AWS RDS.",
    tech: ["Node.js", "Express", "EJS", "Bootstrap 5", "MySQL (AWS RDS)", "Docker Compose", "Nginx", "Jenkins", "Ansible", "Trivy", "Jest", "Supertest", "AWS EC2"],
    result:
      "A booking system for RP students and staff with a live availability grid, instant booking, cancellations and admin maintenance scheduling, containerised with Docker and Nginx and deployed to AWS EC2 by a 10-stage Jenkins pipeline that runs the tests and a Trivy vulnerability scan before every release.",
    images: [
      { src: "/projects/rp-sports-booking.jpg", caption: "Home page", alt: "Home page of the RP Sports Facility Booking System: 'Discover Your Sport, Shape Your Future' over the RP sports complex" },
      { src: "/projects/rp-sports-slide-problem.jpg", caption: "The problem", alt: "Problem statement slide: manual booking process, no real-time availability, no cancellation alerts, no maintenance system" },
      { src: "/projects/rp-sports-slide-solution.jpg", caption: "How we solved it", alt: "Slide comparing the old manual way (paper forms, phone calls, delays) with the RP Sports Booking System (instant confirmation, real-time availability, automated notifications)" },
      { src: "/projects/rp-sports-slide-features.jpg", caption: "App idea and unique selling points", alt: "Slide showing the app's home screen surrounded by its selling points: real-time availability, instant confirmation, RP community only, smart notifications, maintenance scheduling" },
      { src: "/projects/rp-sports-slide-search.jpg", caption: "My feature: Search & Availability", alt: "Search and availability slide: filter by facility and date, a time-slot grid, Sunday and public-holiday blocking, Saturday limits, past-date checks and maintenance status" },
      { src: "/projects/rp-sports-slide-admin.jpg", caption: "Admin dashboard", alt: "Admin control panel slide with actions to manage facilities, view all bookings and schedule maintenance" },
      { src: "/projects/rp-sports-slide-maintenance.jpg", caption: "Bonus feature: scheduled maintenance", alt: "Slide showing how scheduling maintenance blocks time slots and cancels affected bookings with a notice to users" },
    ],
    github: "https://github.com/WeiXiangWee/C270-DevOps-Team5",
    demo: "",
  },
  {
    id: "wx-workbench",
    name: "wx · The Workbench",
    date: "Nov 2026 · this website",
    categories: ["Web development", "Design"],
    problem:
      "A template portfolio looks like everyone else's and says little about what I can actually build.",
    role:
      "Solo. I designed and built everything: the 3D pixel-art room, the retro windows, the sound and the React site, plus the wireframes and design system in Figma.",
    tech: ["React", "Vite", "JavaScript", "CSS 3D transforms", "Web Audio API", "React Router", "Figma"],
    result:
      "An explorable pixel-art room where each object on my desk opens a part of my portfolio, with a plain text menu for visitors who want to go straight to the content.",
    images: [
      { src: "/projects/wx-workbench.jpg", caption: "The desk: home page", alt: "The Workbench home page: a pixel-art desk room at dusk next to the hello.txt introduction panel" },
      { src: "/projects/wx-workbench-projects.jpg", caption: "A section window: Projects", alt: "The Projects window open beside the zoomed-in room, with category filters and project cards" },
    ],
    github: "https://github.com/WeiXiangWee/MyPortfolioWebsite",
    demo: "[LIVE DEMO LINK]",
  },
  {
    id: "game-library",
    name: "Game Library App",
    date: "Nov 2026",
    categories: ["Mobile development"],
    problem: "A long list of games is slow to browse when it isn't grouped or searchable.",
    role: "Solo. C346 Mobile App Development exercise on FlatList and SectionList.",
    tech: ["React Native", "Expo", "SectionList", "Expo vector icons"],
    result:
      "A dark-themed app that groups games by genre with colour-coded headers, shows cover art, release year, price and star ratings, and filters live as you search.",
    images: [
      { src: "/projects/game-library.jpg", caption: "Games grouped by genre, with live search", alt: "Game Library app on an Android phone: a search bar, the Action genre header and game cards with cover art, price, year and star ratings" },
    ],
    github: "https://github.com/WeiXiangWee/GameLibraryApp",
    demo: "",
  },
  {
    id: "car-knowledge-quiz",
    name: "Car Knowledge Quiz: Porsche 911 GT3 RS",
    date: "Nov 2026",
    categories: ["Mobile development"],
    problem: "Car fans want a quick, fun way to test how well they really know a specific car.",
    role: "Solo. C346 Mobile App Development exercise (Lesson 6).",
    tech: ["React Native", "Expo", "React useState", "react-native-picker-select"],
    result:
      "A six-question picture quiz on the Porsche 911 GT3 RS (engine, power, torque, acceleration) with dropdown answers, instant scoring and a Porsche-inspired dark red theme.",
    images: [
      { src: "/projects/car-quiz.jpg", caption: "The quiz from start to finish", alt: "Three phone screens of the Car Knowledge Quiz: the first question, answered questions with dropdowns, and the Submit Answers button" },
      { src: "/projects/car-quiz-start.jpg", caption: "Start: picture questions with a dropdown each", alt: "Quiz start screen: 'The 911 GT3 RS' title on dark red, a photo of the car and the question 'What car is this?' with a dropdown" },
      { src: "/projects/car-quiz-answers.jpg", caption: "Answers chosen from the dropdowns", alt: "Quiz questions about the car, engine capacity and power output, each with an answer selected" },
      { src: "/projects/car-quiz-submit.jpg", caption: "Submit to see your score", alt: "The last two questions answered above a red Submit Answers button" },
    ],
    github: "https://github.com/WeiXiangWee/car-knowledge-quiz",
    demo: "",
  },
  {
    id: "islands-of-singapore",
    name: "Islands of Singapore",
    date: "Oct 2026",
    categories: ["Mobile development"],
    problem: "Singapore's offshore islands are easy to overlook, and visitors don't know what makes each one worth a trip.",
    role: "Solo. C346 Mobile App Development exercise (Lesson 4) on reusable components and props.",
    tech: ["React Native", "Expo", "Reusable components & props", "Expo Google Fonts (Poppins)", "Expo vector icons"],
    result:
      "A scrolling guide to six islands, from Pulau Ubin to Sentosa, built from one reusable Island card (name, icon, description and photo) in a calm sea-green theme.",
    images: [
      { src: "/projects/islands-app.jpg", caption: "The guide from top to bottom", alt: "Three phone screens of the Islands of Singapore app: the title with Pulau Ubin, Lazarus and Kusu islands, and Sisters' Islands with Sentosa" },
      { src: "/projects/islands-app-top.jpg", caption: "Title and the first island cards", alt: "App header 'Islands of Singapore' above cards for Pulau Ubin and St John's Island, each with a description and photo" },
      { src: "/projects/islands-app-middle.jpg", caption: "Each card reuses one Island component", alt: "Cards for Lazarus Island and Kusu Island with a sun icon, description and photo" },
      { src: "/projects/islands-app-end.jpg", caption: "The last islands in the list", alt: "Cards for Sisters' Islands and Sentosa with descriptions and photos" },
    ],
    github: "https://github.com/WeiXiangWee/Boat-Island-App",
    demo: "",
  },
  {
    id: "city-in-nature",
    name: "City in Nature: SG Green Plan 2030 Website Design",
    date: "Aug 2026",
    categories: ["Design"],
    problem:
      "Present Singapore's City in Nature vision from the Singapore Green Plan 2030 in a way that feels clear and welcoming for people of all ages.",
    role:
      "Solo design assignment. I designed the home, about, events and contact pages, a logo, custom icons and assets, and an otter chat-sticker set for social media.",
    tech: ["Adobe Photoshop", "Generative Fill", "AI prompt design", "Montserrat"],
    result:
      "A calm, nature-themed website design in a soft green palette, using design principles such as contrast, hierarchy and alignment, with original branding assets to match.",
    images: [
      { src: "/projects/city-in-nature.jpg", caption: "Home page", alt: "City in Nature home page design: 'Building A Greener Singapore Together' with featured initiatives below" },
      { src: "/projects/city-in-nature-about.jpg", caption: "About page", alt: "About page design: the City in Nature vision, its impact and five key strategies on cards" },
      { src: "/projects/city-in-nature-events.jpg", caption: "Events page", alt: "Events page design: upcoming nature events in a zig-zag layout with photos and register buttons" },
      { src: "/projects/city-in-nature-contact.jpg", caption: "Contact page", alt: "Contact page design: a message form beside contact details, with the otter mascot on the phone" },
      { src: "/projects/city-in-nature-logo.jpg", caption: "Logo on different backgrounds", alt: "City in Nature logo, a tree inside a house outline, shown on white, black, transparent and sky backgrounds" },
      { src: "/projects/city-in-nature-stickers.jpg", caption: "Otter chat stickers", alt: "Four otter chat stickers: waving 'Hi!', 'Shiok!!', 'Love Our Planet' hugging the earth, and a smiling otter" },
    ],
    github: "",
    demo: "[DESIGN SLIDES OR FIGMA LINK]",
    demoLabel: "Design slides",
  },
];

// Categories for the filter bar under the Certifications heading (only used ones show up).
export const certificationCategories = ["Web development", "Python", "DevOps", "Networking & IT", "Design"];

// Certifications from LinkedIn Learning and Cisco Networking Academy, shown newest first. Each one:
//   name, issuer, iso (completion date as YYYY-MM-DD, used for sorting), date (shown on the card),
//   completed (full date), length, instructor, skills (list), categories (names from certificationCategories),
//   link (credential URL, or "" for none), credentialId, images: certificate pictures { src, alt, caption }.
//   With no images, a certificate-style card is drawn.
const linkedInLearning = ({ id, iso, name, date, completed, length, instructor, skills, categories, hash }) => ({
  id,
  name,
  issuer: "LinkedIn Learning",
  iso,
  date,
  completed,
  length,
  instructor,
  skills,
  categories,
  link: `https://www.linkedin.com/learning/certificates/${hash}/`,
  credentialId: hash,
  images: [
    {
      src: `/certs/${id}.jpg`,
      caption: "Certificate of completion",
      alt: `LinkedIn Learning certificate of completion for "${name}", awarded to Wee Wei Xiang`,
    },
  ],
});
const linkedInCerts = [
  linkedInLearning({ id: "unit-testing-python", iso: "2026-11-09", name: "Unit Testing in Python", date: "Nov 2026", completed: "9 November 2026", length: "1h 31m", instructor: "Jasmine Omeke", skills: ["Unit Testing", "Python"], categories: ["Python"], hash: "49d9ddaf17c608677a20d63ad5fa0e2687069c803e776dec6b5ffb3cde36ca0d" }),
  linkedInLearning({ id: "nodejs-express-website", iso: "2026-08-14", name: "Building a Website with Node.js and Express.js", date: "Aug 2026", completed: "14 August 2026", length: "3h 10m", instructor: "Daniel Khan", skills: ["Express.js", "Node.js"], categories: ["Web development"], hash: "366cfb30a82046f96d7675355d1b89663dce013556ca72aea6a421d8583b51de" }),
  linkedInLearning({ id: "apis-web-services", iso: "2026-08-13", name: "Programming Foundations: APIs and Web Services", date: "Aug 2026", completed: "13 August 2026", length: "2h 15m", instructor: "Kesha Williams", skills: ["API Development", "Web Services"], categories: ["Web development"], hash: "a67098359da69399787c5887bfc4637ed97584aa663c5c17218e9c0e769f8d80" }),
  linkedInLearning({ id: "javascript-web-forms", iso: "2026-07-22", name: "JavaScript: Web Form Programming", date: "Jul 2026", completed: "22 July 2026", length: "2h 47m", instructor: "Joe Marini", skills: ["JavaScript", "Form Design"], categories: ["Web development"], hash: "d83893c6a390c574c56974430eca99860b72c6463ec74f5cfa3a7cc654bb9d34" }),
  linkedInLearning({ id: "bootstrap-templates", iso: "2026-06-11", name: "Create a Quick, Clean, and Cheap Website with Bootstrap Templates", date: "Jun 2026", completed: "11 June 2026", length: "1h 50m", instructor: "Melanie Panem", skills: ["Bootstrap", "Web Development"], categories: ["Web development"], hash: "f4746b684a9984c6615360eb56e629b97da130fa87fddec69e5a95db72b378f6" }),
  linkedInLearning({ id: "learning-photoshop", iso: "2026-06-10", name: "Learning Photoshop (2023)", date: "Jun 2026", completed: "10 June 2026", length: "3h 18m", instructor: "Jan Kabili", skills: ["Adobe Photoshop"], categories: ["Design"], hash: "0f7833330a6d0dffb66db2a05884e1b0258760e6c3932dc0db3828df08e9caad" }),
  linkedInLearning({ id: "illustrator-quick-start", iso: "2026-06-08", name: "Illustrator 2023 Quick Start", date: "Jun 2026", completed: "8 June 2026", length: "59m", instructor: "Kladi Vergine", skills: ["Adobe Illustrator"], categories: ["Design"], hash: "8b8fb798a8b03bb8169ad90de85fe0c3895832e2fac98154a5584d91a9e86f2d" }),
  linkedInLearning({ id: "pcep-python-prep", iso: "2025-06-27", name: "Certified Entry-Level Python Programmer (PCEP-30-02) Cert Prep", date: "Jun 2025", completed: "27 June 2025", length: "3h 56m", instructor: "Maximiliano Firtman", skills: ["Python"], categories: ["Python"], hash: "6e897e277676da66dea635ff6e9c357d0299cd8370ebd04a97147188a25f29da" }),
];

// Cisco Networking Academy (NetAcad) course certificates, taken at Republic Polytechnic.
// Their certificate pages need a NetAcad login, so there's no public credential link.
const ciscoNetAcad = ({ id, iso, name, date, completed, hours, instructor, skills, categories, certId }) => ({
  id,
  name,
  issuer: "Cisco Networking Academy",
  iso,
  date,
  completed,
  length: `${hours} hours`,
  instructor: `${instructor} (Republic Polytechnic)`,
  skills,
  categories,
  link: "",
  credentialId: certId,
  images: [
    {
      src: `/certs/${id}.jpg`,
      caption: "Certificate of course completion",
      alt: `Cisco Networking Academy certificate awarded to Wee Wei Xiang for completing ${name}, offered by Republic Polytechnic`,
    },
  ],
});
const netAcadCerts = [
  ciscoNetAcad({ id: "devnet-associate", iso: "2026-07-30", name: "DevNet Associate", date: "Jul 2026", completed: "30 July 2026", hours: 70, instructor: "Bernard Leong", skills: ["Python", "DevOps", "Automation", "Application Deployment", "Application Security", "JSON", "Network Infrastructure", "Cloud"], categories: ["DevOps", "Networking & IT"], certId: "f205e1c8-c9a7-427b-97b9-302b77cdbdc9" }),
  ciscoNetAcad({ id: "networking-basics", iso: "2025-08-01", name: "Networking Basics", date: "Aug 2025", completed: "1 August 2025", hours: 22, instructor: "Ivan Wee", skills: ["Network Types", "Network Media", "Wireless Access", "IPv4 Addresses", "Protocols & Standards", "Application Layer Services"], categories: ["Networking & IT"], certId: "393c2e42-1f33-483c-9f34-7ba68ff426b7" }),
  ciscoNetAcad({ id: "computer-hardware-basics", iso: "2025-04-27", name: "Computer Hardware Basics", date: "Apr 2025", completed: "27 April 2025", hours: 6, instructor: "Ivan Wee", skills: ["Personal Computers", "Laptops", "Mobile Devices", "Device Maintenance"], categories: ["Networking & IT"], certId: "9588c0ba-aa42-47ab-9c19-519711600026" }),
];

export const certifications = [...linkedInCerts, ...netAcadCerts].sort((a, b) => b.iso.localeCompare(a.iso));

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
