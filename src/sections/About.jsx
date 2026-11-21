import { Link } from 'react-router';
import { profile } from '../data/content.js';
import { Txt, isPlaceholder } from '../components/Placeholder.jsx';
import { Reveal } from '../components/Reveal.jsx';

export function About() {
  return (
    <>
      <div className="section-head">
        <p className="pixel-label">About</p>
        <h3>Who I am</h3>
        <p>
          {profile.role} · {profile.school}
        </p>
      </div>

      <div className="bento">
        <Reveal className="tile tile--narrow" index={0}>
          {isPlaceholder(profile.avatar) ? (
            <div className="img-placeholder" style={{ aspectRatio: '1' }}>
              {profile.avatar}
            </div>
          ) : (
            <img src={profile.avatar} alt={`Portrait of ${profile.name}`} style={{ width: '100%', imageRendering: 'pixelated' }} />
          )}
        </Reveal>

        <Reveal className="tile tile--wide" index={1}>
          <h4>My story</h4>
          <p>
            <Txt>{profile.story}</Txt>
          </p>
        </Reveal>

        <Reveal className="tile" index={2}>
          <h4>What I do</h4>
          <p>{profile.oneLiner}</p>
        </Reveal>

        <Reveal className="tile" index={3}>
          <h4>Areas of study</h4>
          <ul className="chips">
            {profile.areas.map((a) => (
              <li key={a} className="chip">
                {a}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="tile tile--wide" index={4}>
          <h4>Interests</h4>
          <p>
            <Txt>{profile.interests}</Txt>
          </p>
        </Reveal>

        <Reveal className="tile tile--narrow" index={5}>
          <h4>Next</h4>
          <p>
            <Link to="/skills">See my skills</Link>
          </p>
          <p>
            <Link to="/portfolio/projects">Browse projects</Link>
          </p>
        </Reveal>
      </div>
    </>
  );
}
