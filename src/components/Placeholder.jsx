import { PixelIcon } from './PixelIcon.jsx';

/** true for unfinished content like "[PROJECT NAME]" */
export const isPlaceholder = (value) => typeof value === 'string' && /^\[.*\]$/.test(value.trim());

/** Shows text, or a clearly marked placeholder if it's still "[LIKE THIS]". */
export function Txt({ children }) {
  return isPlaceholder(children) ? <em className="ph">{children}</em> : children;
}

/**
 * Outbound link. While the URL is still a placeholder it renders as non-clickable text,
 * so we never ship a broken or invented link.
 */
export function SmartLink({ href, children, icon = 'external', className = '' }) {
  if (isPlaceholder(href)) {
    return (
      <span className={`smart-link smart-link--todo ${className}`} title={`${href} not added yet`}>
        <PixelIcon name={icon} size={14} />
        {children} <em className="ph">{href}</em>
      </span>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a className={`smart-link ${className}`} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <PixelIcon name={icon} size={14} />
      {children}
      {external && <span className="visually-hidden"> (opens in a new tab)</span>}
    </a>
  );
}
