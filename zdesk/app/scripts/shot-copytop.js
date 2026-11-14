'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ACCESS = path.join(__dirname, '..', 'ACCESS.txt');
const OUT = path.join(__dirname, '..', 'screens', '05-copytrader.png');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const URL = process.env.ZDESK_URL || 'https://zdesk.x-zdos.it/?tab=copytrader';

function creds() {
  const raw = fs.readFileSync(ACCESS, 'utf8');
  const user = (raw.match(/^Username:\s*(.+)$/m) || [])[1];
  const pass = (raw.match(/^Password:\s*(.+)$/m) || [])[1];
  if (!user || !pass) throw new Error('ACCESS.txt missing username or password');
  return { username: user.trim(), password: pass.trim() };
}

(async () => {
  const auth = creds();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1400'],
    defaultViewport: { width: 1600, height: 1400 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.authenticate(auth);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('#copy-top');
      if (!el || el.dataset.ready !== '1') return false;
      const rows = el.querySelectorAll('table.copytop-table tbody tr');
      return rows.length > 0 && !el.innerText.includes('nessun dato ancora');
    }, { timeout: 45000 });
  } catch (e) {
    console.warn('copy.top panel wait timed out, capturing anyway');
    await new Promise((r) => setTimeout(r, 4000));
  }
  await new Promise((r) => setTimeout(r, 800));
  // confirm subsection is in the shot; do not log credentials
  const ok = await page.evaluate(() => {
    const el = document.querySelector('#copy-top');
    const text = el ? el.innerText : '';
    const rows = el ? el.querySelectorAll('table.copytop-table tbody tr').length : 0;
    return { ready: !!(el && el.dataset.ready === '1'), hasTitle: /copy\.top/.test(text), rows, snippet: text.slice(0, 180) };
  });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log('wrote', OUT, 'ready=' + ok.ready, 'title=' + ok.hasTitle, 'rows=' + ok.rows);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
