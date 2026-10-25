import { Component, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { api } from './lib/api.js';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Services from './pages/Services.jsx';
import Book from './pages/Book.jsx';
import Reviews from './pages/Reviews.jsx';
import Contact from './pages/Contact.jsx';
import Cancel from './pages/Cancel.jsx';
import Admin from './pages/admin/Admin.jsx';
import ResetPassword from './pages/admin/ResetPassword.jsx';
import { getDayHours, qldNow, addDays, prettyDate } from '../supabase/functions/_shared/availability.js';

const DataCtx = createContext(null);
export const useShop = () => useContext(DataCtx);

// If a page ever crashes, show a message instead of a blank screen.
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error(err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page center">
        <h2>Something went wrong</h2>
        <p className="muted">Sorry about that. Please reload the page.</p>
        <button className="btn" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function SpecialBanner({ data }) {
  if (data.settings.banner) return <div className="banner">{data.settings.banner}</div>;
  // Show the next special day within a week, if it has a note.
  const today = qldNow().date;
  for (let i = 0; i <= 7; i++) {
    const d = addDays(today, i);
    const h = getDayHours(data, d);
    if (h.special && h.note) {
      return (
        <div className="banner">
          {i === 0 ? 'Today' : prettyDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}: {h.note}
        </div>
      );
    }
  }
  return null;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setData(await api.loadData());
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load shop details.');
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <DataCtx.Provider value={{ data, refresh }}>
      <ScrollToTop />
      {api.mode === 'demo' && (
        <div className="demo-banner">
          Demo mode – bookings are saved in this browser only and emails are not really sent.
        </div>
      )}
      <Header admin={isAdmin} />
      {data && !isAdmin && <SpecialBanner data={data} />}
      {error && <div className="container" style={{ paddingTop: 24 }}><div className="error">{error}</div></div>}
      <main>
        <ErrorBoundary key={pathname}>
        {data ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/book" element={<Book />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/reset" element={<ResetPassword />} />
            <Route path="*" element={<div className="container page center"><h1>Page not found</h1></div>} />
          </Routes>
        ) : (
          !error && <div className="container page center muted">Loading…</div>
        )}
        </ErrorBoundary>
      </main>
      {!isAdmin && data && <Footer />}
    </DataCtx.Provider>
  );
}
