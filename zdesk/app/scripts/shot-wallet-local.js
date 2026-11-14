'use strict';
const path = require('path');
const puppeteer = require('puppeteer-core');
const BASE = 'http://127.0.0.1:8787';
const OUT = '/workspace/zdesk-dashboard/screens';
const CHROME = '/usr/bin/google-chrome';
(async () => {
  // wait for API
  const start = Date.now();
  for (;;) {
    try {
      const r = await fetch(BASE + '/api/wallet', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d && d.address && d.totalUsd != null) break;
      }
    } catch {}
    if (Date.now() - start > 80000) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1200'],
    defaultViewport: { width: 1600, height: 1200 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  async function shot(name, url, sel) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    try {
      await page.waitForFunction((s) => {
        const el = document.querySelector(s);
        return el && el.dataset.ready === '1' && /\$/.test(el.innerText || '');
      }, { timeout: 40000 }, sel);
    } catch (e) {
      console.warn('wait timeout', name, e.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
    await new Promise((r) => setTimeout(r, 600));
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, fullPage: true });
    console.log('wrote', file);
  }
  await shot('01-trending.png', BASE + '/?tab=trending', '#desk-live');
  await shot('07-wallet.png', BASE + '/?tab=wallet', '#wallet-live');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
