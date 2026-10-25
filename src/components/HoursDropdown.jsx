import { useShop } from '../App.jsx';
import {
  DAY_NAMES,
  addDays,
  dowOf,
  getDayHours,
  minToLabel,
  prettyDate,
  qldNow,
} from '../../supabase/functions/_shared/availability.js';

const hoursText = (h) => (h.closed ? 'Closed' : `${minToLabel(h.openMin)} – ${minToLabel(h.closeMin)}`);

// Opening hours for the next 7 days, starting today, with an Open now / Closed label.
export default function HoursDropdown() {
  const { data } = useShop();
  const now = qldNow();
  const today = getDayHours(data, now.date);
  const openNow = !today.closed && now.minutes >= today.openMin && now.minutes < today.closeMin;

  let summary;
  if (openNow) summary = `Open today until ${minToLabel(today.closeMin)}`;
  else if (!today.closed && now.minutes < today.openMin) summary = `Opens today at ${minToLabel(today.openMin)}`;
  else {
    summary = 'Closed today';
    for (let i = 1; i <= 7; i++) {
      const h = getDayHours(data, addDays(now.date, i));
      if (!h.closed) {
        summary = `Opens ${i === 1 ? 'tomorrow' : DAY_NAMES[dowOf(addDays(now.date, i))]} at ${minToLabel(h.openMin)}`;
        break;
      }
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(now.date, i));
  return (
    <details className="hours">
      <summary>
        <span>
          <span className={`pill ${openNow ? 'open' : 'closed'}`}>{openNow ? 'Open now' : 'Closed'}</span>{' '}
          <span style={{ marginLeft: 6 }}>{summary}</span>
        </span>
        <span className="chev">▾</span>
      </summary>
      <table>
        <tbody>
          {days.map((d, i) => {
            const h = getDayHours(data, d);
            return (
              <tr key={d} className={i === 0 ? 'today' : ''}>
                <td>
                  {DAY_NAMES[dowOf(d)]}
                  {i === 0 && <span className="muted small"> (today)</span>}
                  <span className="muted small"> · {prettyDate(d, { day: 'numeric', month: 'short' })}</span>
                  {h.special && <span className="special">Special hours{h.note ? ` – ${h.note}` : ''}</span>}
                </td>
                <td>{hoursText(h)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
