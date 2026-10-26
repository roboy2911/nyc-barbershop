import { Component, Suspense, createContext, lazy, useCallback, useContext, useEffect, useState } from 'react';
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
import Unsubscribe from './pages/Unsubscribe.jsx';
import MobileBar from './components/MobileBar.jsx';
import { PAGES } from './lib/seo.js';
import { trackView } from './lib/track.js';

// The admin area is loaded only when someone opens it, so the public site stays fast.
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));
const ResetPassword = lazy(() => import('./pages/admin/ResetPassword.jsx'));
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
  const out = [];
  if (data.settings.banner) out.push(<div key="b" className="banner">{data.settings.banner}</div>);
  // Also show the next special day within a week, if it has a note.
  const today = qldNow().date;
  for (let i = 0; i <= 7; i++) {
    const d = addDays(today, i);
    const h = getDayHours(data, d);
    if (h.special && h.note) {
      out.push(
        <div key="s" className="banner">
          {i === 0 ? 'Today' : prettyDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}: {h.note}
        </div>,
      );
      break;
    }
  }
  return out;
}

function PageSkeleton() {
  return (
    <div className="container page" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 44, width: '45%', margin: '20px auto 28px' }} />
      <div className="skeleton" style={{ height: 16, width: '70%', margin: '0 auto 12px' }} />
      <div className="skeleton" style={{ height: 16, width: '55%', margin: '0 auto 36px' }} />
      <div className="svc-mini">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
      </div>
    </div>
  );
}

// Page title + description for the browser tab and link previews.
function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = PAGES[pathname] || PAGES['/'];
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    trackView(pathname);
  }, [pathname]);
  return null;
}

// Fade sections in as they scroll into view.
function useReveal(deps) {
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
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
  const showBar = !!data && !isAdmin && pathname !== '/book' && pathname !== '/cancel' && pathname !== '/unsubscribe';
  useReveal([pathname, data]);
  useEffect(() => {
    document.body.classList.toggle('has-mobile-bar', showBar);
  }, [showBar]);

  return (
    <DataCtx.Provider value={{ data, refresh }}>
      <ScrollToTop />
      <PageMeta />
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
        <Suspense fallback={<PageSkeleton />}>
        {data ? (
          <div className={pathname === '/' ? undefined : 'page-fade'} key={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/book" element={<Book />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cancel" element={<Cancel />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/reset" element={<ResetPassword />} />
            <Route path="*" element={<div className="container page center"><h1>Page not found</h1></div>} />
          </Routes>
          </div>
        ) : (
          !error && <PageSkeleton />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>
      {!isAdmin && data && <Footer />}
      {showBar && <MobileBar />}
    </DataCtx.Provider>
  );
}
