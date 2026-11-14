
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const sources = require('./lib/sources');
const { getDesk } = require('./lib/desk');
const { getCopyTrader, startCopyTraderIfNeeded, startCopySignalPoller } = require('./lib/copytrader');
const ninja = require('./lib/ninja');
const wallet = require('./lib/wallet');
const { readPublicAntifake } = require('./lib/antifake');
const copytop = require('./lib/copytop');
const radar = require('./lib/radar');
const staking = require('./lib/staking');
const connect = require('./lib/connect');
const xoauth = require('./lib/xoauth');
const ecosystem = require('./lib/ecosystem');
const privacy = require('./lib/privacy');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const BASE_PATH = String(process.env.BASE_PATH || '').replace(/\/+$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Privacy: le risposte /api/* non mostrano wallet agente (solo 4…4), IP, host, email, percorsi.
privacy.addPrivate(wallet.DESK_WALLET);
privacy.addPrivate(require('./lib/antifake').AGENT_WALLET);
String(process.env.ZDESK_PRIVATE_ADDRS || '').split(',').map((x) => x.trim()).filter(Boolean).forEach(privacy.addPrivate);
app.use('/api', privacy.middleware);

function publicBase(req) {
  const prefix = String(req.get('X-Forwarded-Prefix') || '').replace(/\/+$/, '');
  if (prefix) return prefix;
  const host = String(req.get('X-Forwarded-Host') || req.get('Host') || '').split(':')[0].toLowerCase();
  if (host === 'zdesk.x-zdos.it') return '';
  // Empty string is falsy in the client, which then falls back to pathname (/zdesk).
  return '';
}

function sendIndex(req, res) {
  let html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  html = html.replace(
    '<head>',
    '<head>\n  <script>window.ZDESK_BASE = ' + JSON.stringify(publicBase(req)) + ';</script>'
  );
  res.type('html').send(html);
}

app.get('/', sendIndex);
app.get('/index.html', sendIndex);
app.use(express.static(PUBLIC_DIR, { index: false, etag: false, maxAge: 0 }));

function wrap(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      const status = err.status && Number.isInteger(err.status) ? err.status : 500;
      res.status(status).json({ error: err.message || String(err) });
    });
  };
}

app.get('/api/health', wrap(async (_req, res) => {
  res.json({
    ok: true,
    tz: 'Europe/Rome',
    now: new Date().toISOString(),
    sources: sources.getHealth(),
    trading: false,
    paperOnly: true,
    ninja: ninja.readPublicState().daemon || null,
    xOAuth: { configured: xoauth.configured(), readOnly: true },
  });
}));

app.get('/api/formula', (_req, res) => {
  res.sendFile(path.join(__dirname, 'FORMULA.md'));
});

app.get('/api/pairs', wrap(async (req, res) => {
  const tab = req.query.tab === 'new' ? 'new' : 'trending';
  const data = await sources.getPairList(tab);
  res.json(data);
}));

app.get('/api/token/:mint', wrap(async (req, res) => {
  if (!sources.isValidPubkey(req.params.mint)) {
    return res.status(400).json({ error: 'mint non valido' });
  }
  const data = await sources.getTokenDetail(req.params.mint);
  res.json(data);
}));

app.get('/api/watchlist', wrap(async (_req, res) => {
  res.json(await sources.getWatchlist());
}));

app.get('/api/xstocks', wrap(async (_req, res) => {
  res.json(await sources.getXstocks());
}));

app.get('/api/desk', wrap(async (_req, res) => {
  res.json(getDesk());
}));

app.get('/api/wallet', wrap(async (_req, res) => {
  res.json(await wallet.getDeskWallet());
}));

app.get('/api/wallet/:address', wrap(async (req, res) => {
  const addr = req.params.address === 'desk' ? wallet.DESK_WALLET : req.params.address;
  res.json(await wallet.getWallet(addr));
}));

app.get('/api/copytrader', wrap(async (_req, res) => {
  res.json(getCopyTrader());
}));

app.get('/api/ninja', wrap(async (_req, res) => {
  res.json(ninja.readPublicState());
}));

app.get('/api/antifake', wrap(async (_req, res) => {
  res.json(readPublicAntifake());
}));

app.get('/api/copytop', wrap(async (_req, res) => {
  try {
    copytop.maybeRefreshInBackground();
  } catch { /* read-only / already inflight */ }
  res.json(copytop.readPublicCopytop());
}));


// ZDOS Radar: sola lettura, solo GET, nessuna chiamata X da qui (vedi lib/radar.js).
app.get('/api/radar', wrap(async (_req, res) => {
  res.json(radar.getRadar());
}));

// Radar · Staking: sola lettura, non custodial (nessuna chiave, nessuna firma).
app.get('/api/staking/:address', wrap(async (req, res) => {
  res.json(await staking.getStaking(String(req.params.address || '')));
}));

// Radar · Connetti app: GitHub pubblico + accesso X OAuth 2.0 (sola lettura).
app.get('/api/connect', wrap(async (req, res) => {
  res.json({
    github: await connect.getGithubStatus(),
    readOnly: true,
    x: xoauth.publicStatus(req),
  });
}));

app.get('/api/connect/x/start', (req, res) => {
  try { xoauth.startHandler(req, res); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.get('/api/connect/x/callback', (req, res) => {
  const returnUrl = (result) => {
    const base = publicBase(req) || '';
    const q = result === 'ok' ? 'tab=radar&rsub=connect&x=ok' : 'tab=radar&rsub=connect&x=err';
    return base + '/?' + q;
  };
  Promise.resolve(xoauth.callbackHandler(req, res, returnUrl)).catch((err) => {
    console.error('xoauth callback', err.message || err);
    res.redirect(302, returnUrl('err'));
  });
});

app.get('/api/connect/x/me', (req, res) => {
  try { xoauth.meHandler(req, res); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

app.post('/api/connect/x/logout', (req, res) => {
  try { xoauth.logoutHandler(req, res); }
  catch (err) { res.status(500).json({ error: err.message || String(err) }); }
});

// Ecosistema ZDOS1.3: stato dei siti e ultimi articoli dev.to (sola lettura, cache 60 s).
app.get('/api/ecosystem', wrap(async (_req, res) => {
  res.json(await ecosystem.getEcosystem());
}));

app.get('/api/ohlcv/:pair', wrap(async (req, res) => {
  const data = await sources.getOhlcv(req.params.pair, {
    timeframe: req.query.tf,
    aggregate: req.query.aggregate,
    limit: req.query.limit,
  });
  res.json(data);
}));

app.get('/api/status', wrap(async (_req, res) => {
  res.json({ sources: sources.getHealth(), now: new Date().toISOString() });
}));

function warm() {
  sources.getPairList('trending').catch((e) => console.error('warm trending', e.message));
  sources.getPairList('new').catch((e) => console.error('warm new', e.message));
  sources.getWatchlist().catch((e) => console.error('warm watch', e.message));
  sources.getXstocks().catch((e) => console.error('warm xstocks', e.message));
  startCopyTraderIfNeeded();
  wallet.getDeskWallet().catch((e) => console.error('warm wallet', e.message));
  try { copytop.maybeRefreshInBackground(); } catch { /* */ }
}

const server = app.listen(PORT, HOST, () => {
  console.log(`ZDESK in ascolto (sola lettura, nessun trade)${BASE_PATH ? ' ' + BASE_PATH : ''}`);
  warm();
  startCopySignalPoller();
  setInterval(() => {
    sources.getPairList('trending').catch(() => {});
    sources.getPairList('new').catch(() => {});
  }, 50_000);
  setInterval(() => {
    sources.getWatchlist().catch(() => {});
    sources.getXstocks().catch(() => {});
  }, 55_000);
  setInterval(() => {
    wallet.getDeskWallet().catch(() => {});
  }, 25_000);
  setInterval(() => {
    try { copytop.maybeRefreshInBackground(); } catch { /* */ }
  }, 10 * 60_000);
});

server.on('error', (err) => {
  console.error('listen error', err);
  process.exit(1);
});

process.on('uncaughtException', (e) => console.error('uncaught', e));
process.on('unhandledRejection', (e) => console.error('unhandled', e));
