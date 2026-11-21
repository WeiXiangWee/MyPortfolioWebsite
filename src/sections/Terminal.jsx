import { useEffect, useRef, useState } from 'react';
import { profile, projects, easterEgg } from '../data/content.js';

/** Hidden terminal unlocked by the Konami code. */
export function Terminal({ onHire, onExit }) {
  const [history, setHistory] = useState([{ kind: 'out', text: easterEgg.greeting }]);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [history]);

  const run = (raw) => {
    const cmd = raw.trim().toLowerCase();
    const out = (text, kind = 'out') => ({ kind, text });
    let lines = [];
    switch (cmd) {
      case '':
        break;
      case 'help':
        lines = [out('commands: help, whoami, ls projects, sudo hire wx, clear, exit')];
        break;
      case 'whoami':
        lines = [out(`${profile.name}: ${profile.role.toLowerCase()}`), out(profile.oneLiner)];
        break;
      case 'ls projects':
      case 'ls':
        lines = projects.map((p, i) => out(`${String(i + 1).padStart(2, '0')}  ${p.name}`));
        break;
      case 'sudo hire wx':
        lines = [out(easterEgg.hireReply, 'ok')];
        if (easterEgg.openContactOnHire) setTimeout(onHire, 1200);
        break;
      case 'clear':
        setHistory([]);
        return;
      case 'exit':
        onExit();
        return;
      default:
        lines = [out(`command not found: ${cmd}. try "help"`, 'err')];
    }
    setHistory((h) => [...h, { kind: 'in', text: raw }, ...lines]);
  };

  return (
    <div className="terminal-block" onClick={() => inputRef.current?.focus()}>
      <div aria-live="polite">
        {history.map((line, i) => (
          <p key={i} className={`term-${line.kind}`}>
            {line.kind === 'in' && <span className="term-prompt">wx@workbench:~$ </span>}
            {line.text}
          </p>
        ))}
      </div>
      <form
        className="term-input"
        onSubmit={(e) => {
          e.preventDefault();
          run(value);
          setValue('');
        }}
      >
        <label htmlFor="term" className="term-prompt">
          wx@workbench:~$
        </label>
        <input id="term" ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck="false" />
      </form>
      <div ref={endRef} />
    </div>
  );
}
