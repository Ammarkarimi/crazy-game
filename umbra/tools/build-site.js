'use strict';
/* Builds the web site into site/ for static hosting (Vercel, Netlify, GitHub Pages...).
   Copies only the game files and writes sw.js, a service worker that caches every
   file so the game installs as an app and plays offline.
   Pass --demo (or set UMBRA_DEMO=1) to publish the free demo instead. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site');
const INCLUDE = ['index.html', 'privacy.html', 'manifest.webmanifest', 'css', 'src', 'assets'];
const DEMO = process.argv.includes('--demo') || process.env.UMBRA_DEMO === '1';

function walk(rel, out) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) {
    for (const f of fs.readdirSync(abs).sort()) walk(path.posix.join(rel, f), out);
  } else out.push(rel);
  return out;
}

fs.rmSync(OUT, { recursive: true, force: true });
const files = INCLUDE.flatMap(f => walk(f, []));
const hash = crypto.createHash('sha1');
for (const name of files) {
  let data = fs.readFileSync(path.join(ROOT, name));
  if (DEMO && name === 'index.html') {
    data = Buffer.from(data.toString('utf8').replace('<script src="src/util.js">', '<script>window.UMBRA_DEMO = true;</script>\n  <script src="src/util.js">'));
  }
  hash.update(name).update(data);
  const dest = path.join(OUT, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
}

// Screenshots are only for the install dialog; don't make players download them up front.
const precache = ['./', ...files.filter(f => !f.startsWith('assets/icons/screenshot') && f !== 'privacy.html' && f !== 'index.html')];
const cacheName = 'umbra-' + hash.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sw.js'), `'use strict';
const CACHE = ${JSON.stringify(cacheName)};
const FILES = ${JSON.stringify(precache, null, 0)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() =>
    req.mode === 'navigate' ? caches.match('./') : Response.error())));
});
`);

console.log(`Built site/ (${files.length} files, ${DEMO ? 'DEMO' : 'full game'}, cache ${cacheName})`);
