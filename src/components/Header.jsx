import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services & Prices' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
];

export default function Header({ admin }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <nav className="container nav" aria-label="Main">
        <Link to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}logo-small.png`} width={44} height={44} alt="" />
          <span>NYC BARBERSHOP{admin ? ' · ADMIN' : ''}</span>
        </Link>
        {!admin && (
          <>
            <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
              ☰
            </button>
            <ul className={`nav-links${open ? ' open' : ''}`}>
              {LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end} onClick={() => setOpen(false)}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to="/book" className="cta" onClick={() => setOpen(false)}>
                  Book Now
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>
    </header>
  );
}
