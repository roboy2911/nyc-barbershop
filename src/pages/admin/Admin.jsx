import { useCallback, useEffect, useRef, useState } from 'react';
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

// Admin menu: groups on the left, with tabs along the top for each group's parts.
const GROUPS = [
  { id: 'today', label: 'Today', tabs: [['today', 'Today', TodayTab]] },
  {
    id: 'bookings',
    label: 'Bookings',
    tabs: [
      ['calendar', 'Calendar', BookingsTab],
      ['new', 'Newest', NewBookingsTab],
      ['customers', 'Customers', CustomersTab],
    ],
  },
  {
    id: 'team',
    label: 'Team & hours',
    tabs: [
      ['barbers', 'Barbers', BarbersTab],
      ['breaks', 'Breaks', BreaksTab],
      ['hours', 'Opening hours', HoursTab],
    ],
  },
  {
    id: 'website',
    label: 'Website',
    tabs: [
      ['services', 'Services & prices', ServicesTab],
      ['photos', 'Photos', PhotosTab],
      ['reviews', 'Reviews', ReviewsTab],
      ['stats', 'Visitors', StatsTab],
    ],
  },
  { id: 'messages', label: 'Messages', tabs: [['messages', 'Messages', MessagesTab]] },
  {
    id: 'settings',
    label: 'Settings',
    tabs: [
      ['settings', 'Shop settings', SettingsTab],
      ['account', 'Account & password', AccountTab],
      ...(api.mode === 'demo' ? [['outbox', 'Email outbox (demo)', OutboxTab]] : []),
    ],
  },
];

export default function Admin() {
  const { refresh } = useShop();
  const [admin, setAdmin] = useState(undefined);
  const [groupId, setGroupId] = useState('today');
  const [subs, setSubs] = useState({}); // remembers the open tab in each group
  const [newCount, setNewCount] = useState(0);

  // Only the newest check is allowed to update the screen, so a slow older
  // check can't sign you back out.
  const checkSeq = useRef(0);
  const check = useCallback(async () => {
    const seq = ++checkSeq.current;
    let a = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        a = await api.auth.getAdmin();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (seq === checkSeq.current) setAdmin(a);
    return !!a;
  }, []);

  useEffect(() => {
    check();
    return api.auth.onAuthChange((event) => {
      // Only sign-in / sign-out need a re-check; token refreshes don't.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') check();
    });
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

  const group = GROUPS.find((g) => g.id === groupId);
  const subId = subs[groupId] || group.tabs[0][0];
  const Current = group.tabs.find((t) => t[0] === subId)[2];
  return (
    <div className="admin-shell">
      <nav className="admin-side">
        {GROUPS.map((g) => (
          <button key={g.id} className={groupId === g.id ? 'on' : ''} onClick={() => setGroupId(g.id)}>
            {g.label}
            {g.id === 'bookings' && newCount > 0 && <span className="nav-count">{newCount > 49 ? '50+' : newCount}</span>}
          </button>
        ))}
        <button onClick={signOut}>Sign out</button>
      </nav>
      <section className="admin-main">
        {group.tabs.length > 1 && (
          <div className="subtabs no-print" role="tablist">
            {group.tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={subId === id} className={subId === id ? 'on' : ''} onClick={() => setSubs({ ...subs, [groupId]: id })}>
                {label}
                {id === 'new' && newCount > 0 && <span className="nav-count">{newCount > 49 ? '50+' : newCount}</span>}
              </button>
            ))}
          </div>
        )}
        <Current key={subId} admin={admin} refreshShop={refresh} onSeen={() => setNewCount(0)} />
      </section>
    </div>
  );
}
