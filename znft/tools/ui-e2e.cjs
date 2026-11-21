// Test UI desktop+mobile della galleria zNFT con un Phantom simulato che firma con un wallet di test (devnet reale).
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const fs = require('fs'); const path = require('path');
const NM = '/workspace/znft/chain/node_modules/';
const { Connection, Keypair, Transaction, Message } = require(NM + '@solana/web3.js'); const nacl = require(NM + 'tweetnacl'); const bs58 = require(NM + 'bs58').default || require(NM + 'bs58');
const BASE = process.argv[2] || 'http://127.0.0.1:8932'; const OUT = '/workspace/znft/screens/'; const TAG = process.env.TAG || 'local'; const BUY = process.env.BUY || '';
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync('/workspace/znft/chain/test-buyer-keypair.json'))));
let fail = 0; const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const mode of ['desktop', 'mobile']) {
    const ctx = await b.newContext(mode === 'desktop' ? { viewport: { width: 1440, height: 900 }, locale: 'it-IT' } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Mobile' });
    await ctx.addInitScript(() => { localStorage.setItem('ov_age18_v1', '1'); });
    await ctx.exposeFunction('__sign', (arr) => bs58.encode(nacl.sign.detached(Uint8Array.from(arr), kp.secretKey)));
    await ctx.exposeFunction('__signSend', async (msg) => { const tx = Transaction.populate(Message.from(bs58.decode(msg))); tx.sign(kp); const s = await conn.sendRawTransaction(tx.serialize()); await conn.confirmTransaction(s, 'confirmed'); return s; });
    await ctx.addInitScript((pk) => { const P = { isPhantom: true, connect: async () => ({ publicKey: { toString: () => pk } }), on() {}, disconnect: async () => {},
      signMessage: async (bytes) => { const s = await window.__sign(Array.from(bytes)); const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n = 0n; for (const c of s) n = n * 58n + BigInt(A.indexOf(c)); const out = new Uint8Array(64); for (let i = 63; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; } return { signature: out }; },
      request: async ({ method, params }) => { if (method !== 'signAndSendTransaction') throw new Error('metodo non simulato'); return { signature: await window.__signSend(params.message) }; } };
      window.phantom = { solana: P }; window.solana = P; }, kp.publicKey.toBase58());
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); }); p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
    const shot = async (name, full) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}${TAG}-${mode}-${name}.png`, fullPage: !!full }); };
    const check = async (name, sel) => { const ok = await p.waitForSelector(sel, { timeout: 15000 }).catch(() => null); const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); log(mode, name, ok ? 'ok' : 'MANCA ' + sel, 'overflowX=' + ov); if (!ok || ov) fail++; };
    await p.goto(BASE + '/znft/', { waitUntil: 'networkidle' }); await check('home', '.zcard'); await shot('home', mode === 'desktop');
    await p.goto(BASE + '/znft/#/collezioni', { waitUntil: 'networkidle' }); await check('collezioni', '.zcard');
    await p.goto(BASE + '/znft/#/collezione/collezione-di-esempio', { waitUntil: 'networkidle' }); await check('collezione', '.zcollhead'); await shot('collezione');
    const first = await p.$eval('a.zcard[href^="#/opera/"]', a => a.getAttribute('href'));
    await p.goto(BASE + '/znft/' + first, { waitUntil: 'networkidle' }); await p.reload({ waitUntil: 'networkidle' }); await check('opera', '#brules'); await p.click('#brules'); await p.waitForSelector('#rulesout .zcode'); 
    const same = await p.$eval('#rulesout', e => e.textContent.includes('uguale a quello del server') && e.textContent.includes('Esito: OK')); log(mode, 'regole nel browser', same ? 'ok' : 'NO'); if (!same) fail++; await shot('opera', mode === 'desktop');
    for (const r of ['vpay', 'regole', 'crea', 'upgrade']) { await p.goto(BASE + '/znft/#/' + r, { waitUntil: 'networkidle' }); await check(r, '.zbox'); await shot(r, r === 'regole' && mode === 'desktop'); }
    await p.goto(BASE + '/znft/#/miei', { waitUntil: 'networkidle' }); await p.click('#mgo'); await p.waitForSelector('#msave', { timeout: 20000 }).catch(() => {}); await check('miei (login firmato)', '#msave'); await shot('miei');
    if (BUY && mode === 'desktop') {
      await p.goto(BASE + '/znft/#/opera/' + BUY, { waitUntil: 'networkidle' }); await p.waitForSelector('#bbuy'); await p.click('#bbuy');
      await p.waitForFunction(() => /Fatto|consegna/.test(document.querySelector('#ztoast').textContent), null, { timeout: 90000 }).catch(() => {});
      const t = await p.$eval('#ztoast', e => e.textContent); log(mode, 'acquisto UI →', t); if (!/Fatto/.test(t)) fail++;
      await p.waitForTimeout(1500); await shot('acquistato', true);
    }
    if (!/^https/.test(BASE)) { await p.goto(BASE + '/znft/admin/', { waitUntil: 'networkidle' }); await shot('admin'); } else { const r = await fetch(BASE + '/znft/admin/'); log(mode, 'admin senza password →', r.status); if (r.status !== 401) fail++; }
    if (errs.length) { fail++; errs.forEach(e => log('   ', e)); }
    await ctx.close();
  }
  await b.close(); log(fail ? `FALLITI ${fail}` : 'TUTTO OK'); process.exit(fail ? 1 : 0);
})();
