// After the build: give each public page its own HTML file (so search engines and
// link previews see the right title, and GitHub Pages returns "200 OK" instead of 404),
// and write sitemap.xml and robots.txt.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { PAGES } from '../src/lib/seo.js';

const site = (process.env.VITE_SITE_URL || readFileSync('.env', 'utf8').match(/VITE_SITE_URL=(.*)/)?.[1] || '').trim().replace(/\/$/, '');
const html = readFileSync('dist/index.html', 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function pageHtml(path, { title, description }, extraHead = '') {
  const url = `${site}${path === '/' ? '/' : path}`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace('</head>', `${extraHead}</head>`);
}

for (const [path, meta] of Object.entries(PAGES)) {
  if (path === '/') continue;
  mkdirSync(`dist${path}`, { recursive: true });
  writeFileSync(`dist${path}/index.html`, pageHtml(path, meta));
}
const noindex = '<meta name="robots" content="noindex, nofollow" />';
for (const path of ['/admin', '/admin/reset', '/cancel']) {
  mkdirSync(`dist${path}`, { recursive: true });
  writeFileSync(`dist${path}/index.html`, pageHtml(path, { title: 'NYC Barbershop', description: '' }, noindex));
}
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    Object.keys(PAGES).map((p) => `  <url><loc>${site}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n',
);
writeFileSync('dist/robots.txt', `User-agent: *\nDisallow: /admin\nDisallow: /cancel\nSitemap: ${site}/sitemap.xml\n`);
console.log(`Post-build done for ${site}`);
