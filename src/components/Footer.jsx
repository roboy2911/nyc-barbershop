import { Link } from 'react-router-dom';
import { useShop } from '../App.jsx';
import { SHOP, telHref } from '../content.js';

export default function Footer() {
  const { data } = useShop();
  const { phone, publicEmail } = data.settings;
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h4>NYC Barbershop</h4>
          {SHOP.addressLines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        <div>
          <h4>Contact</h4>
          <div>
            <a href={telHref(phone)}>{phone}</a>
          </div>
          {publicEmail && (
            <div>
              <a href={`mailto:${publicEmail}`}>{publicEmail}</a>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <a href={SHOP.facebook} target="_blank" rel="noreferrer">Facebook</a> ·{' '}
            <a href={SHOP.instagram} target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
        <div>
          <h4>Quick links</h4>
          <div><Link to="/book">Book an appointment</Link></div>
          <div><Link to="/services">Services &amp; prices</Link></div>
          <div><Link to="/contact">Send us a message</Link></div>
        </div>
      </div>
      <div className="copyright">© {new Date().getFullYear()} NYC Barbershop · Walk-ins welcome</div>
    </footer>
  );
}
