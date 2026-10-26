import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Icon from './Icon.jsx';

// Haircut photos with a full-screen viewer. Shows placeholders until the
// owner uploads photos in Admin -> Photos.
export default function Gallery({ placeholders = 6, limit }) {
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(null);
  const touch = useRef(null);

  useEffect(() => {
    api.listGallery().then(setPhotos).catch(() => setPhotos([]));
  }, []);

  const total = photos?.length || 0;
  const go = useCallback((d) => setOpen((i) => (i == null ? i : (i + d + total) % total)), [total]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, go]);

  if (photos === null) {
    return <div className="gallery">{Array.from({ length: 6 }, (_, i) => <div key={i} className="ph skeleton" />)}</div>;
  }

  if (!photos.length) {
    return (
      <div className="gallery">
        {Array.from({ length: placeholders }, (_, i) => (
          <div className="ph" key={i}>
            <Icon name="scissors" size={30} />
            Photo coming soon
          </div>
        ))}
      </div>
    );
  }

  const shown = limit ? photos.slice(0, limit) : photos;
  const cur = open != null ? photos[open] : null;

  return (
    <>
      <div className="gallery">
        {shown.map((p, i) => (
          <button key={p.id} className="gal-item" onClick={() => setOpen(i)} aria-label={p.caption || `Open photo ${i + 1}`}>
            <img src={p.thumbUrl} alt={p.caption || 'Haircut at NYC Barbershop'} loading="lazy" decoding="async" />
            {p.caption && <span className="gal-cap">{p.caption}</span>}
          </button>
        ))}
      </div>
      {limit && photos.length > limit && (
        <p className="center muted small" style={{ marginTop: 12 }}>
          <button className="link-btn" onClick={() => setOpen(limit)}>See all {photos.length} photos</button>
        </p>
      )}

      {cur && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <img src={cur.url} alt={cur.caption || 'Haircut at NYC Barbershop'} onClick={(e) => e.stopPropagation()} />
          {cur.caption && <div className="lb-cap">{cur.caption}</div>}
          <div className="lb-count">{open + 1} / {total}</div>
          <button className="lb-btn lb-close" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" size={22} /></button>
          {total > 1 && (
            <>
              <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous photo"><Icon name="left" size={26} /></button>
              <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next photo"><Icon name="right" size={26} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}
