'use strict';
// Test offline di lib/ecosystem.js (solo 127.0.0.1, nessuna rete esterna).
// Uso: node scripts/ecosystem-selftest.js
const assert = require('assert');
const http = require('http');
const eco = require('../lib/ecosystem');
const { cache } = require('../lib/cache');

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('ok', name); };

function serve(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

(async () => {
  const { srv, base } = await serve((req, res) => {
    if (req.url === '/ok') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>ok</html>'); return; }
    if (req.url === '/redir') { res.writeHead(301, { Location: 'https://x-zdos.it/' }); res.end(); return; }
    if (req.url === '/nohead') { if (req.method !== 'GET') { res.writeHead(405); res.end(); return; } res.writeHead(200); res.end('x'); return; }
    if (req.url === '/err') { res.writeHead(503); res.end('down'); return; }
    if (req.url === '/slow') { setTimeout(() => { try { res.end('tardi'); } catch { /* */ } }, 3000); return; }
    res.writeHead(404); res.end();
  });
  try {
    await t('200 con size e sha', async () => {
      const r = await eco.checkUrl(base + '/ok');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.bytes, 15);
      assert.match(r.sha, /^[0-9a-f]{12}$/);
      assert.ok(r.ms >= 0);
      assert.strictEqual(r.tlsValidTo, null);
    });
    await t('redirect non seguito, location riportata', async () => {
      const r = await eco.checkUrl(base + '/redir');
      assert.strictEqual(r.status, 301);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.location, 'https://x-zdos.it/');
    });
    await t('usa GET (sito che rifiuta HEAD con 405)', async () => {
      const r = await eco.checkUrl(base + '/nohead');
      assert.strictEqual(r.status, 200);
    });
    await t('503 = non ok', async () => {
      const r = await eco.checkUrl(base + '/err');
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.ok, false);
    });
    await t('timeout', async () => {
      const r = await eco.checkUrl(base + '/slow', { timeout: 300 });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.status, null);
      assert.match(r.error, /timeout/);
    });
    await t('connessione rifiutata', async () => {
      const r = await eco.checkUrl('http://127.0.0.1:1/');
      assert.strictEqual(r.ok, false);
      assert.ok(r.error);
    });
    await t('parse dev.to: solo campi utili, solo URL dev.to', async () => {
      const items = eco.parseDevto([
        { title: 'A', url: 'https://dev.to/asapkali/a', published_at: '2026-10-30T19:46:28Z', reading_time_minutes: 1, public_reactions_count: 0, comments_count: 0, tag_list: ['rust', 'c'], body_html: '<p>no</p>' },
        { title: 'B', url: 'https://evil.example/b' },
        { title: '', url: 'https://dev.to/x' },
      ]);
      assert.strictEqual(items.length, 1);
      assert.deepStrictEqual(Object.keys(items[0]).sort(), ['comments', 'publishedAt', 'reactions', 'readingMinutes', 'tags', 'title', 'url']);
      assert.deepStrictEqual(items[0].tags, ['rust', 'c']);
      assert.throws(() => eco.parseDevto({ error: 'x' }));
    });
    await t('dev.to in errore senza cache: lista vuota con errore', async () => {
      cache.map.delete('eco:devto');
      const d = await eco.getDevto(async () => { throw new Error('HTTP 429'); });
      assert.deepStrictEqual(d.items, []);
      assert.strictEqual(d.error, 'HTTP 429');
    });
    await t('dev.to in errore con cache: dati vecchi marcati stale', async () => {
      cache.map.delete('eco:devto');
      await eco.getDevto(async () => JSON.stringify([{ title: 'A', url: 'https://dev.to/asapkali/a' }]));
      cache.map.get('eco:devto').expires = 0;
      const d = await eco.getDevto(async () => { throw new Error('timeout'); });
      assert.strictEqual(d.items.length, 1);
      assert.strictEqual(d.stale, true);
    });
    await t('elenco siti: VelvetHub 18+, un solo link RPG, niente pump.fun', async () => {
      const v = eco.SITES.find((s) => s.id === 'velvet');
      assert.strictEqual(v.adult, true);
      assert.strictEqual(eco.SITES.filter((s) => /rpg\.html/.test(s.url)).length, 1);
      assert.ok(!eco.SITES.some((s) => /\?v=/.test(s.url)));
      assert.ok(!JSON.stringify(eco.SITES).includes('pump.fun'));
      for (const s of eco.SITES) assert.match(s.url, /^https:\/\//);
    });
    await t('getEcosystem: cache 60 s e una sola verifica in volo', async () => {
      cache.map.delete('eco:status');
      let calls = 0;
      const deps = {
        sites: [{ id: 'a', name: 'A', url: base + '/ok' }, { id: 'b', name: 'B', url: base + '/err', adult: true }],
        checkUrl: (u) => { calls++; return eco.checkUrl(u); },
        fetchText: async () => '[]',
      };
      const [a, b] = await Promise.all([eco.getEcosystem(deps), eco.getEcosystem(deps)]);
      assert.strictEqual(calls, 2);
      assert.strictEqual(a.up, 1);
      assert.strictEqual(a.total, 2);
      assert.strictEqual(a.readOnly, true);
      assert.strictEqual(b.sites[1].adult, true);
      const c = await eco.getEcosystem(deps);
      assert.strictEqual(c.cached, true);
      assert.strictEqual(calls, 2);
      assert.strictEqual(eco.STATUS_TTL_MS, 60_000);
    });
  } finally {
    srv.close();
  }
  console.log('ecosystem selftest: ' + n + ' ok');
})().catch((e) => { console.error('KO', e); process.exit(1); });
