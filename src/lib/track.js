// Anonymous visitor counting for the admin Stats tab.
// No cookies, names or IP addresses – just a random id kept in this browser.
import { api } from './api.js';

let firstView = true;

function visitorId() {
  try {
    let id = localStorage.getItem('nyc-visitor');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 36);
      localStorage.setItem('nyc-visitor', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

function device() {
  const w = Math.min(window.screen?.width || window.innerWidth, window.innerWidth);
  return w < 700 ? 'phone' : w < 1100 ? 'tablet' : 'computer';
}

function referrer() {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    return host === window.location.hostname ? null : host;
  } catch {
    return null;
  }
}

export function trackView(path) {
  if (navigator.webdriver || path.startsWith('/admin') || !api.trackView) return;
  const ref = firstView ? referrer() : null;
  firstView = false;
  api.trackView({ path, referrer: ref, visitor: visitorId(), device: device() });
}
