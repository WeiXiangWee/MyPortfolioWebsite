import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PixelIcon } from './PixelIcon.jsx';
import { useSound } from '../hooks/useSound.jsx';
import './ImageCarousel.css';

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Project pictures: one at a time with previous / next buttons, dots and a counter.
 * Click the picture to open it full screen (a lightbox).
 * images: [{ src, alt, caption }]
 */
export function ImageCarousel({ images, label }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const openerRef = useRef(null);
  const { play } = useSound();
  const count = images.length;
  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count]);

  const image = images[index];
  const many = count > 1;

  return (
    <div className="carousel" role="group" aria-roledescription="carousel" aria-label={`${label} pictures`}>
      <div className="carousel__stage">
        <button
          ref={openerRef}
          type="button"
          className="carousel__open"
          onClick={() => {
            play('open');
            setFull(true);
          }}
          aria-label={`View full screen: ${image.caption ?? image.alt}`}
        >
          <img key={image.src} className="carousel__img" src={image.src} alt={image.alt} />
          <span className="carousel__hint" aria-hidden="true">
            <PixelIcon name="expand" size={12} />
            Full screen
          </span>
        </button>

        {many && (
          <>
            <button type="button" className="carousel__arrow carousel__arrow--prev" onClick={() => { play('click'); go(-1); }} aria-label="Previous picture">
              <PixelIcon name="back" size={14} />
            </button>
            <button type="button" className="carousel__arrow carousel__arrow--next" onClick={() => { play('click'); go(1); }} aria-label="Next picture">
              <PixelIcon name="next" size={14} />
            </button>
          </>
        )}
      </div>

      <div className="carousel__bar">
        <p className="carousel__caption" aria-live="polite">
          {many && <span className="carousel__count">{index + 1} / {count}</span>}
          {image.caption}
        </p>
        {many && (
          <div className="carousel__dots">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                className="carousel__dot"
                aria-label={`Picture ${i + 1}: ${img.caption ?? img.alt}`}
                aria-current={i === index}
                onClick={() => { play('click'); setIndex(i); }}
              />
            ))}
          </div>
        )}
      </div>

      {full && (
        <Lightbox
          images={images}
          index={index}
          onStep={go}
          onClose={() => {
            play('close');
            setFull(false);
            openerRef.current?.focus({ preventScroll: true });
          }}
          label={label}
        />
      )}
    </div>
  );
}

/**
 * Full-screen view. Rendered on <body> so it sits above the room and the window.
 * It handles its own keys first (Esc, arrows, Tab), so Esc closes only the picture, not the window behind it.
 */
function Lightbox({ images, index, onStep, onClose, label }) {
  const ref = useRef(null);
  const titleId = useId();
  const image = images[index];
  const many = images.length > 1;

  useEffect(() => {
    ref.current?.querySelector('.lightbox__close')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowLeft') onStep(-1);
      else if (many && e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'Tab') {
        const items = [...ref.current.querySelectorAll(FOCUSABLE)];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!ref.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
        e.stopImmediatePropagation(); // the window behind keeps its own Tab trap out of this
        return;
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation(); // don't let Esc / arrows reach the window or the room
    };
    window.addEventListener('keydown', onKey, true); // capture: runs before everything else
    return () => window.removeEventListener('keydown', onKey, true);
  }, [many, onStep, onClose]);

  return createPortal(
    // (React events from a portal still bubble to the window and room components, so stop them here)
    <div
      ref={ref}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <h2 id={titleId} className="visually-hidden">
        {label}: {image.caption ?? image.alt}
      </h2>
      <figure className="lightbox__figure" onClick={(e) => e.stopPropagation()}>
        <img key={image.src} className="lightbox__img" src={image.src} alt={image.alt} />
        <figcaption className="lightbox__caption">
          {many && <span className="carousel__count">{index + 1} / {images.length}</span>}
          {image.caption}
        </figcaption>
      </figure>

      <button type="button" className="icon-btn lightbox__close" onClick={onClose} aria-label="Close full screen">
        <PixelIcon name="close" size={14} />
      </button>
      {many && (
        <>
          <button
            type="button"
            className="carousel__arrow lightbox__arrow lightbox__arrow--prev"
            onClick={(e) => { e.stopPropagation(); onStep(-1); }}
            aria-label="Previous picture"
          >
            <PixelIcon name="back" size={16} />
          </button>
          <button
            type="button"
            className="carousel__arrow lightbox__arrow lightbox__arrow--next"
            onClick={(e) => { e.stopPropagation(); onStep(1); }}
            aria-label="Next picture"
          >
            <PixelIcon name="next" size={16} />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
