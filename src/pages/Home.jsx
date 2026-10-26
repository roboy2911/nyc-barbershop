import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import HoursDropdown from '../components/HoursDropdown.jsx';
import Gallery from '../components/Gallery.jsx';
import Icon, { serviceIcon } from '../components/Icon.jsx';
import GoogleBadge from '../components/GoogleBadge.jsx';
import ReviewStrip from '../components/ReviewStrip.jsx';
import { ABOUT, SHOP, directionsUrl, mapEmbedUrl, reviewUrl, telHref } from '../content.js';
import { money } from './Services.jsx';
import { getDayHours, minToLabel, qldNow } from '../../supabase/functions/_shared/availability.js';

const BASE = import.meta.env.BASE_URL;

function Title({ children, sub }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      <div className="rule" />
      {sub && <p>{sub}</p>}
    </div>
  );
}

function OpenBadge({ data }) {
  const now = qldNow();
  const h = getDayHours(data, now.date);
  const open = !h.closed && now.minutes >= h.openMin && now.minutes < h.closeMin;
  return (
    <span className="badge">
      <span className={`dot ${open ? 'on' : 'off'}`} />
      {open ? `Open now · until ${minToLabel(h.closeMin)}` : 'Closed now'}
    </span>
  );
}

export default function Home() {
  const { data } = useShop();
  const { phone, publicEmail } = data.settings;
  const services = data.services.filter((s) => s.active);
  const thursday = data.weeklyHours.find((w) => w.dow === 4);
  const aboutHeading = data.settings.aboutHeading ?? ABOUT.heading;
  const aboutParas = data.settings.aboutText != null
    ? data.settings.aboutText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : ABOUT.paragraphs;
  const openDays = data.weeklyHours.filter((w) => !w.closed).length;
  const lateThursday = thursday && !thursday.closed && thursday.closeMin >= 1140;

  return (
    <>
      <section className="hero">
        <picture>
          <source srcSet={`${BASE}logo-dark.webp`} type="image/webp" />
          <img className="logo" src={`${BASE}logo-dark.png`} width={560} height={560} alt="NYC Barbershop – Est. 23" fetchPriority="high" />
        </picture>
        <p className="tagline">Coomera · Gold Coast</p>
        <div className="hero-badges">
          <OpenBadge data={data} />
          <span className="badge">Walk-ins welcome</span>
          {lateThursday && <span className="badge">Late nights Thursday</span>}
        </div>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link to="/book" className="btn">Book Now</Link>
          <a href={telHref(phone)} className="btn ghost"><Icon name="phone" size={16} /> {phone}</a>
        </div>
        <a href="#about" className="scroll-cue">
          Scroll<span>⌄</span>
        </a>
      </section>
      <div className="stripe" aria-hidden="true" />

      <div className="highlights">
        <div><Icon name="star" size={22} /><strong>Est. 2023</strong><span>Coomera locals</span></div>
        <div><Icon name="clock" size={22} /><strong>{openDays} days</strong><span>{openDays === 7 ? 'Open every day' : 'Open a week'}</span></div>
        <div><Icon name="walk" size={22} /><strong>Walk-ins</strong><span>Always welcome</span></div>
        <div><Icon name="calendar" size={22} /><strong>24/7</strong><span>Online booking</span></div>
      </div>

      <section className="section" id="about">
        <div className="container about">
          <div className="reveal">
            <h2>About the shop</h2>
            {aboutHeading && (
              <h3 style={{ color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--body)', fontWeight: 600 }}>
                {aboutHeading}
              </h3>
            )}
            {aboutParas.map((p, i) => (
              <p key={i} className="muted">{p}</p>
            ))}
          </div>
          <div className="reveal">
            <h3>Opening hours</h3>
            <HoursDropdown />
            <ul className="info-list" style={{ marginTop: 16 }}>
              <li>
                <span className="ico"><Icon name="phone" /></span>
                <div>
                  <strong>Phone</strong>
                  <a className="phone-link" href={telHref(phone)}>{phone}</a>
                </div>
              </li>
              {publicEmail && (
                <li>
                  <span className="ico"><Icon name="mail" /></span>
                  <div>
                    <strong>Email</strong>
                    <a href={`mailto:${publicEmail}`}>{publicEmail}</a>
                  </div>
                </li>
              )}
              <li>
                <span className="ico"><Icon name="pin" /></span>
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

      <section className="section" id="services">
        <div className="container">
          <Title sub="Simple pricing. Book online or walk in.">Services</Title>
          <div className="svc-mini reveal">
            {services.map((s) => (
              <Link key={s.id} to={`/book?service=${s.id}`} className={s.popular ? 'popular' : ''}>
                {s.popular && <span className="pop-tag">Most popular</span>}
                <span className="svc-ico"><Icon name={serviceIcon(s.name)} size={26} /></span>
                <div className="n">{s.name}</div>
                <div className="p">{money(s.priceCents)}</div>
                <div className="m">{s.duration} mins <span className="go">Book <Icon name="arrow" size={14} /></span></div>
              </Link>
            ))}
          </div>
          <div className="center" style={{ marginTop: 20 }}>
            <Link to="/services" className="btn ghost">Full services &amp; prices</Link>
          </div>
        </div>
      </section>

      <section className="section" id="reviews">
        <div className="container">
          <Title>What customers say</Title>
          <div className="center" style={{ marginTop: -18, marginBottom: 26 }}><GoogleBadge /></div>
        </div>
        <ReviewStrip />
        <div className="container center" style={{ marginTop: 26 }}>
          <div className="review-cta">
            <Link to="/reviews" className="btn ghost">All reviews</Link>
            <a className="btn ghost" href={reviewUrl(data.settings)} target="_blank" rel="noreferrer"><Icon name="google" size={16} /> Review us on Google</a>
          </div>
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="container">
          <Title sub="A few of our recent cuts.">The work</Title>
          <div className="reveal"><Gallery limit={6} /></div>
          <div className="socials" style={{ marginTop: 24 }}>
            <a className="btn ghost" href={SHOP.instagram} target="_blank" rel="noreferrer"><Icon name="instagram" size={16} /> More on Instagram</a>
            <a className="btn ghost" href={SHOP.facebook} target="_blank" rel="noreferrer"><Icon name="facebook" size={16} /> Facebook</a>
          </div>
        </div>
      </section>

      <section className="section" id="location">
        <div className="container">
          <Title sub="Inside Coomera East Shopping Centre, with plenty of parking.">Find us</Title>
          <div className="map-wrap reveal">
            <iframe title="Map showing NYC Barbershop" src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <a className="btn" href={directionsUrl} target="_blank" rel="noreferrer"><Icon name="pin" size={16} /> Get directions</a>
            <a className="btn ghost" href={SHOP.googleMaps} target="_blank" rel="noreferrer">Open in Google Maps</a>
          </div>
        </div>
      </section>

      <div className="stripe" aria-hidden="true" />
      <section className="section center" style={{ borderTop: 0 }}>
        <div className="container reveal">
          <h2>Ready for a fresh cut?</h2>
          <p className="muted">Book online in under a minute, or just walk in.</p>
          <Link to="/book" className="btn">Book Now</Link>
        </div>
      </section>
    </>
  );
}
