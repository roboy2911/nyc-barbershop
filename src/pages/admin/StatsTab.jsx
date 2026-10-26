import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { addDays, prettyDate, qldNow } from '../../../supabase/functions/_shared/availability.js';

const PAGE_NAMES = { '/': 'Home', '/book': 'Book', '/services': 'Services & prices', '/reviews': 'Reviews', '/contact': 'Contact', '/cancel': 'Cancel booking' };

// One bar per day: how many different people visited.
function DailyChart({ days, rows }) {
  const [hover, setHover] = useState(null);
  const W = 720;
  const H = 200;
  const pad = { l: 34, r: 8, t: 12, b: 26 };
  const max = Math.max(4, ...rows.map((r) => r.visitors));
  const niceMax = Math.ceil(max / 4) * 4;
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const ticks = [0, niceMax / 4, niceMax / 2, (3 * niceMax) / 4, niceMax];
  const labelEvery = Math.ceil(days.length / 7);

  return (
    <div className="chart-wrap" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Visitors per day" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#2a2a2a" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8c8c8c">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const v = byDay[d]?.visitors || 0;
          const x = pad.l + i * bw;
          const barW = Math.max(2, bw - 2); // 2px gap between bars
          const top = y(v);
          const h = H - pad.b - top;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d} onMouseEnter={() => setHover({ d, i })} onClick={() => setHover({ d, i })}>
              {/* larger invisible hit area */}
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {v > 0 && (
                <path
                  d={`M${x + 1},${H - pad.b} V${top + r} Q${x + 1},${top} ${x + 1 + r},${top} H${x + 1 + barW - r} Q${x + 1 + barW},${top} ${x + 1 + barW},${top + r} V${H - pad.b} Z`}
                  fill={hover?.d === d ? '#f2f2f2' : '#bdbdbd'}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#8c8c8c">
                  {prettyDate(d, { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#444" strokeWidth="1" />
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: `${((pad.l + (hover.i + 0.5) * bw) / W) * 100}%` }}>
          <strong>{prettyDate(hover.d, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          <div>{byDay[hover.d]?.visitors || 0} visitors</div>
          <div className="muted">{byDay[hover.d]?.views || 0} page views</div>
        </div>
      )}
    </div>
  );
}

export default function StatsTab() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setStats(null);
    api.visitStats(days).then(setStats).catch((e) => setError(e.message));
  }, [days]);

  const dayList = useMemo(() => {
    const today = qldNow().date;
    return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  }, [days]);

  const rate = stats && stats.visitors ? Math.round((stats.bookings / stats.visitors) * 1000) / 10 : 0;

  return (
    <div>
      <h2>Website visitors</h2>
      <p className="muted">Anonymous counts – no names or personal details are recorded. Admin pages and your own testing tools aren't counted.</p>
      <div className="chips" style={{ marginBottom: 16 }}>
        {[7, 30, 90, 365].map((d) => (
          <button key={d} className={`chip${days === d ? ' on' : ''}`} onClick={() => setDays(d)}>
            {d === 365 ? '12 months' : `${d} days`}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {!stats && !error && <p className="muted">Loading…</p>}
      {stats && (
        <>
          <div className="stats">
            <div className="stat"><div className="v">{stats.visitors}</div><div className="l">Visitors</div></div>
            <div className="stat"><div className="v">{stats.views}</div><div className="l">Page views</div></div>
            <div className="stat"><div className="v">{stats.bookings}</div><div className="l">Online bookings</div></div>
            <div className="stat"><div className="v">{rate}%</div><div className="l">Visitors who booked</div></div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Visitors per day</h3>
              <button className="link-btn small" onClick={() => setShowTable(!showTable)}>{showTable ? 'Show chart' : 'Show as table'}</button>
            </div>
            {showTable ? (
              <div className="table-wrap" style={{ marginTop: 12, maxHeight: 320, overflow: 'auto' }}>
                <table className="t">
                  <thead><tr><th>Day</th><th>Visitors</th><th>Page views</th></tr></thead>
                  <tbody>
                    {[...stats.daily].reverse().map((r) => (
                      <tr key={r.day}><td>{prettyDate(r.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{r.visitors}</td><td>{r.views}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DailyChart days={days > 90 ? dayList.slice(-90) : dayList} rows={stats.daily} />
            )}
            {days > 90 && !showTable && <p className="small muted">Chart shows the last 90 days; totals cover 12 months.</p>}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Most viewed pages</h3>
              <table className="t"><tbody>
                {stats.pages.map((p) => <tr key={p.path}><td>{PAGE_NAMES[p.path] || p.path}</td><td style={{ textAlign: 'right' }}>{p.views}</td></tr>)}
                {!stats.pages.length && <tr><td className="muted">No visits yet</td></tr>}
              </tbody></table>
            </div>
            <div className="card">
              <h3>Where visitors came from</h3>
              <table className="t"><tbody>
                {stats.referrers.map((r) => <tr key={r.referrer}><td>{r.referrer}</td><td style={{ textAlign: 'right' }}>{r.views}</td></tr>)}
                {!stats.referrers.length && <tr><td className="muted">Direct visits only so far</td></tr>}
              </tbody></table>
              <h3 style={{ marginTop: 16 }}>Devices</h3>
              <table className="t"><tbody>
                {stats.devices.map((d) => <tr key={d.device}><td style={{ textTransform: 'capitalize' }}>{d.device}</td><td style={{ textAlign: 'right' }}>{d.visitors}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
