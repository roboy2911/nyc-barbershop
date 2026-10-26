import { SHOP } from '../content.js';
import Icon from './Icon.jsx';

// "4.9 ★ from 120 Google reviews" once the numbers are filled in (content.js),
// otherwise a plain "Find us on Google" link. Never shows made-up numbers.
export default function GoogleBadge() {
  const { googleRating: rating, googleReviewCount: count } = SHOP;
  return (
    <a className="g-badge" href={SHOP.googleMaps} target="_blank" rel="noreferrer">
      <Icon name="google" size={18} />
      {rating ? (
        <>
          <strong>{Number(rating).toFixed(1)}</strong>
          <span className="g-stars" aria-hidden="true">★★★★★</span>
          <span className="muted">{count ? `${count} Google reviews` : 'on Google'}</span>
        </>
      ) : (
        <span>Find us on Google</span>
      )}
    </a>
  );
}
