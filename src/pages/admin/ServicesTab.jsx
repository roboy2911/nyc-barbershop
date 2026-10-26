import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useShop } from '../../App.jsx';

const blank = { name: '', duration: 30, price: '', description: '', active: true };

export default function ServicesTab({ refreshShop }) {
  const { data } = useShop();
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  const open = (s) =>
    setEdit(s ? { ...s, price: s.priceCents == null ? '' : (s.priceCents / 100).toFixed(2) } : { ...blank });

  async function save(e) {
    e.preventDefault();
    const duration = Number(edit.duration);
    if (!edit.name.trim()) return setError('Enter a name.');
    if (!(duration >= 5 && duration <= 480)) return setError('Length must be between 5 and 480 minutes.');
    try {
      await api.saveService({
        id: edit.id, name: edit.name.trim(), duration, description: edit.description,
        priceCents: edit.price === '' ? null : Math.round(Number(edit.price) * 100), active: edit.active, sort: edit.sort, popular: !!edit.popular,
      });
      await refreshShop();
      setEdit(null);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Services &amp; prices</h2>
      <p className="muted">Changes show on the website and booking page straight away. Existing bookings keep their original length.</p>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Service</th><th>Length</th><th>Price</th><th>Shown</th><th /></tr></thead>
          <tbody>
            {data.services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}{s.popular && <span className="tag">Most popular</span>}</td>
                <td>{s.duration} min</td>
                <td>{s.priceCents == null ? '—' : `$${(s.priceCents / 100).toFixed(2)}`}</td>
                <td>{s.active ? 'Yes' : 'Hidden'}</td>
                <td><button className="btn ghost sm" onClick={() => open(s)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" style={{ marginTop: 14 }} onClick={() => open(null)}>+ Add service</button>

      {edit && (
        <div className="modal-back">
          <form className="modal" onSubmit={save}>
            <h3>{edit.id ? 'Edit service' : 'New service'}</h3>
            {error && <div className="error">{error}</div>}
            <div className="field"><label>Name</label><input type="text" maxLength={80} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid-2">
              <div className="field"><label>Length (minutes)</label><input type="number" min={5} max={480} step={5} value={edit.duration} onChange={(e) => setEdit({ ...edit, duration: e.target.value })} /></div>
              <div className="field"><label>Price ($)</label><input type="number" min={0} step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
            </div>
            <div className="field"><label>Description</label><textarea maxLength={300} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Show on website and allow bookings
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input type="checkbox" checked={!!edit.popular} onChange={(e) => setEdit({ ...edit, popular: e.target.checked })} /> Show a “Most popular” tag
            </label>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn">Save</button>
              <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Close</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
