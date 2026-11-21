import { contact } from '../data/content.js';
import { SmartLink, isPlaceholder } from '../components/Placeholder.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { ResumeButton } from '../components/ResumeButton.jsx';

export function Contact({ onToast }) {
  const mail = isPlaceholder(contact.email) ? contact.email : `mailto:${contact.email}`;
  return (
    <>
      <div className="section-head">
        <p className="pixel-label">Contact</p>
        <h3>Say hello</h3>
        <p>Open to internships and projects. The fastest way to reach me is email.</p>
      </div>
      <ul className="bento">
        <Reveal as="li" className="tile tile--full contact-tile" index={0}>
          <h4>Email</h4>
          <SmartLink href={mail} icon="mail" className="contact-link">
            {isPlaceholder(contact.email) ? 'Email' : contact.email}
          </SmartLink>
        </Reveal>
        <Reveal as="li" className="tile contact-tile" index={1}>
          <h4>LinkedIn</h4>
          <SmartLink href={contact.linkedin} icon="linkedin" className="contact-link">
            LinkedIn profile
          </SmartLink>
        </Reveal>
        <Reveal as="li" className="tile contact-tile" index={2}>
          <h4>GitHub</h4>
          <SmartLink href={contact.github} icon="github" className="contact-link">
            GitHub profile
          </SmartLink>
        </Reveal>
        <Reveal as="li" className="tile tile--full contact-tile" index={3}>
          <h4>Resume</h4>
          <div>
            <ResumeButton onToast={onToast} />
          </div>
        </Reveal>
      </ul>
    </>
  );
}
