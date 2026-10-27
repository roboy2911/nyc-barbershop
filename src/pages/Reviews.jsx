import { Link } from 'react-router-dom';
import { SHOP, reviewUrl } from '../content.js';
import { useShop } from '../App.jsx';
import GoogleBadge from '../components/GoogleBadge.jsx';
import Icon from '../components/Icon.jsx';

export default function Reviews() {
  const { data } = useShop();
  const REVIEWS = data.reviews || [];
  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Reviews</h1>
          <p>What our customers say</p>
        </div>
      </div>
      <div className="container page">
        <div className="center" style={{ marginBottom: 24 }}><GoogleBadge /></div>
        {!REVIEWS.length && <p className="center muted">No reviews yet – be the first!</p>}
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
            <a className="btn" href={reviewUrl(data.settings)} target="_blank" rel="noreferrer"><Icon name="google" size={16} /> Review us on Google</a>
          </div>
        </div>
        <div className="center" style={{ marginTop: 24 }}>
          <Link className="btn ghost" to="/book">Book your cut</Link>
        </div>
      </div>
    </>
  );
}
