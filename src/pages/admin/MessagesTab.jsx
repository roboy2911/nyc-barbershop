import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export default function MessagesTab() {
  const [list, setList] = useState(null);
  const load = () => api.listMessages().then(setList);
  useEffect(() => {
    load();
  }, []);

  async function toggle(m) {
    await api.setMessageHandled(m.id, !m.handled);
    load();
  }
  async function remove(m) {
    if (!window.confirm('Delete this message?')) return;
    await api.deleteMessage(m.id);
    load();
  }

  return (
    <div>
      <h2>Messages</h2>
      <p className="muted">Messages sent from the Contact page.</p>
      {!list && <p className="muted">Loading…</p>}
      {list?.length === 0 && <p className="muted">No messages yet.</p>}
      {list?.map((m) => (
        <div key={m.id} className="card" style={{ marginBottom: 12, opacity: m.handled ? 0.55 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong>{m.name}</strong>
            <span className="muted small">{new Date(m.createdAt).toLocaleString('en-AU')}</span>
          </div>
          <div className="small">
            {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>} {m.phone && <a href={`tel:${m.phone}`}>{m.phone}</a>}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{m.message}</p>
          <div className="btn-row">
            <button className="btn ghost sm" onClick={() => toggle(m)}>{m.handled ? 'Mark as new' : 'Mark as done'}</button>
            <button className="btn ghost sm" onClick={() => remove(m)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
