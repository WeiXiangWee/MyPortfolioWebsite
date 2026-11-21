import { useReveal } from '../hooks/useReveal.js';

/** Wraps a tile so it slides up and fades in when scrolled into view. */
export function Reveal({ as: Tag = 'div', index = 0, className = '', children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={`reveal${shown ? ' is-shown' : ''} ${className}`} style={{ '--i': index }} {...rest}>
      {children}
    </Tag>
  );
}
