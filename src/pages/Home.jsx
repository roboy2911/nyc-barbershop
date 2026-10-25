import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import HoursDropdown from '../components/HoursDropdown.jsx';
import { ABOUT, GALLERY_COUNT, SHOP, directionsUrl, mapEmbedUrl, telHref } from '../content.js';

function Title({ children, sub }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      <div className="rule" />
      {sub && <p>{sub}</p>}
    </div>
  );
}

export default function Home() {
  const { data } = useShop();
  const { phone, publicEmail } = data.settings;
  return (
    <>
      <section className="hero">
        <img className="logo" src={`${import.meta.env.BASE_URL}logo-dark.png`} alt="NYC Barbershop – Est. 23" />
        <p className="tagline">Coomera · Gold Coast · Walk-ins welcome</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link to="/book" className="btn">Book Now</Link>
          <a href={telHref(phone)} className="btn ghost">Call {phone}</a>
        </div>
        <a href="#about" className="scroll-cue">
          Scroll<span>⌄</span>
        </a>
      </section>

      <section className="section" id="about">
        <div className="container about">
          <div>
            <h2>About the shop</h2>
            <h3 style={{ color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--body)', fontWeight: 600 }}>
              {ABOUT.heading}
            </h3>
            {ABOUT.paragraphs.map((p) => (
              <p key={p.slice(0, 20)} className="muted">{p}</p>
            ))}
            <div className="btn-row" style={{ marginTop: 20 }}>
              <Link to="/services" className="btn ghost">Services &amp; prices</Link>
              <Link to="/reviews" className="btn ghost">Reviews</Link>
            </div>
          </div>
          <div>
            <h3>Opening hours</h3>
            <HoursDropdown />
            <ul className="info-list" style={{ marginTop: 16 }}>
              <li>
                <span className="ico">☎</span>
                <div>
                  <strong>Phone</strong>
                  <a className="phone-link" href={telHref(phone)}>{phone}</a>
                </div>
              </li>
              {publicEmail && (
                <li>
                  <span className="ico">✉</span>
                  <div>
                    <strong>Email</strong>
                    <a href={`mailto:${publicEmail}`}>{publicEmail}</a>
                  </div>
                </li>
              )}
              <li>
                <span className="ico">⌖</span>
                <div>
                  <strong>Address</strong>
                  {SHOP.addressLines.map((l) => (
                    <div key={l}>{l}</div>
                  ))}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" id="location">
        <div className="container">
          <Title sub="Inside Coomera East Shopping Centre, with plenty of parking.">Find us</Title>
          <div className="map-wrap">
            <iframe title="Map showing NYC Barbershop" src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <a className="btn" href={directionsUrl} target="_blank" rel="noreferrer">Get directions</a>
          </div>
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="container">
          <Title sub="A few of our recent cuts.">The work</Title>
          <div className="gallery">
            {Array.from({ length: GALLERY_COUNT }, (_, i) => (
              <div className="ph" key={i}>
                <span className="big">✂</span>
                Photo coming soon
              </div>
            ))}
          </div>
          <div className="socials" style={{ marginTop: 24 }}>
            <a className="btn ghost" href={SHOP.instagram} target="_blank" rel="noreferrer">More on Instagram</a>
            <a className="btn ghost" href={SHOP.facebook} target="_blank" rel="noreferrer">Facebook</a>
          </div>
        </div>
      </section>

      <section className="section center">
        <div className="container">
          <h2>Ready for a fresh cut?</h2>
          <p className="muted">Book online in under a minute, or just walk in.</p>
          <Link to="/book" className="btn">Book Now</Link>
        </div>
      </section>
    </>
  );
}
