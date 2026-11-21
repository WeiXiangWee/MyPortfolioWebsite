import { useLocation } from 'react-router';

/** 404: retro error window. The "Back to desk" button is in the window footer. */
export function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="terminal-block">
      <p>
        <span className="term-prompt">&gt;</span> open {pathname}
      </p>
      <p className="term-error">&gt; error: file not found</p>
      <p className="term-muted">This page doesn't exist on the desk. It may have moved, or the link has a typo.</p>
    </div>
  );
}
