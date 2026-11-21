'use strict';
// Comandi ecosistema comuni a zdiscord (z-xSOLANA) e Zara Lsd: /radar /badge /dev /token /velvetstar /stato /aiuto.
// Solo letture: API pubbliche di velvet.x-zdos.it e x-zdos.it, RPC Solana e Polygon. Nessun prezzo, nessun rendimento.
// La logica restituisce embed JSON semplici, così si testa senza token e senza Discord.
// © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.

const VELVET = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump';
const DSN_SOL = '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4';
const DSN_POLYGON = '0xfc90516a1f736FaC557e09D8853dB80dA192c296';
const SITE = 'https://velvet.x-zdos.it';
const URLS = {
  radar: SITE + '/radar/',
  radarApi: SITE + '/radar-api',
  badge: SITE + '/badge/',
  badgeApi: SITE + '/api/nft/badge-v2',
  star: SITE + '/velvet-star/',
  starApi: SITE + '/ai-directory/api/stars',
  dev: 'https://x-zdos.it/dev/',
  ide: 'https://x-zdos.it/ide/',
};
const SOL_RPC = [process.env.SOLANA_RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
const POLY_RPC = [process.env.POLYGON_RPC_URL, 'https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'].filter(Boolean);
const HEALTH = [
  ['x-zdos.it', 'https://x-zdos.it/'],
  ['Portale dev Zlang', 'https://x-zdos.it/dev/'],
  ['Zlang IDE', 'https://x-zdos.it/ide/'],
  ['ZSwap', 'https://swap.x-zdos.it/'],
  ['zRoute', 'https://swap.x-zdos.it/zroute/'],
  ['ZQuest', 'https://quest.x-zdos.it/'],
  ['OurVelvet (18+)', SITE + '/'],
  ['Radar OurVelvet', SITE + '/radar-api/health'],
  ['Badge OurVelvet', SITE + '/api/nft/badge-v2/roles.json'],
  ['Velvet Star', SITE + '/ai-directory/api/stars'],
];
const COL = { violet: 0x9945ff, green: 0x14f195, cyan: 0x66e3ff, warn: 0xffc93c, gold: 0xffd56a };
const FOOT = { text: 'ZDOS1.3 · dati letti ora · informativo, nessun rendimento promesso' };
const OV_ID = /^OV-[A-Z0-9]{4}-VELVET$/;

async function getJson(url, opt = {}, ms = 9000) {
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'zdos-bot/1.0', ...(opt.headers || {}) } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
async function rpc(urls, method, params) {
  let last;
  for (const u of urls) {
    try {
      const j = await getJson(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      if (j.error) throw new Error(j.error.message || 'rpc');
      return j.result;
    } catch (e) { last = e; }
  }
  throw last || new Error('rpc');
}
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

async function splInfo(mint) {
  // Una sola chiamata: getAccountInfo jsonParsed contiene già offerta, decimali e authority.
  const acc = await rpc(SOL_RPC, 'getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const v = acc && acc.value; const info = v && v.data && v.data.parsed && v.data.parsed.info;
  if (!info || info.supply == null) throw new Error('mint non leggibile');
  const prog = v.owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? 'Token-2022' : 'SPL Token';
  const whole = (BigInt(info.supply) / (10n ** BigInt(info.decimals))).toString();
  return { supply: whole, decimals: info.decimals, program: prog, mintAuth: info.mintAuthority, freezeAuth: info.freezeAuthority };
}
async function erc20Info(addr) {
  const call = (data) => rpc(POLY_RPC, 'eth_call', [{ to: addr, data }, 'latest']);
  const [ts, dec] = await Promise.all([call('0x18160ddd'), call('0x313ce567')]);
  const d = Number(BigInt(dec));
  const raw = BigInt(ts); const whole = raw / (10n ** BigInt(d));
  return { supply: whole.toString(), decimals: d };
}
const auth = (a) => (a === null ? 'revocata' : a ? '`' + a.slice(0, 4) + '…' + a.slice(-4) + '`' : 'n/d');

async function token() {
  const [v, ds, dp] = await Promise.allSettled([splInfo(VELVET), splInfo(DSN_SOL), erc20Info(DSN_POLYGON)]);
  const sol = (r, mint) => r.status === 'fulfilled'
    ? r.value.program + ' · ' + r.value.decimals + ' decimali · offerta on-chain **' + fmt(r.value.supply) + '**\nmint authority ' + auth(r.value.mintAuth) + ' · freeze ' + auth(r.value.freezeAuth) + '\n`' + mint + '`\n[Solscan](https://solscan.io/token/' + mint + ')'
    : 'RPC Solana non raggiungibile ora · `' + mint + '`';
  const poly = dp.status === 'fulfilled'
    ? 'ERC-20 · ' + dp.value.decimals + ' decimali · offerta on-chain **' + fmt(dp.value.supply) + '**\n`' + DSN_POLYGON + '`\n[Polygonscan](https://polygonscan.com/token/' + DSN_POLYGON + ')'
    : 'RPC Polygon non raggiungibile ora · `' + DSN_POLYGON + '`';
  return { embeds: [{
    title: 'Token ufficiali ZDOS · dati on-chain', url: URLS.dev + 'monete/', color: COL.violet,
    description: 'Letti adesso dalla blockchain (RPC pubblici). Niente prezzi, niente rendimenti: VELVET è un gettone di comunità. Prima di comprare qualsiasi token usa /kira.',
    fields: [
      { name: 'VELVET ($OV) · Solana', value: sol(v, VELVET) },
      { name: '$DSN · Solana (ufficiale)', value: sol(ds, DSN_SOL) + '\nNessuna pool: oggi non è scambiabile su Solana.' },
      { name: '$DSN · Polygon', value: poly },
    ],
    footer: FOOT, timestamp: new Date().toISOString(),
  }] };
}

async function radar() {
  let h = null; let m = null; let lb = null;
  try { h = await getJson(URLS.radarApi + '/health'); } catch (_) {}
  try { m = await getJson(URLS.radarApi + '/mistresses'); } catch (_) {}
  try { lb = await getJson(URLS.radarApi + '/leaderboard'); } catch (_) {}
  const off = (m && m.official) || []; const ver = (m && m.verified) || [];
  return { embeds: [{
    title: 'Radar OurVelvet 18+', url: URLS.radar, color: h && h.ok ? COL.cyan : COL.warn,
    description: (h && h.ok ? '🟢 Radar online.' : '🔴 Il Radar non risponde in questo momento.') + '\nCrea il tuo ID `OV-XXXX-VELVET`, entra con l’ID o con Phantom. Profili Mistress/Master verificati con un post X; Fedeli e Curiosi solo per scelta. Solo adulti, consenso sempre, safeword **ROSSO**.',
    fields: [
      { name: 'Ufficiali (AI dichiarate)', value: off.length ? off.map((x) => '• ' + x.nick + ' · ' + (x.label || x.role)).join('\n').slice(0, 1000) : 'n/d', inline: true },
      { name: 'Profili verificati', value: String(ver.length), inline: true },
      { name: 'Classifica', value: lb && lb.rows ? (lb.rows.length ? lb.rows.length + ' profili in classifica' : 'ancora vuota') : 'n/d', inline: true },
      { name: 'Link', value: '[Apri il Radar](' + URLS.radar + ') · [Badge](' + URLS.badge + ')' },
    ],
    footer: FOOT, timestamp: new Date().toISOString(),
  }] };
}

async function badge(id) {
  id = String(id || '').trim().toUpperCase();
  if (!id) {
    let roles = [];
    try { roles = (await getJson(URLS.badgeApi + '/roles.json')).roles || []; } catch (_) {}
    return { embeds: [{
      title: 'Badge OurVelvet', url: URLS.badge, color: COL.gold,
      description: 'Il badge è un attestato di appartenenza non trasferibile: niente valore economico, niente rendimento. Ogni ID `OV-XXXX-VELVET` è fisso e non viene mai riassegnato.\nPer vedere un badge: `/badge id:OV-XXXX-VELVET`.',
      fields: [
        { name: 'Ruoli', value: roles.length ? roles.map((r) => '• ' + r.label + ' · inviti ' + (r.invites != null ? r.invites : 'n/d')).join('\n').slice(0, 1000) : 'n/d' },
        { name: 'Pagina', value: '[velvet.x-zdos.it/badge](' + URLS.badge + ')' },
      ],
      footer: FOOT,
    }] };
  }
  if (!OV_ID.test(id)) return { ephemeral: true, content: 'ID non valido: il formato è `OV-XXXX-VELVET` (4 caratteri tra lettere e numeri).' };
  let md;
  try { md = await getJson(URLS.badgeApi + '/' + encodeURIComponent(id) + '.json?full=1'); }
  catch (e) {
    if (e.status === 404) return { ephemeral: true, content: 'Nessun badge registrato con ID `' + id + '`. Crealo dal [Radar](' + URLS.radar + ').' };
    return { ephemeral: true, content: 'Il servizio badge non risponde ora, riprova tra poco.' };
  }
  const o = md.ourvelvet || {};
  const attrs = (md.attributes || []).filter((a) => a && a.trait_type && !/^global id$/i.test(a.trait_type)).slice(0, 6);
  const lvl = ((md.attributes || []).find((a) => a && /^livello$/i.test(a.trait_type)) || {}).value;
  return { embeds: [{
    title: 'Badge OurVelvet · ' + (lvl ? lvl + ' · ' : '') + id, url: URLS.badge, color: o.platino ? 0xe5e4e2 : COL.gold,
    description: clip(md.description || '', 600),
    fields: [
      { name: 'ID', value: '`' + id + '`', inline: true },
      { name: 'Verificato', value: o.verified ? 'sì' : 'no', inline: true },
      ...attrs.map((a) => ({ name: clip(a.trait_type, 60), value: clip(String(a.value), 100), inline: true })),
      { name: 'Link', value: '[Immagine del badge](' + URLS.badgeApi + '/' + id + '.svg) · [Pagina badge](' + URLS.badge + ')' },
    ],
    footer: { text: 'Badge non trasferibile · nessun valore economico' },
  }] };
}
function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function velvetstar() {
  let d = null;
  try { d = await getJson(URLS.starApi); } catch (_) {}
  const rank = (d && d.ranking) || [];
  return { embeds: [{
    title: 'Velvet Star · OurVelvet', url: URLS.star, color: COL.gold,
    description: 'La vetrina dei creator 18+ di OurVelvet: solo profili che hanno chiesto di esserci (opt-in) e approvati dallo staff. I punteggi sono la media di voti reali.',
    fields: [
      { name: 'Profili in vetrina', value: d ? String(d.total || 0) : 'n/d', inline: true },
      { name: 'Categorie', value: d && d.categories ? String(d.categories.length) : 'n/d', inline: true },
      { name: 'In testa', value: rank.length ? rank.slice(0, 3).map((x, i) => (i + 1) + '. ' + clip(x.name || x.nick || x.handle || '?', 40)).join('\n') : 'ancora nessun profilo approvato' },
      { name: 'Link', value: '[Apri Velvet Star](' + URLS.star + ')' },
    ],
    footer: FOOT,
  }] };
}

function dev() {
  return { embeds: [{
    title: 'Portale sviluppatori Zlang', url: URLS.dev, color: COL.green,
    description: 'Guida rapida, documentazione del linguaggio, esempi che si aprono direttamente nell’IDE, API pubbliche e schede on-chain di $DSN e VELVET in sola lettura.',
    fields: [
      { name: 'Link', value: '[Portale](' + URLS.dev + ') · [Esempi](' + URLS.dev + 'esempi/) · [API](' + URLS.dev + 'api/) · [IDE](' + URLS.ide + ')' },
    ],
    footer: { text: 'ZDOS1.3 · Zlang' },
  }] };
}

async function stato(fetchStatus, extra = []) {
  const fs = fetchStatus || (async (u) => (await fetch(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) })).status);
  const rows = await Promise.all(HEALTH.map(async ([name, url]) => {
    const t0 = Date.now();
    try { const c = await fs(url); return { name, ok: c >= 200 && c < 400, code: c, ms: Date.now() - t0 }; }
    catch (_) { return { name, ok: false, code: 'errore', ms: Date.now() - t0 }; }
  }));
  rows.push(...extra);
  const allOk = rows.every((x) => x.ok);
  return { embeds: [{
    title: 'Stato ecosistema ZDOS', color: allOk ? COL.green : COL.warn,
    description: rows.map((x) => (x.ok ? '🟢' : '🔴') + ' **' + x.name + '** · ' + x.code + (x.ms != null ? ' · ' + x.ms + ' ms' : '') + (x.extra ? ' · ' + x.extra : '')).join('\n'),
    footer: { text: 'Controllo eseguito ora dal server ZDOS' }, timestamp: new Date().toISOString(),
  }] };
}

function aiuto(extraLines = []) {
  const lines = [
    '`/radar` · Radar OurVelvet: stato, ufficiali, link',
    '`/badge` · badge OurVelvet; `/badge id:OV-XXXX-VELVET` per vedere il tuo',
    '`/dev` · portale sviluppatori Zlang',
    '`/token` · $DSN e VELVET, dati on-chain (niente prezzi)',
    '`/velvetstar` · vetrina Velvet Star',
    '`/stato` · stato dei servizi',
    '`/aiuto` · questo elenco',
    ...extraLines,
  ];
  return { ephemeral: true, embeds: [{
    title: 'Comandi ZDOS · OurVelvet', color: COL.violet, description: lines.join('\n'),
    fields: [{ name: 'Regole', value: 'OurVelvet è solo 18+: consenso sempre, safeword **ROSSO**. Il bot non scrive mai in privato e non pubblica da solo.' }],
    footer: { text: 'ZDOS1.3' },
  }] };
}

const DEFS = [
  { name: 'radar', description: 'Radar OurVelvet 18+: stato, profili ufficiali e link', options: [
    { type: 3, name: 'fonte', description: 'velvet (predefinito) oppure zdesk (segnali di trading in sola lettura)', required: false, choices: [{ name: 'OurVelvet', value: 'velvet' }, { name: 'zdesk', value: 'zdesk' }] },
  ] },
  { name: 'badge', description: 'Badge OurVelvet: ruoli e privilegi, oppure il tuo badge per ID', options: [
    { type: 3, name: 'id', description: 'Il tuo ID, es. OV-XXXX-VELVET', required: false, min_length: 14, max_length: 14 },
  ] },
  { name: 'dev', description: 'Portale sviluppatori Zlang (x-zdos.it/dev)' },
  { name: 'token', description: '$DSN e VELVET: dati on-chain reali, niente prezzi' },
  { name: 'velvetstar', description: 'Velvet Star: la vetrina dei creator OurVelvet (opt-in)' },
  { name: 'stato', description: "Stato dei servizi dell'ecosistema ZDOS" },
  { name: 'aiuto', description: 'Elenco dei comandi' },
];

async function handle(name, opts = {}, deps = {}) {
  switch (name) {
    case 'radar': return radar();
    case 'badge': return badge(opts.id);
    case 'dev': return dev();
    case 'token': return token();
    case 'velvetstar': return velvetstar();
    case 'stato': return stato(deps.fetchStatus, deps.extraStatus ? await deps.extraStatus() : []);
    case 'aiuto': return aiuto(deps.aiutoExtra || []);
    default: return null;
  }
}

module.exports = { DEFS, NAMES: new Set(DEFS.map((d) => d.name)), HEALTH, URLS, handle, token, radar, badge, dev, velvetstar, stato, aiuto };
