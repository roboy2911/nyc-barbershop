import { REVIEWS } from '../content.js';

// Reviews that slowly scroll sideways. Pauses on hover/touch; stays still for
// people who prefer reduced motion (they can swipe it instead).
export default function ReviewStrip() {
  const card = (r, i, hidden) => (
    <div className="review" key={`${hidden ? 'b' : 'a'}${i}`} aria-hidden={hidden || undefined}>
      <div className="stars" aria-label={hidden ? undefined : `${r.stars} out of 5 stars`}>{'★'.repeat(r.stars)}</div>
      <p>“{r.text}”</p>
      <div className="who">— {r.name}</div>
    </div>
  );
  return (
    <div className="marquee" tabIndex={0} aria-label="Customer reviews">
      <div className="marquee-track" style={{ '--n': REVIEWS.length }}>
        {REVIEWS.map((r, i) => card(r, i, false))}
        {REVIEWS.map((r, i) => card(r, i, true))}
      </div>
    </div>
  );
}
