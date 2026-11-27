import { useNavigate, useSearchParams } from 'react-router';
import { useEffect, useRef } from 'react';
import { PORTFOLIO_TABS, SECTIONS } from '../data/sections.js';
import { projects, projectCategories, certifications, certificationCategories, community } from '../data/content.js';
import { useSound } from '../hooks/useSound.jsx';
import { ImageCarousel } from '../components/ImageCarousel.jsx';
import { Txt, SmartLink } from '../components/Placeholder.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { WindowFooterAction } from '../components/RetroWindow.jsx';

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

/** 'AI / automation' -> 'ai-automation' (used in the URL, e.g. /portfolio/projects?category=devops) */
const slugify = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Filter buttons: only categories that at least one item uses, in the order set in content.js */
const categoriesFor = (labels, items) =>
  labels
    .map((label) => ({ label, slug: slugify(label), count: items.filter((x) => x.categories?.includes(label)).length }))
    .filter((c) => c.count > 0);

const PROJECT_CATEGORIES = categoriesFor(projectCategories, projects);
const CERT_CATEGORIES = categoriesFor(certificationCategories, certifications);

/**
 * Shared layout for Projects and Certifications: a category filter bar, a gallery of equal cards,
 * and a detail view for one item. The filter and the open item live in the URL,
 * e.g. /portfolio/projects?project=game-library or /portfolio/certifications?cert=unit-testing-python
 */
function Showcase({ items, categories, plural, openKey, moreLabel, Card, Detail }) {
  const [params, setParams] = useSearchParams();
  const { play } = useSound();
  const active = categories.find((c) => c.slug === params.get('category')) ?? null;
  const shown = active ? items.filter((x) => x.categories?.includes(active.label)) : items;
  const open = items.find((x) => x.id === params.get(openKey)) ?? null;

  // change some search params, keep the rest (replace, so it doesn't fill up the back button)
  const update = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  const choose = (slug) => {
    play('click');
    update({ category: slug, [openKey]: null });
  };

  return (
    <>
      {categories.length > 1 && (
        <div className="filter-bar" role="group" aria-label={`Filter ${plural} by category`}>
          <button type="button" className="filter-bar__btn" aria-pressed={!active} onClick={() => choose(null)}>
            All <span className="filter-bar__count">{items.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="filter-bar__btn"
              aria-pressed={active?.slug === c.slug}
              onClick={() => choose(c.slug)}
            >
              {c.label} <span className="filter-bar__count">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        {active ? `Showing ${shown.length} ${active.label} ${plural}` : `Showing all ${shown.length} ${plural}`}
      </p>

      {/* keyed so the cards slide in again after each switch */}
      <div className="projects" key={`${active?.slug ?? 'all'}-${open?.id ?? ''}`}>
        {!open && (
          <ul className="projects-gallery">
            {shown.map((item, i) => (
              <Reveal as="li" key={item.id} index={i}>
                <button
                  type="button"
                  className="tile project-thumb"
                  onClick={() => {
                    play('open');
                    update({ [openKey]: item.id });
                  }}
                >
                  <Card item={item} />
                  <span className="project-thumb__more">{moreLabel}</span>
                </button>
              </Reveal>
            ))}
          </ul>
        )}

        {open && (
          <DetailView
            id={open.id}
            backLabel={`← All ${plural}`}
            onBack={() => {
              play('close');
              update({ [openKey]: null });
            }}
          >
            <Detail item={open} />
          </DetailView>
        )}
      </div>
    </>
  );
}

/** One item at a time, with a way back to the gallery. Focus moves to the item's heading block. */
function DetailView({ id, backLabel, onBack, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[data-detail-head]')?.focus({ preventScroll: true });
  }, [id]);
  return (
    <article ref={ref} className="project-detail">
      {/* sits in the window footer, next to "Back to desk" */}
      <WindowFooterAction>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          {backLabel}
        </button>
      </WindowFooterAction>
      {children}
    </article>
  );
}

/** Name, then date and categories underneath */
function ItemHead({ item, as: Heading = 'h4' }) {
  return (
    <div className="project__head">
      <Heading className="project__name">
        <Txt>{item.name}</Txt>
      </Heading>
      <p className="project__date">
        {item.date && <Txt>{item.date}</Txt>}
        {item.categories?.length > 0 && <span className="project__cats">{item.categories.join(' · ')}</span>}
      </p>
    </div>
  );
}

/* ---------- Projects ---------- */

function Projects() {
  return (
    <>
      <div className="section-head">
        <h3>Projects</h3>
        <p>Problem, my role, the tech and the result for each build.</p>
      </div>
      <Showcase
        items={projects}
        categories={PROJECT_CATEGORIES}
        plural="projects"
        openKey="project"
        moreLabel="View project →"
        Card={ProjectCard}
        Detail={ProjectDetail}
      />
    </>
  );
}

/** Gallery card picture: the project's first image */
function ProjectShot({ p }) {
  const first = p.images?.[0];
  return first ? (
    <img className="project__shot" src={first.src} alt={first.alt} loading="lazy" />
  ) : (
    <div className="img-placeholder project__shot">[SCREENSHOTS]</div>
  );
}

function ProjectCard({ item }) {
  return (
    <>
      <ProjectShot p={item} />
      <ItemHead item={item} />
    </>
  );
}

function ProjectDetail({ item: p }) {
  return (
    <>
      {p.images?.length ? <ImageCarousel images={p.images} label={p.name} /> : <ProjectShot p={p} />}
      <div className="project-detail__body">
        <div data-detail-head tabIndex={-1} className="project-detail__head">
          <ItemHead item={p} />
          {(p.github || p.demo) && (
            <div className="links-row">
              {p.github && (
                <SmartLink href={p.github} icon="github">
                  GitHub
                </SmartLink>
              )}
              {p.demo && <SmartLink href={p.demo}>{p.demoLabel ?? 'Live demo'}</SmartLink>}
            </div>
          )}
        </div>
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
            <Chips items={p.tech} />
          </dd>
          <dt>Result</dt>
          <dd>
            <Txt>{p.result}</Txt>
          </dd>
        </dl>
      </div>
    </>
  );
}

function Chips({ items }) {
  return (
    <ul className="chips">
      {items.map((t) => (
        <li key={t} className="chip">
          <Txt>{t}</Txt>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Certifications ---------- */

function Certifications() {
  return (
    <>
      <div className="section-head">
        <h3>Certifications</h3>
        <p>Courses and certificates from the shelf.</p>
      </div>
      <Showcase
        items={certifications}
        categories={CERT_CATEGORIES}
        plural="certifications"
        openKey="cert"
        moreLabel="View certificate →"
        Card={CertCard}
        Detail={CertDetail}
      />
    </>
  );
}

/**
 * Certificate picture: the real certificate image when there is one,
 * otherwise a certificate-style card drawn in the site's own style.
 */
function CertCover({ c }) {
  const first = c.images?.[0];
  if (first) return <img className="project__shot" src={first.src} alt={first.alt} loading="lazy" />;
  return (
    <div className="project__shot cert-cover" aria-hidden="true">
      <span className="cert-cover__label">Certificate of completion</span>
      <span className="cert-cover__name">{c.skills?.length ? c.skills.join(' · ') : c.name}</span>
      <span className="cert-cover__issuer">
        {c.issuer} · {c.date}
      </span>
      <span className="cert-cover__seal" />
    </div>
  );
}

function CertCard({ item }) {
  return (
    <>
      <CertCover c={item} />
      <ItemHead item={item} />
    </>
  );
}

function CertDetail({ item: c }) {
  return (
    <>
      {c.images?.length ? <ImageCarousel images={c.images} label={c.name} /> : <CertCover c={c} />}
      <div className="project-detail__body">
        <div data-detail-head tabIndex={-1} className="project-detail__head">
          <ItemHead item={c} />
          {c.link && (
            <div className="links-row">
              <SmartLink href={c.link}>View credential</SmartLink>
            </div>
          )}
        </div>
        <dl className="facts">
          <dt>Issued by</dt>
          <dd>
            <Txt>{c.issuer}</Txt>
          </dd>
          <dt>Completed</dt>
          <dd>
            <Txt>{c.completed ?? c.date}</Txt>
          </dd>
          {(c.length || c.instructor) && (
            <>
              <dt>Course</dt>
              <dd>{[c.length, c.instructor && `taught by ${c.instructor}`].filter(Boolean).join(' · ')}</dd>
            </>
          )}
          {c.credentialId && (
            <>
              <dt>Credential ID</dt>
              <dd className="facts__id">
                <Txt>{c.credentialId}</Txt>
              </dd>
            </>
          )}
          {c.skills?.length > 0 && (
            <>
              <dt>Skills</dt>
              <dd>
                <Chips items={c.skills} />
              </dd>
            </>
          )}
        </dl>
      </div>
    </>
  );
}

/* ---------- Community work ---------- */

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
