import { Link } from 'react-router';
import { profile } from '../data/content.js';
import { OBJECTS, SECTIONS } from '../data/sections.js';
import { ResumeButton } from './ResumeButton.jsx';
import './IntroPanel.css';

/** Home: short intro that's readable in ~3 seconds, plus a text "map" of the desk. */
export function IntroPanel({ hidden, onExplore, onToast }) {
  return (
    <section id="intro" className="intro" aria-labelledby="intro-name" data-hidden={hidden} inert={hidden ? true : undefined} tabIndex={-1}>
      <div className="intro__bar" aria-hidden="true">
        hello.txt
      </div>
      <div className="intro__body">
        <p className="pixel-label">Hi, I'm</p>
        <h1 id="intro-name" className="intro__name">
          {profile.name}
        </h1>
        <p className="intro__role">{profile.role}</p>
        <p className="intro__school">{profile.school}</p>
        <p className="intro__line">{profile.oneLiner}</p>

        <ul className="chips" aria-label="Areas">
          {profile.areas.map((a) => (
            <li key={a} className="chip">
              {a}
            </li>
          ))}
        </ul>

        <div className="intro__actions">
          <button type="button" className="btn" onClick={onExplore}>
            Explore the desk
          </button>
          <Link to={SECTIONS.projects.path} className="btn btn--ghost">
            View projects
          </Link>
          <ResumeButton onToast={onToast} className="btn btn--ghost" />
        </div>

        <p className="intro__tip">Tip: click an object to open it, or hold and drag the room to turn it.</p>

        <nav className="intro__map" aria-label="Desk map">
          <p className="pixel-label">Desk map</p>
          <ul>
            {OBJECTS.filter((o) => o.section).map((o) => (
              <li key={o.id}>
                <Link to={SECTIONS[o.section].path}>
                  <span className="intro__obj">{o.id}</span>
                  <span aria-hidden="true"> → </span>
                  {SECTIONS[o.section].label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
