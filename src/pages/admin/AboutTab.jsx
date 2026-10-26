import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';
import { ABOUT } from '../../content.js';

const splitParas = (t) => t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

// Edit the "About the shop" section on the home page.
export default function AboutTab({ refreshShop }) {
  const { data } = useShop();
  const [heading, setHeading] = useState(data.settings.aboutHeading ?? ABOUT.heading);
  const [text, setText] = useState(data.settings.aboutText ?? ABOUT.paragraphs.join('\n\n'));
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveSettings({ ...data.settings, aboutHeading: heading.trim(), aboutText: text.trim() });
      await refreshShop();
      setMsg({ ok: 'Saved – the home page is updated.', err: '' });
    } catch (err) {
      setMsg({ ok: '', err: err.message });
    }
    setBusy(false);
  }

  return (
    <div>
      <h2>About the shop</h2>
      <p className="muted">This is the “About the shop” section on the home page.</p>
      <div className="about" style={{ gap: 24 }}>
        <form className="card" onSubmit={save}>
          {msg.err && <div className="error">{msg.err}</div>}
          {msg.ok && <div className="success">{msg.ok}</div>}
          <div className="field">
            <label htmlFor="ab-h">Heading (optional)</label>
            <input id="ab-h" type="text" maxLength={120} value={heading} onChange={(e) => { setHeading(e.target.value); setMsg({ ok: '', err: '' }); }} />
          </div>
          <div className="field">
            <label htmlFor="ab-t">Text – leave an empty line between paragraphs</label>
            <textarea id="ab-t" maxLength={3000} style={{ minHeight: 280 }} value={text} onChange={(e) => { setText(e.target.value); setMsg({ ok: '', err: '' }); }} />
            <div className="small muted" style={{ textAlign: 'right' }}>{text.length}/3000</div>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
        <div>
          <h3>Preview</h3>
          <div className="card">
            <h2 style={{ fontSize: '1.4rem' }}>About the shop</h2>
            {heading.trim() && <p style={{ fontWeight: 600, color: 'var(--text)' }}>{heading}</p>}
            {splitParas(text).map((p, i) => <p key={i} className="muted">{p}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}
