import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const blank = { name: '', stars: 5, text: '', visible: true };

// Add, edit, hide, reorder and delete the reviews shown on the website.
export default function ReviewsTab({ refreshShop }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.listAllReviews().then(setList);
  useEffect(() => {
    load();
  }, []);

  const changed = async () => {
    await load();
    await refreshShop();
  };

  async function save(e) {
    e.preventDefault();
    if (!edit.name.trim() || !edit.text.trim()) return setError('Please fill in the name and the review.');
    try {
      await api.saveReview({
        ...edit,
        name: edit.name.trim().slice(0, 60),
        text: edit.text.trim().slice(0, 600),
        stars: Number(edit.stars),
        sort: edit.id ? edit.sort : -1, // new reviews go to the top
      });
      setEdit(null);
      setError('');
      await changed();
    } catch (err) {
      setError(err.message);
    }
  }

  async function move(i, d) {
    if (!list[i + d]) return;
    const order = [...list];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((r, k) => (r.sort !== k ? api.saveReview({ ...r, sort: k }) : null)));
    await changed();
  }

  async function toggle(r) {
    await api.saveReview({ ...r, visible: !r.visible });
    await changed();
  }

  async function remove(r) {
    if (!window.confirm(`Delete the review from ${r.name}? This can't be undone.`)) return;
    await api.deleteReview(r.id);
    await changed();
  }

  return (
    <div>
      <h2>Reviews</h2>
      <p className="muted">These show on the home page (scrolling strip) and the Reviews page, in this order. Hidden reviews are kept here but not shown on the website.</p>
      <button className="btn" style={{ marginBottom: 16 }} onClick={() => { setEdit({ ...blank }); setError(''); }}>+ Add review</button>

      {!list && <p className="muted">Loading…</p>}
      {list?.length === 0 && <p className="muted">No reviews yet.</p>}
      {list?.map((r, i) => (
        <div key={r.id} className="card" style={{ marginBottom: 10, opacity: r.visible ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <span className="stars" aria-label={`${r.stars} stars`}>{'★'.repeat(r.stars)}<span style={{ color: '#444' }}>{'★'.repeat(5 - r.stars)}</span></span>{' '}
              <strong>{r.name}</strong>
              {!r.visible && <span className="tag">Hidden</span>}
            </div>
          </div>
          <p style={{ margin: '8px 0 12px' }}>“{r.text}”</p>
          <div className="btn-row">
            <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button className="btn ghost sm" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button className="btn ghost sm" onClick={() => { setEdit({ ...r }); setError(''); }}>Edit</button>
            <button className="btn ghost sm" onClick={() => toggle(r)}>{r.visible ? 'Hide' : 'Show'}</button>
            <button className="btn ghost sm btn-del" onClick={() => remove(r)}>Delete</button>
          </div>
        </div>
      ))}

      {edit && (
        <div className="modal-back">
          <form className="modal" onSubmit={save}>
            <h3>{edit.id ? 'Edit review' : 'New review'}</h3>
            {error && <div className="error">{error}</div>}
            <div className="field">
              <label htmlFor="rv-name">Customer name (e.g. “Jake M.”)</label>
              <input id="rv-name" type="text" maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Stars</label>
              <div className="chips">
                {[5, 4, 3, 2, 1].map((n) => (
                  <button type="button" key={n} className={`chip${Number(edit.stars) === n ? ' on' : ''}`} onClick={() => setEdit({ ...edit, stars: n })}>
                    {'★'.repeat(n)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="rv-text">Review</label>
              <textarea id="rv-text" maxLength={600} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
              <div className="small muted" style={{ textAlign: 'right' }}>{edit.text.length}/600</div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={edit.visible} onChange={(e) => setEdit({ ...edit, visible: e.target.checked })} /> Show on the website
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
