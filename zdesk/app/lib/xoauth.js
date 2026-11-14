'use strict';

/**
 * ZDESK · accesso X (OAuth 2.0 Authorization Code + PKCE).
 * Solo lettura: scope tweet.read users.read. Nessun post, nessun elenco follower.
 * L'access token si usa una volta per GET /2/users/me e poi viene revocato:
 * in sessione restano solo id, username, name, profile_image.
 */
const crypto = require('crypto');

const AUTH_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const REVOKE_URL = 'https://api.x.com/2/oauth2/revoke';
const ME_URL = 'https://api.x.com/2/users/me';
const DEFAULT_REDIRECT = 'https://zdesk.x-zdos.it/api/connect/x/callback';
const SCOPES = 'tweet.read users.read';
const FLOW_COOKIE = 'zdesk_x_flow';
const USER_COOKIE = 'zdesk_x_user';
const FLOW_MAX_MS = 10 * 60 * 1000;
const USER_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_AVATAR = /^https:\/\/(pbs\.twimg\.com|abs\.twimg\.com)\//i;

function configured() {
  return Boolean(
    process.env.X_CLIENT_ID
    && process.env.X_CLIENT_SECRET
    && process.env.ZDESK_SESSION_SECRET
  );
}

function redirectUri() {
  const u = String(process.env.X_REDIRECT_URI || DEFAULT_REDIRECT).trim();
  return u || DEFAULT_REDIRECT;
}

function clientId() { return String(process.env.X_CLIENT_ID || ''); }
function clientSecret() { return String(process.env.X_CLIENT_SECRET || ''); }
function sessionSecret() { return String(process.env.ZDESK_SESSION_SECRET || ''); }

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function randomVerifier() {
  // 32 byte → 43 caratteri unreserved (RFC 7636)
  return b64url(crypto.randomBytes(32));
}

function challengeS256(verifier) {
  return b64url(crypto.createHash('sha256').update(verifier, 'ascii').digest());
}

function randomState() {
  return b64url(crypto.randomBytes(24));
}

function sign(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}

function unsign(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  let got;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  if (data.exp && Date.now() > Number(data.exp)) return null;
  return data;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(header) {
  const out = Object.create(null);
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  });
  return out;
}

function cookieHeader(name, value, { maxAgeSec, secure }) {
  let c = name + '=' + encodeURIComponent(value)
    + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.max(0, Number(maxAgeSec) || 0);
  if (secure) c += '; Secure';
  return c;
}

function isSecureReq(req) {
  const proto = String(req.get('X-Forwarded-Proto') || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  if (req.secure) return true;
  return String(process.env.ZDESK_COOKIE_SECURE || '') === '1';
}

function appendCookie(res, header) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', header);
  else if (Array.isArray(prev)) res.setHeader('Set-Cookie', prev.concat(header));
  else res.setHeader('Set-Cookie', [prev, header]);
}

function clearCookies(req, res) {
  const secure = isSecureReq(req);
  appendCookie(res, cookieHeader(FLOW_COOKIE, '', { maxAgeSec: 0, secure }));
  appendCookie(res, cookieHeader(USER_COOKIE, '', { maxAgeSec: 0, secure }));
}

function publicUser(data) {
  if (!data || !data.username || !data.id) return null;
  return {
    id: String(data.id),
    username: String(data.username),
    name: data.name ? String(data.name) : '',
    profile_image: data.profile_image && ALLOWED_AVATAR.test(data.profile_image)
      ? String(data.profile_image)
      : '',
  };
}

function readUser(req) {
  if (!configured()) return null;
  const cookies = parseCookies(req.get('Cookie'));
  const data = unsign(cookies[USER_COOKIE], sessionSecret());
  return publicUser(data);
}

function publicStatus(req) {
  if (!configured()) return { configured: false, connected: false, user: null };
  const user = readUser(req);
  return { configured: true, connected: Boolean(user), user };
}

function sendUnconfigured(res) {
  res.status(503).json({ error: 'X non configurato' });
}

function authorizeUrl(state, challenge) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return AUTH_URL + '?' + p.toString();
}

function startHandler(req, res) {
  if (!configured()) return sendUnconfigured(res);
  const state = randomState();
  const verifier = randomVerifier();
  const now = Date.now();
  const token = sign({
    typ: 'flow',
    state,
    verifier,
    iat: now,
    exp: now + FLOW_MAX_MS,
  }, sessionSecret());
  appendCookie(res, cookieHeader(FLOW_COOKIE, token, {
    maxAgeSec: Math.floor(FLOW_MAX_MS / 1000),
    secure: isSecureReq(req),
  }));
  res.redirect(302, authorizeUrl(state, challengeS256(verifier)));
}

function basicAuthHeader(id, secret) {
  return 'Basic ' + Buffer.from(String(id) + ':' + String(secret), 'utf8').toString('base64');
}

async function defaultFetch(url, opts) {
  return fetch(url, opts);
}

async function formPost(fetcher, url, body, headers) {
  const r = await fetcher(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...headers,
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json };
}

async function exchangeCode({ code, verifier, fetcher }) {
  const auth = basicAuthHeader(clientId(), clientSecret());
  const { ok, status, json } = await formPost(fetcher, TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
    client_id: clientId(),
  }, { Authorization: auth });
  if (!ok || !json || !json.access_token) {
    const err = new Error('scambio codice X non riuscito');
    err.status = 401;
    err.httpStatus = status;
    throw err;
  }
  return json;
}

async function fetchMe(accessToken, fetcher) {
  const u = ME_URL + '?user.fields=profile_image_url,name,username';
  const r = await fetcher(u, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json',
    },
  });
  const json = await r.json().catch(() => null);
  if (!r.ok || !json || !json.data || !json.data.id || !json.data.username) {
    const err = new Error('profilo X non disponibile');
    err.status = 502;
    throw err;
  }
  return {
    id: String(json.data.id),
    username: String(json.data.username),
    name: json.data.name ? String(json.data.name) : '',
    profile_image: json.data.profile_image_url && ALLOWED_AVATAR.test(json.data.profile_image_url)
      ? String(json.data.profile_image_url)
      : '',
  };
}

async function revokeToken(accessToken, fetcher) {
  if (!accessToken) return;
  try {
    await formPost(fetcher, REVOKE_URL, {
      token: accessToken,
      token_type_hint: 'access_token',
      client_id: clientId(),
    }, { Authorization: basicAuthHeader(clientId(), clientSecret()) });
  } catch {
    // Il token non viene comunque conservato.
  }
}

async function completeLogin({ code, verifier, fetcher }) {
  const fetchFn = fetcher || defaultFetch;
  let accessToken = null;
  try {
    const tok = await exchangeCode({ code, verifier, fetcher: fetchFn });
    accessToken = tok.access_token;
    const user = await fetchMe(accessToken, fetchFn);
    return { user };
  } finally {
    await revokeToken(accessToken, fetchFn);
    accessToken = null;
  }
}

async function callbackHandler(req, res, returnUrl) {
  if (!configured()) return sendUnconfigured(res);
  const go = (ok) => res.redirect(302, returnUrl(ok ? 'ok' : 'err'));
  if (req.query && req.query.error) return go(false);
  const code = String((req.query && req.query.code) || '');
  const state = String((req.query && req.query.state) || '');
  if (!code || !state) return go(false);
  const cookies = parseCookies(req.get('Cookie'));
  const flow = unsign(cookies[FLOW_COOKIE], sessionSecret());
  if (!flow || flow.typ !== 'flow' || !flow.verifier || !safeEqual(flow.state, state)) {
    clearCookies(req, res);
    return go(false);
  }
  try {
    const { user } = await completeLogin({ code, verifier: flow.verifier });
    const now = Date.now();
    const token = sign({
      typ: 'user',
      id: user.id,
      username: user.username,
      name: user.name,
      profile_image: user.profile_image,
      iat: now,
      exp: now + USER_MAX_MS,
    }, sessionSecret());
    const secure = isSecureReq(req);
    appendCookie(res, cookieHeader(FLOW_COOKIE, '', { maxAgeSec: 0, secure }));
    appendCookie(res, cookieHeader(USER_COOKIE, token, {
      maxAgeSec: Math.floor(USER_MAX_MS / 1000),
      secure,
    }));
    return go(true);
  } catch (e) {
    console.error('xoauth callback', e.message || e);
    clearCookies(req, res);
    return go(false);
  }
}

function meHandler(req, res) {
  if (!configured()) return sendUnconfigured(res);
  const user = readUser(req);
  res.json({ connected: Boolean(user), user, readOnly: true });
}

function logoutHandler(req, res) {
  if (!configured()) return sendUnconfigured(res);
  clearCookies(req, res);
  res.json({ ok: true, connected: false });
}

module.exports = {
  AUTH_URL,
  TOKEN_URL,
  REVOKE_URL,
  ME_URL,
  DEFAULT_REDIRECT,
  SCOPES,
  FLOW_COOKIE,
  USER_COOKIE,
  FLOW_MAX_MS,
  USER_MAX_MS,
  configured,
  redirectUri,
  randomVerifier,
  challengeS256,
  randomState,
  sign,
  unsign,
  safeEqual,
  parseCookies,
  cookieHeader,
  publicStatus,
  publicUser,
  sendUnconfigured,
  startHandler,
  callbackHandler,
  meHandler,
  logoutHandler,
  completeLogin,
  exchangeCode,
  fetchMe,
  revokeToken,
  authorizeUrl,
};
