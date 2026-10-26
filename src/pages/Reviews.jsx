import { Link } from 'react-router-dom';
import { REVIEWS, SHOP } from '../content.js';

export default function Reviews() {
  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Reviews</h1>
          <p>What our customers say</p>
        </div>
      </div>
      <div className="container page">
        <div className="reviews">
          {REVIEWS.map((r, i) => (
            <div className="review" key={i}>
              <div className="stars" aria-label={`${r.stars} out of 5 stars`}>{'★'.repeat(r.stars)}</div>
              <p>“{r.text}”</p>
              <div className="who">— {r.name}</div>
            </div>
          ))}
        </div>
        <div className="card center" style={{ marginTop: 36 }}>
          <h3>Been in for a cut?</h3>
          <p className="muted">We'd really appreciate a quick review – it helps other locals find us.</p>
          <div className="review-cta">
            <a className="btn" href={SHOP.googleReview} target="_blank" rel="noreferrer">★ Review us on Google</a>
            <a className="btn ghost" href={SHOP.googleMaps} target="_blank" rel="noreferrer">See us on Google Maps</a>
          </div>
        </div>
        <div className="center" style={{ marginTop: 24 }}>
          <Link className="btn ghost" to="/book">Book your cut</Link>
        </div>
      </div>
    </>
  );
}
