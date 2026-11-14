'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ACCESS = path.join(__dirname, '..', 'ACCESS.txt');
const OUT = path.join(__dirname, '..', 'screens', 'live.png');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const URL = process.env.ZDESK_URL || 'https://x-zdos.it/zdesk/';

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
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1600,1200'],
    defaultViewport: { width: 1600, height: 1200 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.authenticate(auth);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  try {
    await page.waitForFunction(() => {
      const tbl = document.querySelector('#tbl-trending tbody tr, #src-health .chip, .pairs tbody tr');
      return !!tbl;
    }, { timeout: 45000 });
  } catch (e) {
    console.warn('content wait timed out, capturing anyway');
    await new Promise((r) => setTimeout(r, 4000));
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log('wrote', OUT);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
