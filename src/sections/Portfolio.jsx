import { useNavigate } from 'react-router';
import { useRef } from 'react';
import { PORTFOLIO_TABS, SECTIONS } from '../data/sections.js';
import { projects, certifications, community } from '../data/content.js';
import { Txt, SmartLink, isPlaceholder } from '../components/Placeholder.jsx';
import { Reveal } from '../components/Reveal.jsx';

/** Portfolio window: tabs for Projects / Certifications / Community work (second navigation level). */
export function Portfolio({ tab }) {
  const navigate = useNavigate();
  const tabRefs = useRef({});

  // Arrow keys move between tabs (standard tab pattern)
  const onKeyDown = (e) => {
    const i = PORTFOLIO_TABS.indexOf(tab);
    let next = null;
    if (e.key === 'ArrowRight') next = PORTFOLIO_TABS[(i + 1) % PORTFOLIO_TABS.length];
    if (e.key === 'ArrowLeft') next = PORTFOLIO_TABS[(i - 1 + PORTFOLIO_TABS.length) % PORTFOLIO_TABS.length];
    if (e.key === 'Home') next = PORTFOLIO_TABS[0];
    if (e.key === 'End') next = PORTFOLIO_TABS[PORTFOLIO_TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    navigate(SECTIONS[next].path);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Portfolio" onKeyDown={onKeyDown}>
        {PORTFOLIO_TABS.map((key) => (
          <button
            key={key}
            ref={(el) => (tabRefs.current[key] = el)}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            className="tabs__tab"
            onClick={() => navigate(SECTIONS[key].path)}
          >
            {SECTIONS[key].label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabs__panel" key={tab}>
        {tab === 'projects' && <Projects />}
        {tab === 'certifications' && <Certifications />}
        {tab === 'community' && <Community />}
      </div>
    </>
  );
}

const SPANS = ['tile--wide', 'tile--narrow', 'tile--narrow', 'tile--wide'];

function Projects() {
  return (
    <>
      <div className="section-head">
        <h3>Projects</h3>
        <p>Problem, my role, the tech and the result for each build.</p>
      </div>
      <ul className="bento">
        {projects.map((p, i) => (
          <Reveal as="li" key={p.id} className={`tile project ${SPANS[i % SPANS.length]}`} index={i}>
            {isPlaceholder(p.screenshot) ? (
              <div className="img-placeholder">{p.screenshot}</div>
            ) : (
              <img className="project__shot" src={p.screenshot} alt={p.screenshotAlt} loading="lazy" />
            )}
            <h4>
              <Txt>{p.name}</Txt>
            </h4>
            <dl className="facts">
              <dt>Problem</dt>
              <dd>
                <Txt>{p.problem}</Txt>
              </dd>
              <dt>My role</dt>
              <dd>
                <Txt>{p.role}</Txt>
              </dd>
              <dt>Tech used</dt>
              <dd>
                <ul className="chips">
                  {p.tech.map((t) => (
                    <li key={t} className="chip">
                      <Txt>{t}</Txt>
                    </li>
                  ))}
                </ul>
              </dd>
              <dt>Result</dt>
              <dd>
                <Txt>{p.result}</Txt>
              </dd>
            </dl>
            <div className="links-row">
              <SmartLink href={p.github} icon="github">
                GitHub
              </SmartLink>
              <SmartLink href={p.demo}>Live demo</SmartLink>
            </div>
          </Reveal>
        ))}
      </ul>
    </>
  );
}

function Certifications() {
  return (
    <>
      <div className="section-head">
        <h3>Certifications</h3>
        <p>Courses and certificates from the shelf.</p>
      </div>
      <ul className="bento">
        {certifications.map((c, i) => (
          <Reveal as="li" key={c.id} className="tile" index={i}>
            <h4>
              <Txt>{c.name}</Txt>
            </h4>
            <dl className="facts">
              <dt>Issuer</dt>
              <dd>
                <Txt>{c.issuer}</Txt>
              </dd>
              <dt>Date</dt>
              <dd>
                <Txt>{c.date}</Txt>
              </dd>
            </dl>
            <div className="links-row">
              <SmartLink href={c.link}>View certificate</SmartLink>
            </div>
          </Reveal>
        ))}
      </ul>
    </>
  );
}

function Community() {
  return (
    <>
      <div className="section-head">
        <h3>Community work</h3>
        <p>Notes pinned to the corkboard.</p>
      </div>
      <ul className="bento">
        {community.map((c, i) => (
          <Reveal as="li" key={c.id} className="tile" index={i}>
            <h4>
              <Txt>{c.activity}</Txt>
            </h4>
            <dl className="facts">
              <dt>Role</dt>
              <dd>
                <Txt>{c.role}</Txt>
              </dd>
              <dt>Date</dt>
              <dd>
                <Txt>{c.date}</Txt>
              </dd>
            </dl>
            <p>
              <Txt>{c.description}</Txt>
            </p>
          </Reveal>
        ))}
      </ul>
    </>
  );
}
