'use strict';

/**
 * ZDESK · L$D "Cosa manca per il verde" + wallet dichiarati. SOLA LETTURA (solo GET, nessuna chiave, nessuna scrittura).
 * - Il verdetto K.I.R.A. ufficiale resta quello del pannello /defi (127.0.0.1:4198/overview): qui viene solo letto.
 * - La checklist rilegge gli STESSI campi Jupiter che usa kira() in /opt/zdos-defi/server.mjs con le STESSE soglie
 *   (copiate qui solo per mostrarle, non modificate). Nessun flag forzato: se una fonte manca il controllo e' "n/d".
 * - Concentrazione: due numeri affiancati. (1) top holder grezzo; (2) somma dei wallet dichiarati insider/progetto,
 *   compresi i token bloccati in vesting verso insider. I token nel pool LP sono mostrati a parte.
 * (c) 2026 ZDOS1.3 · P.IVA 11040550961
 */
const { cache } = require('./cache');

const MINT = 'FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP';
const POOL = '383iZ9nNfnnMtpM6oY7Gu4Nn87EtjwdPikkwctExjkze';
const LOCK = 'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SUPPLY = 200_000_000;
const RPCS = ['http://127.0.0.1:8895', 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
const TTL = 60_000;

/* Wallet dichiarati pubblicamente come insider / progetto ZDOS1.3. Nessun nome personale. */
const DECLARED = [
  { address: 'A4JY5VGS1oGSqMxW6a7EtwTg7q6wjG3uxVpNaHPyG9PJ', role: 'Fondatore / dev (creatore del token)', insider: true },
  { address: 'GEntwhyRQASi5n9uWSqYhMRtePGoogDpsbuoZBwCECDd', role: 'Fondo merito (wallet operativo di progetto; pagamenti fermi, STOP attivo)', insider: true },
  { address: '5qke6mW7k3uEw4Bk67xSyGAk5zDgsLnpLK8P8J3V7dww', role: 'Agente ZDOS (wallet operativo di progetto)', insider: true },
  { address: '8gRVYw9oqgjfi2UpPfpgfJntPomrKroX42HKtrTrGYL6', role: 'Wallet di progetto (escluso dal fondo merito)', insider: true },
  { address: 'HGkVsYyXpbrxqrhnbKeSe5epERLwWnA4oL4q6Z3joLt4', role: 'Wallet di progetto (escluso dal fondo merito)', insider: true },
  { address: '6qSyMUB1g7eXoiFSELt2Vf4B4Lv3YEUkWFxAQkfNyobU', role: 'Wallet di progetto (escluso dal fondo merito)', insider: true },
  { address: 'Hss8o82jXJJEE2zq1mcsHyVVXJJfo5bDebEZihwtrLBk', role: 'Insider da identificare (holder non attribuito; dichiarato per prudenza, piano ZDOS1.3)', insider: true },
];
const INSIDER = new Set(DECLARED.filter((d) => d.insider).map((d) => d.address));
const POOL_OWNERS = new Set([POOL]);

/* Soglie: copia di sola visualizzazione di kira() in /opt/zdos-defi/server.mjs (non modificate). */
const T = { topHoldersMaxPct: 50, holdersMin: 50 };

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

async function rpc(method, params) {
  let last = 'nessun RPC';
  for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) });
      const j = await r.json();
      if (j.error) { last = j.error.message || 'errore RPC'; continue; }
      return j.result;
    } catch (e) { last = e.message; }
  }
  throw new Error(last);
}
async function jget(url, ms = 10000) {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'zdesk-lsd-verde/1.0 (sola lettura)' }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
    return { ok: true, json: await r.json() };
  } catch (e) { return { ok: false, error: e.message }; }
}

function b58(buf) {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = BigInt('0x' + Buffer.from(buf).toString('hex')); let s = '';
  while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of buf) { if (b === 0) s = '1' + s; else break; }
  return s;
}

async function holders() {
  const r = await rpc('getProgramAccounts', [TOKEN_PROGRAM, { encoding: 'jsonParsed', commitment: 'confirmed', filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: MINT } }] }]);
  return r.map((a) => ({ tokenAccount: a.pubkey, owner: a.account.data.parsed.info.owner, amount: Number(a.account.data.parsed.info.tokenAmount.uiAmountString) }))
    .filter((h) => h.amount > 0).sort((a, b) => b.amount - a.amount);
}

/* Escrow Jupiter Lock su L$D (layout VestingEscrow: recipient@8, token_mint@40, creator@72, base@104, cancel_mode@138, ...). */
async function locks() {
  const r = await rpc('getProgramAccounts', [LOCK, { encoding: 'base64', commitment: 'confirmed', filters: [{ dataSize: 296 }, { memcmp: { offset: 40, bytes: MINT } }] }]);
  return r.map((a) => {
    const d = Buffer.from(a.account.data[0], 'base64');
    const u = (o) => Number(d.readBigUInt64LE(o));
    return {
      escrow: a.pubkey, recipient: b58(d.subarray(8, 40)), creator: b58(d.subarray(72, 104)),
      updateRecipientMode: d[137], cancelMode: d[138], cancellable: d[138] !== 0,
      cliffTime: u(144), frequency: u(152), cliffUnlock: u(160) / 1e6, amountPerPeriod: u(168) / 1e6, periods: u(176),
      claimed: u(184) / 1e6, start: u(192), cancelledAt: u(200),
      total: (u(160) + u(168) * u(176)) / 1e6,
    };
  });
}

async function build() {
  const [ov, jup, hs, lk] = await Promise.all([
    jget('http://127.0.0.1:4198/overview', 15000),
    jget('https://lite-api.jup.ag/tokens/v2/search?query=' + MINT),
    holders().then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, error: e.message })),
    locks().then((v) => ({ ok: true, v })).catch((e) => ({ ok: false, error: e.message })),
  ]);
  const t = ov.ok ? (ov.json.tokens || []).find((x) => x.mint === MINT) : null;
  const jt = jup.ok && Array.isArray(jup.json) ? jup.json.find((x) => x.id === MINT) : null;
  const a = (t && t.audit) || (jt && jt.audit) || null;
  const pools = ov.ok ? (ov.json.pools || []) : [];
  const poolBad = pools.filter((p) => p.blacklisted && (p.x && p.x.mint === MINT || p.y && p.y.mint === MINT));

  const st = (cond) => (cond == null ? 'nd' : cond ? 'ok' : 'manca');
  const holderCount = t && t.market ? num(t.market.holders) : (jt ? num(jt.holderCount) : null);
  const organicLabel = t && t.market ? t.market.organic : (jt ? jt.organicScoreLabel : null);
  const checks = [
    { id: 'sus', label: 'Jupiter non segnala il token come sospetto (audit.isSus)', livello: 'rosso', soglia: 'isSus assente', valore: a ? (a.isSus ? 'segnalato (isSus=true)' : 'non segnalato') : 'n/d', status: st(a ? !a.isSus : null),
      come: 'Piano ZDOS1.3: lo decide solo Jupiter. Prima: account X del progetto, holder reali via fondo merito, scambi organici, poi richiesta di verifica VRFD. Nessun flag forzato, soglie invariate.' },
    { id: 'mint', label: 'Mint authority revocata', livello: 'rosso', soglia: 'disattivata', valore: a ? (a.mintAuthorityDisabled ? 'revocata' : 'attiva') : 'n/d', status: st(a ? !!a.mintAuthorityDisabled : null), come: 'Fatto il 28/11/2026.' },
    { id: 'freeze', label: 'Freeze authority revocata', livello: 'rosso', soglia: 'disattivata', valore: a ? (a.freezeAuthorityDisabled ? 'revocata' : 'attiva') : 'n/d', status: st(a ? !!a.freezeAuthorityDisabled : null), come: 'Gia revocata.' },
    { id: 'pool', label: 'Pool non in blacklist Meteora', livello: 'rosso', soglia: 'nessun pool segnalato', valore: ov.ok ? (poolBad.length ? poolBad.map((p) => p.name).join(', ') : 'nessuno') : 'n/d', status: st(ov.ok ? poolBad.length === 0 : null), come: '' },
    { id: 'top', label: 'Quota dei primi holder (Jupiter topHoldersPercentage)', livello: 'giallo', soglia: '≤ ' + T.topHoldersMaxPct + '%', valore: a && num(a.topHoldersPercentage) != null ? a.topHoldersPercentage.toFixed(2) + '%' : 'n/d', status: st(a && num(a.topHoldersPercentage) != null ? a.topHoldersPercentage <= T.topHoldersMaxPct : null),
      come: 'Piano ZDOS1.3: 20M al fondo merito (eseguito), 90M in Jupiter Lock non cancellabile (firma di doc), liquidita nel pool (primo deposito eseguito). Spostarli tra wallet del progetto non conta: scende davvero solo con pagamenti a utenti reali.' },
    { id: 'holders', label: 'Numero di holder (Jupiter holderCount)', livello: 'giallo', soglia: '≥ ' + T.holdersMin, valore: holderCount != null ? String(holderCount) : 'n/d', status: st(holderCount != null ? holderCount >= T.holdersMin : null),
      come: 'Piano ZDOS1.3: holder reali via pagamenti del fondo merito a utenti verificati (oggi fermi, STOP attivo) e acquisti nel pool. Niente airdrop a se stessi o wallet finti.' },
    { id: 'organic', label: 'Attivita organica Jupiter non "low"', livello: 'giallo', soglia: 'organicScoreLabel ≠ low', valore: organicLabel ? organicLabel + (jt && num(jt.organicScore) != null ? ' (score ' + jt.organicScore + ')' : '') : 'n/d', status: st(organicLabel ? organicLabel !== 'low' : null),
      come: 'Scambi veri da wallet umani. Il wash trading e escluso (e Jupiter lo filtra comunque).' },
  ];
  const extra = [
    { id: 'verified', label: 'Verifica Jupiter (VRFD)', valore: jt ? (jt.isVerified ? 'verificato' : 'non verificato') : 'n/d', status: jt ? (jt.isVerified ? 'ok' : 'manca') : 'nd', nota: 'Non entra nel calcolo K.I.R.A., ma aiuta isSus e la fiducia. Manca ancora l\'account X del progetto, condizione per chiedere la verifica. Passi su /lsd-trasparenza/.' },
    { id: 'jupmeta', label: 'Nome e simbolo su Jupiter', valore: jt ? ((jt.name || '—') + ' / ' + (jt.symbol || '—')) : 'n/d', status: jt ? (jt.name && jt.symbol ? 'ok' : 'manca') : 'nd', nota: 'On-chain (Metaplex) sono "Dom-Coin" / "L$D"; Jupiter non li mostra ancora: richiesta di aggiornamento metadati su VRFD (gratuita).' },
    { id: 'liq', label: 'Liquidita (Jupiter)', valore: jt && num(jt.liquidity) != null ? '$' + jt.liquidity.toFixed(2) : 'n/d', status: jt && num(jt.liquidity) != null ? (jt.liquidity >= 30000 ? 'ok' : 'manca') : 'nd', nota: 'Soglia del radar K.I.R.A. di ZDESK: $30.000 (avviso sotto). Pagina liquidita: /lsd-liquidita/.' },
  ];

  /* concentrazione */
  let conc = null;
  if (hs.ok) {
    const lockMap = new Map((lk.ok ? lk.v : []).map((l) => [l.escrow, l]));
    const rows = hs.v.map((h) => {
      const l = lockMap.get(h.owner);
      const dec = DECLARED.find((d) => d.address === h.owner);
      let cls = 'altro', role = 'holder non dichiarato';
      if (POOL_OWNERS.has(h.owner)) { cls = 'pool'; role = 'Pool Meteora DLMM (liquidita)'; }
      else if (l) { cls = INSIDER.has(l.recipient) ? 'insider_bloccato' : 'bloccato'; role = 'Vesting Jupiter Lock' + (l.cancellable ? ' (CANCELLABILE)' : ' non cancellabile') + ' → ' + l.recipient.slice(0, 5) + '…'; }
      else if (dec) { cls = dec.insider ? 'insider' : 'progetto'; role = dec.role; }
      return { ...h, pct: (h.amount / SUPPLY) * 100, cls, role };
    });
    const sum = (c) => rows.filter((r) => c.includes(r.cls)).reduce((x, r) => x + r.amount, 0);
    const top = rows[0] || null;
    conc = {
      ok: true, holdersOnchain: rows.length,
      topHolder: top ? { owner: top.owner, amount: top.amount, pct: top.pct, cls: top.cls } : null,
      insiderLiquid: sum(['insider']), insiderLocked: sum(['insider_bloccato']), pool: sum(['pool']), lockedOther: sum(['bloccato']), other: sum(['altro']),
      rows,
    };
    for (const k of ['insiderLiquid', 'insiderLocked', 'pool', 'lockedOther', 'other']) conc[k + 'Pct'] = (conc[k] / SUPPLY) * 100;
    conc.insiderTotalPct = conc.insiderLiquidPct + conc.insiderLockedPct;
  } else conc = { ok: false, error: hs.error };

  const declared = DECLARED.map((d) => {
    const r = conc && conc.ok ? conc.rows.find((x) => x.owner === d.address) : null;
    return { ...d, lsd: conc && conc.ok ? (r ? r.amount : 0) : null, pct: conc && conc.ok ? (r ? r.pct : 0) : null };
  });

  const missing = checks.filter((c) => c.status !== 'ok');
  return {
    ok: true, readOnly: true, checkedAt: new Date().toISOString(), mint: MINT,
    kira: t ? { level: t.kira ? t.kira.level : null, flags: t.kira ? t.kira.flags : [], fonte: 'pannello /defi (verdetto ufficiale, non modificato)' } : { level: null, error: ov.error || 'L$D non presente in /defi' },
    regola: 'verde = nessun controllo mancante; un controllo "rosso" mancante = rosso; solo "giallo" mancanti = giallo. Soglie invariate.',
    checks, extra, missingCount: missing.length,
    concentration: conc, declared, locks: lk.ok ? lk.v : { error: lk.error },
    honesty: 'Spostare L$D tra wallet controllati dal progetto non e distribuzione. I wallet di progetto sono dichiarati qui e sommati come insider; i token in vesting verso insider restano insider (bloccati).',
    sources: ['/defi overview (Jupiter tokens v2, Meteora)', 'Jupiter lite-api tokens v2', 'RPC Solana (token account e escrow Jupiter Lock)'],
  };
}

function install(app, { wrap }) {
  app.get('/api/lsd-verde', wrap(async (_req, res) => {
    const f = cache.fresh('lsd:verde');
    if (f) return res.json({ ...f, cached: true });
    const v = await build();
    cache.set('lsd:verde', v, TTL);
    res.json(v);
  }));
}

module.exports = { install, build, DECLARED };
