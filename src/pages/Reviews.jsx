import { Link } from 'react-router-dom';
import { REVIEWS } from '../content.js';

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
        <div className="center" style={{ marginTop: 36 }}>
          <Link className="btn" to="/book">Book your cut</Link>
        </div>
      </div>
    </>
  );
}
