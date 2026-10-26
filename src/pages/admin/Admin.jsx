import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import Login from './Login.jsx';
import TodayTab from './TodayTab.jsx';
import BookingsTab from './BookingsTab.jsx';
import CustomersTab from './CustomersTab.jsx';
import NewBookingsTab, { lastSeen } from './NewBookingsTab.jsx';
import StatsTab from './StatsTab.jsx';
import PhotosTab from './PhotosTab.jsx';
import ReviewsTab from './ReviewsTab.jsx';
import HoursTab from './HoursTab.jsx';
import BarbersTab from './BarbersTab.jsx';
import BreaksTab from './BreaksTab.jsx';
import ServicesTab from './ServicesTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import MessagesTab from './MessagesTab.jsx';
import AccountTab from './AccountTab.jsx';
import OutboxTab from './OutboxTab.jsx';

const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000; // sign out after 12 hours of no activity
const ACTIVE_KEY = 'nyc-admin-last-active'; // remembered even if the browser is closed

const readActive = () => {
  try {
    return Number(localStorage.getItem(ACTIVE_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeActive = (t) => {
  try {
    localStorage.setItem(ACTIVE_KEY, String(t));
  } catch {
    /* ignore */
  }
};

const TABS = [
  ['today', 'Today', TodayTab],
  ['new', 'Newest bookings', NewBookingsTab],
  ['bookings', 'Bookings', BookingsTab],
  ['customers', 'Customers', CustomersTab],
  ['stats', 'Website visitors', StatsTab],
  ['hours', 'Opening hours', HoursTab],
  ['barbers', 'Barbers', BarbersTab],
  ['breaks', 'Breaks', BreaksTab],
  ['services', 'Services & prices', ServicesTab],
  ['photos', 'Photos', PhotosTab],
  ['reviews', 'Reviews', ReviewsTab],
  ['settings', 'Settings', SettingsTab],
  ['messages', 'Messages', MessagesTab],
  ['account', 'Account & password', AccountTab],
];
if (api.mode === 'demo') TABS.push(['outbox', 'Email outbox (demo)', OutboxTab]);

export default function Admin() {
  const { refresh } = useShop();
  const [admin, setAdmin] = useState(undefined);
  const [tab, setTab] = useState('today');
  const [newCount, setNewCount] = useState(0);

  const check = useCallback(async () => {
    try {
      setAdmin(await api.auth.getAdmin());
    } catch {
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    check();
    return api.auth.onAuthChange(() => check());
  }, [check]);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    setAdmin(null);
  }, []);

  // How many bookings were made since the "Newest bookings" list was last opened.
  useEffect(() => {
    if (!admin) return;
    const count = () =>
      api.listRecentBookings(50).then((rows) => {
        const seen = lastSeen();
        setNewCount(seen ? rows.filter((b) => b.createdAt > seen).length : rows.length);
      }).catch(() => {});
    count();
    const t = setInterval(count, 120000);
    return () => clearInterval(t);
  }, [admin]);

  // Automatic sign-out after 12 hours without use (also checked when coming back
  // after closing the browser).
  useEffect(() => {
    if (!admin) return;
    const last = readActive();
    if (last && Date.now() - last > IDLE_LIMIT_MS) {
      signOut();
      return;
    }
    writeActive(Date.now());
    let lastWrite = Date.now();
    const bump = () => {
      if (Date.now() - lastWrite > 60000) {
        lastWrite = Date.now();
        writeActive(lastWrite);
      }
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - readActive() > IDLE_LIMIT_MS) signOut();
    }, 60000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [admin, signOut]);

  useEffect(() => {
    document.querySelector('meta[name="robots"]')?.remove();
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  if (admin === undefined) return <div className="container page muted">Checking sign-in…</div>;
  if (!admin) return <Login onDone={check} />;

  const Current = TABS.find((t) => t[0] === tab)[2];
  return (
    <div className="admin-shell">
      <nav className="admin-side">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
            {id === 'new' && newCount > 0 && <span className="nav-count">{newCount > 49 ? '50+' : newCount}</span>}
          </button>
        ))}
        <button onClick={signOut}>Sign out</button>
      </nav>
      <section className="admin-main">
        <Current admin={admin} refreshShop={refresh} onSeen={() => setNewCount(0)} />
      </section>
    </div>
  );
}
