
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = process.env.ZDESK_URL || 'http://127.0.0.1:8787';
const OUT = path.join(__dirname, '..', 'screens');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

async function waitReady(page, sel, timeout = 45000) {
  await page.waitForFunction((s) => {
    const el = document.querySelector(s);
    return el && (el.dataset.ready === '1' || (el.querySelector && el.querySelector('tbody tr, article.card, .desk-panel')));
  }, { timeout }, sel);
}

async function shot(page, name, url, readySel) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  if (readySel) {
    try { await waitReady(page, readySel, 50000); } catch (e) {
      console.warn('timeout waiting', readySel, 'for', name, e.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  } else {
    await new Promise((r) => setTimeout(r, 2500));
  }
  await new Promise((r) => setTimeout(r, 800));
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('wrote', file);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1200'],
    defaultViewport: { width: 1600, height: 1200 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  await shot(page, '01-trending.png', BASE + '/?tab=trending', '#tbl-trending');

  // token detail: click first row or open mint from table
  await page.goto(BASE + '/?tab=trending', { waitUntil: 'networkidle0' });
  try { await waitReady(page, '#tbl-trending'); } catch { /* */ }
  const mint = await page.evaluate(() => {
    const tr = document.querySelector('#tbl-trending tbody tr[data-mint]');
    return tr && tr.dataset.mint;
  });
  if (mint) {
    await page.goto(BASE + '/?tab=trending&mint=' + encodeURIComponent(mint), { waitUntil: 'networkidle0' });
    try {
      await page.waitForFunction(() => {
        const b = document.querySelector('#d-body');
        return b && b.innerText && b.innerText.length > 40 && !b.innerText.includes('Carico DexScreener');
      }, { timeout: 40000 });
      await page.waitForFunction(() => {
        const chart = document.querySelector('#d-chart canvas, #d-chart table');
        const note = document.querySelector('#d-chart-note');
        return !!(chart || (note && note.textContent && !note.textContent.includes('Carico')));
      }, { timeout: 25000 });
    } catch { await new Promise((r) => setTimeout(r, 5000)); }
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(OUT, '02-token-detail.png'), fullPage: true });
    console.log('wrote 02-token-detail.png', mint);
  } else {
    console.warn('no mint for detail shot');
  }

  await shot(page, '03-watchlist.png', BASE + '/?tab=watchlist', '#watch-cards');
  await shot(page, '04-desk.png', BASE + '/?tab=desk', '#desk-panels');

  // copy trader may still be scanning — wait longer
  await page.goto(BASE + '/?tab=copytrader', { waitUntil: 'networkidle0' });
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#copy-wallets');
      return el && (el.dataset.ready === '1' || /wallet|PAPER|Nessun wallet|Scansione/i.test(el.innerText + (document.querySelector('#copy-status') || {}).innerText));
    }, { timeout: 120000 });
  } catch { /* take anyway */ }
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, '05-copytrader.png'), fullPage: true });
  console.log('wrote 05-copytrader.png');

  await shot(page, '06-xstocks.png', BASE + '/?tab=xstocks', '#xstock-cards');
  await shot(page, '07-wallet.png', BASE + '/?tab=wallet', '#wallet-live');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
