import { profile } from '../data/content.js';
import { isPlaceholder } from './Placeholder.jsx';
import { PixelIcon } from './PixelIcon.jsx';

/** "Download CV". Until the PDF is added it explains that instead of linking nowhere. */
export function ResumeButton({ onToast, className = 'btn' }) {
  if (isPlaceholder(profile.resumeUrl)) {
    return (
      <button type="button" className={className} aria-disabled="true" onClick={() => onToast(`${profile.resumeUrl} not added yet`)}>
        <PixelIcon name="download" size={14} />
        Download CV
      </button>
    );
  }
  return (
    <a className={className} href={profile.resumeUrl} download>
      <PixelIcon name="download" size={14} />
      Download CV
    </a>
  );
}
