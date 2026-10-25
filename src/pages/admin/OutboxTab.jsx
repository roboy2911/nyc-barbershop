import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

// Demo only: shows the emails customers would have received.
export default function OutboxTab() {
  const [mails, setMails] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    api.outbox().then(setMails);
  }, []);
  return (
    <div>
      <h2>Email outbox (demo)</h2>
      <p className="muted">In demo mode emails aren't sent. These are the emails customers would get.</p>
      {mails.length === 0 && <p className="muted">No emails yet – make a booking on the site to see one.</p>}
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>When</th><th>To</th><th>Subject</th><th /></tr></thead>
          <tbody>
            {mails.map((m, i) => (
              <tr key={i}>
                <td>{new Date(m.sentAt).toLocaleString('en-AU')}</td>
                <td>{m.to}</td>
                <td>{m.subject}</td>
                <td><button className="btn ghost sm" onClick={() => setOpen(m)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{open.subject}</h3>
            <div className="email-preview"><iframe title="Email preview" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={'<base target="_blank">' + open.html} /></div>
            <div style={{ marginTop: 12 }}><button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
