// Test headless di zRoute: quote reali Jupiter + K.I.R.A. reali. Phantom simulato: la firma viene SEMPRE rifiutata (nessun invio).
const { chromium } = require('/workspace/pwtest/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8899/zroute/';
const SHOTS = process.argv[3] || '/workspace/zroute/screens/';
const PK = '9xMJ7MgxZuxG5PhV3TMDdd5ddqKA1dSPnSjxyDU7DL5M';
const mockPhantom = `window.__signed=0;window.phantom={solana:{isPhantom:true,publicKey:null,on(){},
  async connect(o){ if(o&&o.onlyIfTrusted) throw new Error('no'); this.publicKey={toString:()=>'${PK}'}; return {publicKey:this.publicKey}; },
  async disconnect(){}, async signTransaction(){ window.__signed++; throw new Error('TEST: firma rifiutata, nessun invio'); },
  async signAndSendTransaction(){ window.__signed++; throw new Error('TEST: firma rifiutata, nessun invio'); } }};`;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = {};
  for (const [n, vp] of [['desktop', { viewport: { width: 1440, height: 1000 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const c = await b.newContext({ ...vp, locale: 'it-IT' }); const p = await c.newPage(); const errs = [];
    await p.addInitScript(mockPhantom);
    p.on('pageerror', (e) => errs.push(e.message));
    // rimuove simulationError (wallet di test senza fondi) per arrivare fino alla verifica della tip e alla firma (rifiutata)
    await p.route('**/swap/v1/swap', async (route) => { const r = await route.fetch(); const j = await r.json(); res.jupSwapPrio = j.prioritizationType; delete j.simulationError; await route.fulfill({ response: r, json: j }); });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.screenshot({ path: SHOTS + 'zroute-home-' + n + '.png', fullPage: n === 'desktop' });
    // 1) SOL -> USDC
    await p.fill('#amount', '0,1'); await p.click('#quote');
    await p.waitForSelector('#route .steps', { timeout: 30000 });
    res[n + '_sol_usdc'] = { out: await p.textContent('#out-amt'), steps: await p.$$eval('#route .steps li', (l) => l.map((x) => x.textContent)), verdicts: await p.$$eval('.verdict', (l) => l.map((x) => x.textContent)) };
    await p.screenshot({ path: SHOTS + 'zroute-quote-sol-usdc-' + n + '.png', fullPage: true });
    // 2) firma con Jito: connetti, ack, swap -> verifica tip -> firma rifiutata dal mock
    await p.click('#connect'); await p.check('#mev'); await p.click('#quote'); await p.waitForSelector('#route .steps', { timeout: 30000 });
    await p.check('#ack1'); await p.click('#swap');
    await p.waitForFunction(() => /Fermato/.test(document.getElementById('log').textContent), null, { timeout: 30000 });
    res[n + '_jito_log'] = await p.textContent('#log');
    await p.evaluate(() => document.getElementById('go').scrollIntoView());
    await p.screenshot({ path: SHOTS + 'zroute-jito-check-' + n + '.png' });
    // 3) SOL -> $DSN (nessuna pool)
    await p.selectOption('#out-tok', '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4'); await p.click('#quote');
    await p.waitForSelector('#route .alert', { timeout: 30000 });
    res[n + '_dsn'] = { route: await p.textContent('#route'), verdict: (await p.$$eval('.verdict', (l) => l.map((x) => x.textContent)))[0] };
    await p.evaluate(() => document.getElementById('res').scrollIntoView());
    await p.screenshot({ path: SHOTS + 'zroute-dsn-noroute-' + n + '.png', fullPage: n === 'desktop' });
    // 4) SOL -> VELVET
    await p.selectOption('#out-tok', '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump'); await p.uncheck('#mev'); await p.click('#quote');
    await p.waitForSelector('#route .steps, #route .alert', { timeout: 30000 });
    res[n + '_velvet'] = { route: (await p.textContent('#route')).slice(0, 300), verdict: (await p.$$eval('.verdict', (l) => l.map((x) => x.textContent)))[0] };
    res[n + '_signed_calls'] = await p.evaluate(() => window.__signed);
    res[n + '_errors'] = errs;
    await c.close();
  }
  await b.close();
  console.log(JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
