import { skills } from '../data/content.js';
import { Txt } from '../components/Placeholder.jsx';
import { Reveal } from '../components/Reveal.jsx';

export function Skills() {
  return (
    <>
      <div className="section-head">
        <p className="pixel-label">Pegboard</p>
        <h3>Skills</h3>
        <p>The tools I reach for, grouped by area.</p>
      </div>

      <div className="bento">
        <Reveal className="tile tile--full" index={0}>
          <h4>Core stack</h4>
          <ul className="chips">
            {skills.stack.map((s) => (
              <li key={s} className="chip">
                <Txt>{s}</Txt>
              </li>
            ))}
          </ul>
        </Reveal>

        {skills.byArea.map((group, i) => (
          <Reveal key={group.area} className={`tile ${i < 3 ? 'tile--narrow' : ''}`} index={i + 1}>
            <h4>{group.area}</h4>
            <ul className="chips">
              {group.items.map((s) => (
                <li key={s} className="chip">
                  <Txt>{s}</Txt>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </>
  );
}
