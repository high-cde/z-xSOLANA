const { chromium } = require('playwright-core');
const web3 = require('@solana/web3.js');
const nacl = require('tweetnacl');
const BASE = process.argv[2] || 'http://127.0.0.1:8931/';
const OUT = process.env.OUT || './screens/';
const SIGN = process.env.SIGN === '1';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const kp = web3.Keypair.generate();
  for (const mode of ['desktop', 'mobile']) {
    const ctx = await b.newContext(mode === 'desktop' ? { viewport: { width: 1440, height: 900 }, locale: 'it-IT' } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'it-IT' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    if (SIGN && mode === 'desktop') {
      await p.exposeFunction('__sign', (msg) => Array.from(nacl.sign.detached(Uint8Array.from(msg), kp.secretKey)));
      await ctx.addInitScript((pk) => {
        window.phantom = { solana: { isPhantom: true, publicKey: null,
          connect: async (o) => { if (o && o.onlyIfTrusted) throw new Error('no'); const P = window.solanaWeb3.PublicKey; return { publicKey: new P(pk) }; },
          disconnect: async () => {},
          signTransaction: async (tx) => { const sig = await window.__sign(Array.from(tx.serializeMessage())); tx.addSignature(tx.feePayer, Uint8Array.from(sig)); return tx; } } };
      }, kp.publicKey.toBase58());
    }
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    const L = async () => (await p.$eval('#clog', (e) => e.innerText)).split('\n').slice(-6).join('\n');
    if (mode === 'desktop') {
      await p.click('[data-panel=compile]'); await p.click('#bCompile'); await p.waitForTimeout(400);
      console.log('compile:', (await p.$eval('#compileOut', (e) => e.innerText)).split('\n')[0]);
      await p.click('#bRun'); await p.waitForTimeout(600);
      console.log('run:\n' + await L());
      await p.screenshot({ path: OUT + 'desktop-compile.png' });
      await p.selectOption('#toolchain', 'rust'); await p.waitForTimeout(500);
      console.log('rust:', (await p.$eval('#compileOut', (e) => e.innerText)).split('\n')[0]);
      await p.selectOption('#toolchain', 'zlangc');
      await p.click('[data-panel=kira]'); await p.click('#kBtn'); await p.waitForTimeout(4000);
      console.log('kira:', (await p.$eval('#kOut', (e) => e.innerText)).slice(0, 400));
      await p.screenshot({ path: OUT + 'desktop-kira.png' });
      await p.click('[data-panel=zcomm]'); await p.click('#zPing'); await p.waitForTimeout(3000);
      console.log('zcomm:', await L());
      await p.screenshot({ path: OUT + 'desktop-zcomm.png' });
      await p.click('[data-panel=deploy]'); await p.waitForTimeout(300);
      if (SIGN) {
        await p.click('#dConnect'); await p.waitForTimeout(800);
        await p.waitForTimeout(500);
        console.log('airdrop:', await L());
        await p.click('#dAnchor'); await p.waitForTimeout(600); await p.click('#mYes'); await p.waitForTimeout(20000);
        console.log('anchor:', await L());
        const sig = await p.evaluate(() => (JSON.parse(localStorage.getItem('zide.anchors') || '[]')[0] || {}).sig);
        if (sig) { await p.fill('#vSig', sig); await p.click('#vBtn'); await p.waitForTimeout(4000); console.log('verify:', await L()); }
      }
      console.log('FULL:\n' + await p.$eval('#clog', (e) => e.innerText));
      await p.screenshot({ path: OUT + 'desktop-deploy.png' });
      await p.selectOption('#cluster', 'mainnet-beta'); await p.waitForTimeout(400);
      await p.screenshot({ path: OUT + 'desktop-mainnet-warning.png' });
      await p.click('#mNo');
      await p.click('[data-panel=files]'); await p.screenshot({ path: OUT + 'desktop-ide.png' });
    } else {
      await p.screenshot({ path: OUT + 'mobile-editor.png' });
      await p.click('.mbar [data-view=panel]'); await p.waitForTimeout(300);
      await p.click('[data-panel=compile]'); await p.click('#bCompile'); await p.waitForTimeout(400);
      await p.screenshot({ path: OUT + 'mobile-compile.png' });
      await p.click('[data-panel=deploy]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + 'mobile-deploy.png' });
      await p.click('.mbar [data-view=console]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + 'mobile-console.png' });
      const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      console.log('mobile overflow-x:', ov);
    }
    console.log(mode, 'errors:', errs.length ? errs : 'nessuno');
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
