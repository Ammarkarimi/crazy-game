'use strict';
/* Shared Playwright launcher for the QA and marketing scripts.
   Install once with: npm i -D playwright && npx playwright install chromium */
const path = require('path');

function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  console.error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

async function launch() {
  const { chromium } = loadPlaywright();
  const opts = {};
  if (process.env.CHROME_PATH) opts.executablePath = process.env.CHROME_PATH;
  try { return await chromium.launch(opts); } catch (e) {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  }
}

const GAME_URL = 'file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

module.exports = { launch, loadPlaywright, GAME_URL };
