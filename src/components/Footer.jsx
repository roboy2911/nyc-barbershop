import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import { SHOP, telHref } from '../content.js';
import Icon from './Icon.jsx';
import { DAY_NAMES, getDayHours, minToLabel, qldNow, addDays, dowOf } from '../../supabase/functions/_shared/availability.js';

export default function Footer() {
  const { data } = useShop();
  const { phone, publicEmail } = data.settings;
  const today = qldNow().date;
  // This week's hours, Monday first.
  const monday = addDays(today, -((dowOf(today) + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <footer className="site-footer">
      <div className="stripe" aria-hidden="true" />
      <div className="container footer-grid" style={{ paddingTop: 36 }}>
        <div>
          <img src={`${import.meta.env.BASE_URL}logo-small.png`} width={56} height={56} alt="" style={{ marginBottom: 10 }} />
          <h4>NYC Barbershop</h4>
          {SHOP.addressLines.map((l) => (
            <div key={l}>{l}</div>
          ))}
          <div className="foot-social">
            <a href={SHOP.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Icon name="instagram" /></a>
            <a href={SHOP.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Icon name="facebook" /></a>
            <a href={SHOP.googleMaps} target="_blank" rel="noreferrer" aria-label="Google Maps"><Icon name="google" /></a>
          </div>
        </div>
        <div>
          <h4>Opening hours</h4>
          <table className="foot-hours">
            <tbody>
              {week.map((d) => {
                const h = getDayHours(data, d);
                return (
                  <tr key={d} className={d === today ? 'today' : ''}>
                    <td>{DAY_NAMES[dowOf(d)].slice(0, 3)}</td>
                    <td>{h.closed ? 'Closed' : `${minToLabel(h.openMin)} – ${minToLabel(h.closeMin)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h4>Contact</h4>
          <div className="foot-line"><Icon name="phone" size={16} /><a href={telHref(phone)}>{phone}</a></div>
          {publicEmail && <div className="foot-line"><Icon name="mail" size={16} /><a href={`mailto:${publicEmail}`}>{publicEmail}</a></div>}
          <h4 style={{ marginTop: 18 }}>Quick links</h4>
          <div><Link to="/book">Book an appointment</Link></div>
          <div><Link to="/services">Services &amp; prices</Link></div>
          <div><Link to="/reviews">Reviews</Link></div>
          <div><Link to="/contact">Send us a message</Link></div>
          <Link to="/book" className="btn sm" style={{ marginTop: 14 }}>Book now</Link>
        </div>
      </div>
      <div className="copyright">© {new Date().getFullYear()} NYC Barbershop · Coomera, Gold Coast · Walk-ins welcome</div>
    </footer>
  );
}
