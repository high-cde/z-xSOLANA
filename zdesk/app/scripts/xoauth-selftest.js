'use strict';
// Test offline di Connetti X (PKCE, state, sessione, 503, mock token). Uso: node scripts/xoauth-selftest.js
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PREV = {
  X_CLIENT_ID: process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  ZDESK_SESSION_SECRET: process.env.ZDESK_SESSION_SECRET,
  X_REDIRECT_URI: process.env.X_REDIRECT_URI,
};

function setEnv(map) {
  for (const [k, v] of Object.entries(map)) {
    if (v == null || v === '') delete process.env[k];
    else process.env[k] = v;
  }
  // il modulo legge process.env a ogni chiamata (niente cache)
}

const xo = require('../lib/xoauth');

let n = 0;
const t = (name, fn) => {
  const r = fn();
  if (r && typeof r.then === 'function') {
    return r.then(() => { n++; console.log('ok', name); });
  }
  n++;
  console.log('ok', name);
  return Promise.resolve();
};

function mockFetcher(plan) {
  const calls = [];
  const fetcher = async (url, opts) => {
    const entry = { url: String(url), method: (opts && opts.method) || 'GET', headers: (opts && opts.headers) || {}, body: opts && opts.body };
    calls.push(entry);
    const item = plan.find((p) => String(url).startsWith(p.match) || String(url).includes(p.match));
    if (!item) throw new Error('fetch inattesa: ' + url);
    const body = typeof item.body === 'function' ? item.body(entry) : item.body;
    return {
      ok: item.status >= 200 && item.status < 300,
      status: item.status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    };
  };
  fetcher.calls = calls;
  return fetcher;
}

async function main() {
  await t('PKCE: verifier 43-128 unreserved, challenge S256', () => {
    const v = xo.randomVerifier();
    assert.ok(/^[A-Za-z0-9\-._~]{43,128}$/.test(v), v);
    const ch = xo.challengeS256(v);
    const expected = Buffer.from(crypto.createHash('sha256').update(v, 'ascii').digest()).toString('base64url');
    assert.strictEqual(ch, expected);
    const v2 = xo.randomVerifier();
    assert.notStrictEqual(v, v2);
    assert.notStrictEqual(ch, xo.challengeS256(v2));
  });

  await t('state casuale e distinto', () => {
    const a = xo.randomState();
    const b = xo.randomState();
    assert.ok(a.length >= 16 && b.length >= 16);
    assert.notStrictEqual(a, b);
    assert.ok(xo.safeEqual(a, a));
    assert.ok(!xo.safeEqual(a, b));
    assert.ok(!xo.safeEqual(a, a + 'x'));
  });

  await t('firma sessione: valida, manomessa, scaduta', () => {
    const secret = 'test-secret-32-bytes-minimum_______';
    const now = Date.now();
    const tok = xo.sign({ typ: 'user', id: '1', username: 'ZDOS_Core', iat: now, exp: now + 60_000 }, secret);
    const data = xo.unsign(tok, secret);
    assert.strictEqual(data.username, 'ZDOS_Core');
    assert.strictEqual(xo.unsign(tok.slice(0, -2) + 'ab', secret), null);
    assert.strictEqual(xo.unsign(tok, 'altro-segreto-diverso-del-tutto'), null);
    const expired = xo.sign({ typ: 'user', id: '1', username: 'x', exp: now - 1000 }, secret);
    assert.strictEqual(xo.unsign(expired, secret), null);
  });

  await t('parse cookie e header Set-Cookie', () => {
    const c = xo.parseCookies('a=1; ' + xo.FLOW_COOKIE + '=abc%2Edef; other=z');
    assert.strictEqual(c.a, '1');
    assert.strictEqual(c[xo.FLOW_COOKIE], 'abc.def');
    const h = xo.cookieHeader('n', 'v', { maxAgeSec: 10, secure: true });
    assert.ok(h.includes('HttpOnly'));
    assert.ok(h.includes('SameSite=Lax'));
    assert.ok(h.includes('Secure'));
    assert.ok(h.includes('Path=/'));
  });

  await t('503 senza configurazione (handler)', async () => {
    setEnv({ X_CLIENT_ID: '', X_CLIENT_SECRET: '', ZDESK_SESSION_SECRET: '', X_REDIRECT_URI: '' });
    assert.strictEqual(xo.configured(), false);
    const res = mockRes();
    xo.sendUnconfigured(res);
    assert.strictEqual(res.statusCode, 503);
    assert.deepStrictEqual(JSON.parse(res.body), { error: 'X non configurato' });
    const res2 = mockRes();
    xo.startHandler(mockReq(), res2);
    assert.strictEqual(res2.statusCode, 503);
    assert.deepStrictEqual(JSON.parse(res2.body), { error: 'X non configurato' });
    const res3 = mockRes();
    xo.meHandler(mockReq(), res3);
    assert.strictEqual(res3.statusCode, 503);
  });

  await t('start con config: cookie di flusso e redirect authorize', () => {
    setEnv({
      X_CLIENT_ID: 'test-client-id',
      X_CLIENT_SECRET: 'test-client-secret',
      ZDESK_SESSION_SECRET: 'session-secret-for-unit-tests-0001',
      X_REDIRECT_URI: xo.DEFAULT_REDIRECT,
    });
    assert.ok(xo.configured());
    const res = mockRes();
    xo.startHandler(mockReq(), res);
    assert.strictEqual(res.statusCode, 302);
    assert.ok(res.headers.location.startsWith(xo.AUTH_URL + '?'));
    const u = new URL(res.headers.location);
    assert.strictEqual(u.searchParams.get('response_type'), 'code');
    assert.strictEqual(u.searchParams.get('client_id'), 'test-client-id');
    assert.strictEqual(u.searchParams.get('redirect_uri'), xo.DEFAULT_REDIRECT);
    assert.strictEqual(u.searchParams.get('scope'), xo.SCOPES);
    assert.strictEqual(u.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(u.searchParams.get('state'));
    assert.ok(u.searchParams.get('code_challenge'));
    const setc = [].concat(res.headers['set-cookie'] || []);
    assert.ok(setc.some((c) => c.startsWith(xo.FLOW_COOKIE + '=') && c.includes('HttpOnly') && c.includes('SameSite=Lax')));
    assert.ok(!String(res.headers.location).includes('offline.access'));
  });

  await t('mock token: users/me, revoke, token non conservato', async () => {
    setEnv({
      X_CLIENT_ID: 'test-client-id',
      X_CLIENT_SECRET: 'test-client-secret',
      ZDESK_SESSION_SECRET: 'session-secret-for-unit-tests-0001',
    });
    const secretToken = 'ACCESS_TOKEN_MUST_NOT_BE_STORED_xyz';
    const fetcher = mockFetcher([
      { match: xo.TOKEN_URL, status: 200, body: { access_token: secretToken, token_type: 'bearer', expires_in: 7200, scope: xo.SCOPES } },
      { match: xo.ME_URL, status: 200, body: { data: { id: '2117284332817789170', username: 'ZDOS_Core', name: 'ZDOS Core', profile_image_url: 'https://pbs.twimg.com/profile_images/x.png' } } },
      { match: xo.REVOKE_URL, status: 200, body: { revoked: true } },
    ]);
    const { user } = await xo.completeLogin({ code: 'test-code', verifier: xo.randomVerifier(), fetcher });
    assert.strictEqual(user.username, 'ZDOS_Core');
    assert.strictEqual(user.id, '2117284332817789170');
    assert.strictEqual(user.profile_image, 'https://pbs.twimg.com/profile_images/x.png');
    const dumped = JSON.stringify(user);
    assert.ok(!dumped.includes(secretToken));
    assert.ok(!dumped.includes('access_token'));
    const urls = fetcher.calls.map((c) => c.url);
    assert.ok(urls.some((u) => u.startsWith(xo.TOKEN_URL)));
    assert.ok(urls.some((u) => u.startsWith(xo.ME_URL)));
    assert.ok(urls.some((u) => u.startsWith(xo.REVOKE_URL)));
    const tokCall = fetcher.calls.find((c) => c.url.startsWith(xo.TOKEN_URL));
    assert.ok(String(tokCall.headers.Authorization).startsWith('Basic '));
    const decoded = Buffer.from(String(tokCall.headers.Authorization).slice(6), 'base64').toString('utf8');
    assert.strictEqual(decoded, 'test-client-id:test-client-secret');
    const rev = fetcher.calls.find((c) => c.url.startsWith(xo.REVOKE_URL));
    assert.ok(String(rev.body).includes('token=' + encodeURIComponent(secretToken)) || String(rev.body).includes(secretToken));
  });

  await t('avatar non https pbs/abs viene scartato', async () => {
    const fetcher = mockFetcher([
      { match: xo.TOKEN_URL, status: 200, body: { access_token: 't' } },
      { match: xo.ME_URL, status: 200, body: { data: { id: '1', username: 'a', profile_image_url: 'javascript:alert(1)' } } },
      { match: xo.REVOKE_URL, status: 200, body: {} },
    ]);
    const { user } = await xo.completeLogin({ code: 'c', verifier: 'v', fetcher });
    assert.strictEqual(user.profile_image, '');
  });

  await t('frontend: Accedi con X / Disconnetti, niente post automatici, niente follower', () => {
    const src = ['public/app.js', 'lib/xoauth.js', 'server.js']
      .map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
    assert.ok(src.includes('Accedi con X'));
    assert.ok(src.includes('/api/connect/x/start'));
    assert.ok(src.includes('/api/connect/x/logout'));
    assert.ok(!/create_post|tweets\/\d+\/liking_users|\/2\/followers|\/2\/friends|offline\.access/.test(src));
    assert.ok(src.includes('tweet.read users.read'));
  });

  await t('callback URI di default senza /zdesk (host alla radice)', () => {
    assert.strictEqual(xo.DEFAULT_REDIRECT, 'https://zdesk.x-zdos.it/api/connect/x/callback');
    assert.ok(!xo.DEFAULT_REDIRECT.includes('/zdesk/'));
  });

  restoreEnv();
  console.log(n + ' test ok');
}

function restoreEnv() {
  setEnv({
    X_CLIENT_ID: PREV.X_CLIENT_ID || '',
    X_CLIENT_SECRET: PREV.X_CLIENT_SECRET || '',
    ZDESK_SESSION_SECRET: PREV.ZDESK_SESSION_SECRET || '',
    X_REDIRECT_URI: PREV.X_REDIRECT_URI || '',
  });
}

function mockReq(extra) {
  const headers = Object.assign({ 'x-forwarded-proto': 'https' }, extra && extra.headers);
  return {
    get(name) {
      const k = String(name).toLowerCase();
      if (k === 'cookie') return headers.cookie || headers.Cookie || '';
      if (k === 'x-forwarded-proto') return headers['x-forwarded-proto'] || '';
      if (k === 'x-forwarded-prefix') return headers['x-forwarded-prefix'] || '';
      if (k === 'host') return headers.host || 'zdesk.x-zdos.it';
      return headers[k] || '';
    },
    query: (extra && extra.query) || {},
    secure: false,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = JSON.stringify(o); this.headers['content-type'] = 'application/json'; return this; },
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    redirect(code, url) { this.statusCode = code; this.headers.location = url; },
  };
  return res;
}

main().catch((e) => {
  restoreEnv();
  console.error('FAIL', e);
  process.exit(1);
});
