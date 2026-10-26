import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { money } from '../Services.jsx';
import { BookingCard } from './parts.jsx';
import { addDays, prettyDate, qldNow } from '../../../supabase/functions/_shared/availability.js';

const keyOf = (b) =>
  (b.email && b.email.toLowerCase().trim()) || (b.phone && b.phone.replace(/\D/g, '')) || b.customerName.toLowerCase().trim();

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Everyone who has booked in the last year, built from the bookings.
export default function CustomersTab() {
  const { data } = useShop();
  const now = qldNow();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('last');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.listAllBookings(addDays(now.date, -365)).then(setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceOf = (b) => data.services.find((s) => s.id === b.serviceId)?.priceCents || 0;
  const nameOf = (id) => data.barbers.find((b) => b.id === id)?.name || '?';

  const customers = useMemo(() => {
    if (!rows) return [];
    const map = new Map();
    for (const b of rows) {
      const k = keyOf(b);
      const c = map.get(k) || { key: k, name: b.customerName, phone: b.phone, email: b.email, visits: 0, noShows: 0, cancels: 0, spent: 0, last: null, next: null, bookings: [] };
      c.bookings.push(b);
      if (b.phone && !c.phone) c.phone = b.phone;
      if (b.email && !c.email) c.email = b.email;
      const past = b.date < now.date || (b.date === now.date && b.endMin <= now.minutes);
      if (b.status === 'cancelled') c.cancels++;
      else if (b.noShow) c.noShows++;
      else if (past) {
        c.visits++;
        c.spent += priceOf(b);
        if (!c.last || b.date > c.last) {
          c.last = b.date;
          c.name = b.customerName;
        }
      } else if (!c.next || b.date < c.next) c.next = b.date;
      map.set(k, c);
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const t = q.toLowerCase().trim();
  const list = customers
    .filter((c) => !t || [c.name, c.phone, c.email].some((v) => v && v.toLowerCase().includes(t)))
    .sort((a, b) =>
      sort === 'visits' ? b.visits - a.visits : sort === 'name' ? a.name.localeCompare(b.name) : (b.last || b.next || '').localeCompare(a.last || a.next || ''),
    );

  function exportCsv() {
    const lines = [['Name', 'Phone', 'Email', 'Visits', 'No-shows', 'Last visit', 'Next booking'].map(csvCell).join(',')];
    list.forEach((c) => lines.push([c.name, c.phone, c.email, c.visits, c.noShows, c.last, c.next].map(csvCell).join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `nyc-barbershop-customers-${now.date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <h2>Customers</h2>
      <p className="muted">Everyone who has booked in the last 12 months.</p>
      <div className="search-row">
        <input type="text" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto' }} aria-label="Sort">
          <option value="last">Most recent</option>
          <option value="visits">Most visits</option>
          <option value="name">Name</option>
        </select>
      </div>
      {!rows && <p className="muted">Loading…</p>}
      {rows && (
        <>
          <p className="small muted">{list.length} customers · <button className="link-btn" onClick={exportCsv}>Download as spreadsheet (CSV)</button></p>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Name</th><th>Contact</th><th>Visits</th><th>Last visit</th><th>Next</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.key}>
                    <td>
                      {c.name}
                      {c.noShows > 0 && <span className="tag red">{c.noShows} no-show{c.noShows > 1 ? 's' : ''}</span>}
                      {c.visits >= 5 && <span className="tag">Regular</span>}
                    </td>
                    <td className="small">
                      {c.phone && <div><a href={`tel:${c.phone}`}>{c.phone}</a></div>}
                      {c.email && <div className="muted">{c.email}</div>}
                    </td>
                    <td>{c.visits}{c.spent ? <div className="small muted">{money(c.spent)}</div> : null}</td>
                    <td className="small">{c.last ? prettyDate(c.last, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="small">{c.next ? prettyDate(c.next, { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td><button className="btn ghost sm" onClick={() => setOpen(c)}>History</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{open.name}</h3>
            <p className="small muted">
              {open.visits} visits · {open.noShows} no-shows · {open.cancels} cancelled
              {open.spent ? ` · ${money(open.spent)} booked` : ''}
            </p>
            {[...open.bookings].sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin).map((b) => (
              <BookingCard key={b.id} b={b} showBarber showDate nameOf={nameOf} />
            ))}
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
