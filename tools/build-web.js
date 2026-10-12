'use strict';
/* Packs the browser build into dist/hyperchaos-web.zip, ready to upload to
   itch.io (kind: HTML), Newgrounds, CrazyGames, Poki, GameDistribution, etc.
   Pass --demo for a free demo build that ends after wave 5.
   Zero dependencies: writes a standard (stored) ZIP archive. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'css', 'src', 'assets'];
const OUT_DIR = path.join(ROOT, 'dist');
const DEMO = process.argv.includes('--demo');
const OUT = path.join(OUT_DIR, DEMO ? 'hyperchaos-demo-web.zip' : 'hyperchaos-web.zip');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walk(rel, out) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) {
    for (const f of fs.readdirSync(abs).sort()) walk(path.posix.join(rel, f), out);
  } else out.push(rel);
  return out;
}

const files = INCLUDE.flatMap(f => walk(f, []));
const locals = [], centrals = [];
let offset = 0;
for (const name of files) {
  let data = fs.readFileSync(path.join(ROOT, name));
  if (DEMO && name === 'index.html') {
    data = Buffer.from(data.toString('utf8').replace('<script src="src/util.js">', '<script>window.HYPERCHAOS_DEMO = true;</script>\n  <script src="src/util.js">'));
  }
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // utf-8 names
  local.writeUInt16LE(0, 8);      // stored
  local.writeUInt32LE(0, 10);     // time/date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, nameBuf, data);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, nameBuf);
  offset += 30 + nameBuf.length + data.length;
}
const cdSize = centrals.reduce((a, b) => a + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdSize, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([...locals, ...centrals, end]));
console.log(`Wrote ${path.relative(ROOT, OUT)} (${files.length} files, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
