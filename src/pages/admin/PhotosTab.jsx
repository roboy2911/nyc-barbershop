import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

// Owner uploads haircut photos for the website gallery.
export default function PhotosTab() {
  const [photos, setPhotos] = useState(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);

  const load = () => api.listGallery().then(setPhotos);
  useEffect(() => {
    load();
  }, []);

  async function upload(files) {
    setError('');
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    let sort = photos?.length ? Math.max(...photos.map((p) => p.sort || 0)) + 1 : 0;
    for (let i = 0; i < list.length; i++) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        await api.uploadPhoto(list[i], '', sort++);
      } catch (e) {
        setError(`${list[i].name}: ${e.message}`);
      }
    }
    setProgress('');
    if (input.current) input.current.value = '';
    load();
  }

  async function move(i, d) {
    if (!photos[i + d]) return;
    const order = [...photos];
    [order[i], order[i + d]] = [order[i + d], order[i]];
    await Promise.all(order.map((p, k) => (p.sort !== k ? api.updatePhoto(p.id, { sort: k }) : null)));
    load();
  }

  async function caption(p) {
    const c = window.prompt('Caption (optional, e.g. "Skin fade"):', p.caption || '');
    if (c === null) return;
    await api.updatePhoto(p.id, { caption: c.trim().slice(0, 140) || null });
    load();
  }

  async function remove(p) {
    if (!window.confirm('Delete this photo from the website?')) return;
    await api.deletePhoto(p);
    load();
  }

  return (
    <div>
      <h2>Photos</h2>
      <p className="muted">These appear in “The work” gallery on the home page. Photos are resized automatically. The first 6 show on the home page; customers can tap to see them all.</p>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        <p>Drag photos here, or</p>
        <label className="btn">
          Choose photos
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </label>
        {progress && <p className="small muted" style={{ marginTop: 10 }}>{progress}</p>}
      </div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

      {!photos && <p className="muted">Loading…</p>}
      {photos?.length === 0 && <p className="muted" style={{ marginTop: 16 }}>No photos yet – the website shows placeholders until you add some.</p>}
      <div className="admin-photos">
        {photos?.map((p, i) => (
          <div className="card" key={p.id} style={{ padding: 10 }}>
            <img src={p.thumbUrl} alt={p.caption || ''} />
            <div className="small" style={{ margin: '8px 0', minHeight: 20 }}>{p.caption || <span className="muted">No caption</span>}</div>
            <div className="btn-row">
              <button className="btn ghost sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
              <button className="btn ghost sm" disabled={i === photos.length - 1} onClick={() => move(i, 1)} aria-label="Move later">→</button>
              <button className="btn ghost sm" onClick={() => caption(p)}>Caption</button>
              <button className="btn ghost sm" onClick={() => remove(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
