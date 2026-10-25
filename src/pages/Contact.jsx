import { useState } from 'react';
import { useShop } from '../App.jsx';
import { api } from '../lib/api.js';
import { SHOP, telHref } from '../content.js';

export default function Contact() {
  const { data } = useShop();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' });
  const [status, setStatus] = useState({ busy: false, done: false, error: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.website) return setStatus({ busy: false, done: true, error: '' }); // spam-bot trap
    if (!form.email && !form.phone) return setStatus({ ...status, error: 'Please leave an email or phone number so we can reply.' });
    setStatus({ busy: true, done: false, error: '' });
    try {
      await api.sendContact({
        name: form.name.trim().slice(0, 100),
        email: form.email.trim().slice(0, 200),
        phone: form.phone.trim().slice(0, 30),
        message: form.message.trim().slice(0, 3000),
      });
      setStatus({ busy: false, done: true, error: '' });
    } catch {
      setStatus({ busy: false, done: false, error: 'Sorry, that did not send. Please try again or give us a call.' });
    }
  }

  return (
    <>
      <div className="page-head">
        <div className="container">
          <h1>Contact</h1>
          <p>Questions, group bookings or feedback – we'd love to hear from you</p>
        </div>
      </div>
      <div className="container page">
        <div className="about">
          <div className="card">
            {status.done ? (
              <div className="success">Thanks {form.name || ''}! Your message has been sent – we'll get back to you soon.</div>
            ) : (
              <form onSubmit={submit}>
                {status.error && <div className="error">{status.error}</div>}
                <div className="field">
                  <label htmlFor="c-name">Name *</label>
                  <input id="c-name" type="text" required maxLength={100} value={form.name} onChange={set('name')} />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="c-email">Email</label>
                    <input id="c-email" type="email" maxLength={200} value={form.email} onChange={set('email')} />
                  </div>
                  <div className="field">
                    <label htmlFor="c-phone">Phone</label>
                    <input id="c-phone" type="tel" maxLength={30} value={form.phone} onChange={set('phone')} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="c-msg">Message *</label>
                  <textarea id="c-msg" required maxLength={3000} value={form.message} onChange={set('message')} />
                </div>
                <div className="hp" aria-hidden="true">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
                </div>
                <button className="btn" disabled={status.busy}>{status.busy ? 'Sending…' : 'Send message'}</button>
              </form>
            )}
          </div>
          <div>
            <h3>Prefer to call?</h3>
            <p><a className="phone-link" href={telHref(data.settings.phone)}>{data.settings.phone}</a></p>
            {data.settings.publicEmail && (
              <p><a href={`mailto:${data.settings.publicEmail}`}>{data.settings.publicEmail}</a></p>
            )}
            <h3 style={{ marginTop: 24 }}>Visit us</h3>
            {SHOP.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
