'use strict';

/**
 * Copy LIVE dashboard panels: wallet book, signal feed meta,
 * anti-fake refusals, routine health. Read-only desk files.
 */

const fs = require('fs');
const path = require('path');
const { isValidPubkey } = require('./sources');

const DESK_DIR = process.env.DESK_DIR || '/workspace/highkali-desk';
const PUBKEY_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const STATUS_RE = /\b(APPROVED|WATCH|EXCLUDED)\b/i;
const BLOCK_VERDICTS = new Set(['FAKE', 'EXIT_LIQ', 'BLOCK', 'BLOCKED']);

function deskPath(name) {
  const resolved = path.resolve(path.join(DESK_DIR, name));
  const root = path.resolve(DESK_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function readDesk(name) {
  const p = deskPath(name);
  if (!p) return null;
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function statDesk(name) {
  const p = deskPath(name);
  if (!p) return null;
  try {
    const st = fs.statSync(p);
    return { mtime: st.mtime.toISOString(), size: st.size, path: p };
  } catch {
    return null;
  }
}

function romeIso(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.format(d).replace(' ', 'T');
  // Offset is +01 or +02 depending on DST. November 2026 is CET (+01).
  const tz = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome', timeZoneName: 'shortOffset', hour: '2-digit',
  }).formatToParts(d).find((x) => x.type === 'timeZoneName');
  let off = '+01:00';
  const m = tz && /GMT([+-]\d+)/.exec(tz.value);
  if (m) {
    const n = Number(m[1]);
    const sign = n < 0 ? '-' : '+';
    off = sign + String(Math.abs(n)).padStart(2, '0') + ':00';
  } else if (/GMT([+-]\d{2}:\d{2})/.test((tz && tz.value) || '')) {
    off = RegExp.$1.replace('GMT', '');
    if (/^[+-]\d{2}$/.test(off)) off += ':00';
  }
  return parts + off;
}

function parseRomeStamp(text) {
  if (!text) return null;
  const s = String(text).trim();
  const iso = s.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/);
  if (iso) {
    const sec = iso[2].length === 5 ? iso[2] + ':00' : iso[2];
    const off = iso[3] ? (iso[3] === 'Z' ? 'Z' : (iso[3].includes(':') ? iso[3] : iso[3].slice(0, 3) + ':' + iso[3].slice(3))) : '+01:00';
    const d = new Date(iso[1] + 'T' + sec + (off === 'Z' ? 'Z' : off));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function stripMd(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeStatus(s) {
  const m = String(s || '').toUpperCase().match(STATUS_RE);
  return m ? m[1].toUpperCase() : null;
}

function parseHold(text) {
  const t = String(text || '');
  const m = t.match(/hold\s+median[oa]?\s+(\d+(?:[.,]\d+)?)\s*(min|minuti|m|s|sec|secondi)?/i)
    || t.match(/median(?:o)?\s+hold\s+(\d+(?:[.,]\d+)?)\s*(min|minuti|m|s|sec|secondi)?/i)
    || t.match(/hold\s+(\d+(?:[.,]\d+)?)\s*(min|minuti)\b/i);
  if (!m) return { label: null, minutes: null };
  const rawNum = String(m[1]);
  const n = Number(rawNum.replace(',', '.'));
  if (!Number.isFinite(n)) return { label: null, minutes: null };
  const unit = (m[2] || 'min').toLowerCase();
  const isSec = unit === 's' || unit === 'sec' || unit === 'secondi';
  const minutes = isSec ? n / 60 : n;
  const label = isSec
    ? (Math.round(n) + ' s')
    : (rawNum.replace('.', ',') + ' min');
  return { label, minutes };
}

function parseClosed(text) {
  const t = stripMd(text);
  if (!t || /^n\/?d$/i.test(t)) return { label: t || 'n/d', count: null };
  const m = t.match(/^(\d+)/);
  return { label: t, count: m ? Number(m[1]) : null };
}

function parseWr(text) {
  const t = stripMd(text);
  if (!t || /^n\/?d$/i.test(t)) return { label: t || 'n/d', pct: null };
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return { label: t, pct: m ? Number(String(m[1]).replace(',', '.')) : null };
}

function parsePnl(text) {
  const t = stripMd(text);
  if (!t || /^n\/?d$/i.test(t)) return { label: t || 'n/d', usd: null, sol: null };
  let usd = null;
  let sol = null;
  const u = t.match(/([+-]?)\s*\$\s*([\d.,]+)/) || t.match(/([+-]?)\s*([\d.,]+)\s*USD/i);
  if (u) {
    const n = Number(u[2].replace(/\./g, '').replace(',', '.')) || Number(u[2].replace(/,/g, ''));
    if (Number.isFinite(n)) usd = (u[1] === '-' ? -1 : 1) * n;
  }
  const s = t.match(/([+-]?)\s*([\d.,]+)\s*SOL/i);
  if (s) {
    const n = Number(String(s[2]).replace(',', '.'));
    if (Number.isFinite(n)) sol = (s[1] === '-' ? -1 : 1) * n;
  }
  return { label: t, usd, sol };
}

function splitTableRow(line) {
  const raw = line.trim();
  if (!raw.startsWith('|')) return null;
  const cells = raw.split('|').map((c) => c.trim());
  if (cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSepRow(cells) {
  return cells && cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')));
}

function headerKey(cell) {
  const t = stripMd(cell).toLowerCase();
  if (/wallet|indirizzo|address/.test(t) && !/status|stato/.test(t)) return 'address';
  if (/status|stato|verdetto/.test(t)) return 'status';
  if (/chiusi|closed|14g|14d|round.?trip/.test(t)) return 'closed';
  if (/pnl|profit|realizzat/.test(t)) return 'pnl';
  if (/win\s*rate|wr\b|tasso/.test(t)) return 'wr';
  if (/hold|mediano/.test(t) && !/chiusi|closed/.test(t)) return 'hold';
  if (/motivo|flag|reason|note/.test(t)) return 'reason';
  if (/liq/.test(t)) return 'liq';
  return null;
}

function extractAddress(text) {
  const m = String(text || '').match(new RegExp('`(' + PUBKEY_RE.source + ')`'))
    || String(text || '').match(PUBKEY_RE);
  const addr = m && (m[1] || m[0]);
  return addr && isValidPubkey(addr) ? addr : null;
}

function criteriaNotes(raw) {
  if (!raw) return [];
  const notes = [];
  const holdRule = raw.match(/hold\s+median[oa]?\s*≥\s*[^.\n]+/i)
    || raw.match(/median(?:o)?\s+hold\s*≥\s*[^.\n]+/i)
    || raw.match(/hold\s+median[oa]?[^\n]{0,40}30\s*min/i);
  if (holdRule) notes.push(stripMd(holdRule[0]).slice(0, 140));
  const wr = raw.match(/win rate\s*≥\s*[^.\n]+/i);
  if (wr) notes.push(stripMd(wr[0]).slice(0, 80));
  const closed = raw.match(/almeno\s+\*\*\d+[^*]*\*\*[^\n]{0,60}/i);
  if (closed) notes.push(stripMd(closed[0]).slice(0, 120));
  return notes.slice(0, 6);
}

function parseCopyWallets() {
  const raw = readDesk('copy-wallets.md');
  const st = statDesk('copy-wallets.md');
  if (raw == null) {
    return {
      missing: true,
      updatedAt: null,
      fileMtime: st && st.mtime,
      criteria: [],
      counts: { APPROVED: 0, WATCH: 0, EXCLUDED: 0, total: 0 },
      wallets: [],
    };
  }
  const updatedMatch = raw.match(/\*\*Aggiornato:\*\*\s*([^\n]+)/i)
    || raw.match(/Aggiornato:\s*([^\n]+)/i);
  const updatedAt = updatedMatch ? stripMd(updatedMatch[1]) : null;
  const wallets = [];
  const seen = new Set();

  function upsert(row) {
    if (!row || !row.address || seen.has(row.address)) return;
    seen.add(row.address);
    wallets.push(row);
  }

  // 1) Markdown tables — preferred, most complete stats.
  const lines = raw.split('\n');
  let headers = null;
  let keys = null;
  for (const line of lines) {
    const cells = splitTableRow(line);
    if (!cells || !cells.length) {
      headers = null;
      keys = null;
      continue;
    }
    if (isSepRow(cells)) continue;
    if (!headers) {
      const mapped = cells.map(headerKey);
      const useful = mapped.filter(Boolean);
      if (useful.includes('address') && (useful.includes('status') || useful.length >= 3)) {
        headers = cells;
        keys = mapped;
        continue;
      }
      headers = null;
      keys = null;
      continue;
    }
    const rec = { address: null, status: null, closed: null, closedLabel: null, pnl: null, pnlUsd: null, pnlSol: null, wr: null, wrPct: null, hold: null, holdMin: null, reason: null, liq: null };
    cells.forEach((cell, i) => {
      const key = (keys && keys[i]) || null;
      const text = stripMd(cell);
      if (key === 'address' || (!rec.address && extractAddress(cell))) rec.address = rec.address || extractAddress(cell);
      if (key === 'status' || (!rec.status && normalizeStatus(cell))) rec.status = rec.status || normalizeStatus(cell);
      if (key === 'closed') {
        const c = parseClosed(cell);
        rec.closed = c.count;
        rec.closedLabel = c.label;
      }
      if (key === 'pnl') {
        const p = parsePnl(cell);
        rec.pnl = p.label;
        rec.pnlUsd = p.usd;
        rec.pnlSol = p.sol;
      }
      if (key === 'wr') {
        const w = parseWr(cell);
        rec.wr = w.label;
        rec.wrPct = w.pct;
      }
      if (key === 'hold') {
        const h = parseHold(cell);
        rec.hold = h.label;
        rec.holdMin = h.minutes;
      }
      if (key === 'reason') rec.reason = text || rec.reason;
      if (key === 'liq') rec.liq = text || rec.liq;
      if (!key) {
        const h = parseHold(cell);
        if (h.label && rec.hold == null) {
          rec.hold = h.label;
          rec.holdMin = h.minutes;
        }
      }
    });
    // Hold often lives inside the "chiusi" cell on current/legacy layout.
    if (rec.hold == null) {
      const h = parseHold(cells.join(' | '));
      if (h.label) {
        rec.hold = h.label;
        rec.holdMin = h.minutes;
      }
    }
    if (rec.reason == null) {
      const last = stripMd(cells[cells.length - 1] || '');
      if (last && last !== rec.pnl && last !== rec.wr && last !== rec.closedLabel) rec.reason = last;
    }
    if (rec.address) upsert(rec);
  }

  // 2) Bullet / prose fallbacks (sections may exist without a table).
  let section = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const t = line.toLowerCase();
      if (/approved/.test(t) && !/criteri|tutti i wallet|valutat/.test(t)) section = 'APPROVED';
      else if (/\bwatch\b/.test(t)) section = 'WATCH';
      else if (/excluded|esclus/.test(t)) section = 'EXCLUDED';
      else if (/tutti i wallet|valutat|criteri|metodo/.test(t)) section = null;
      else section = null;
      continue;
    }
    const addr = extractAddress(line);
    if (!addr || seen.has(addr)) continue;
    const status = normalizeStatus(line) || section;
    if (!status) continue;
    const h = parseHold(line);
    const c = parseClosed((line.match(/chiusi[^\]]*?(?:\*\*)?\s*\d+/i) || [line])[0]);
    const p = parsePnl(line);
    const w = parseWr(line);
    upsert({
      address: addr,
      status,
      closed: c.count,
      closedLabel: c.label && c.count != null ? c.label : null,
      pnl: p.label !== 'n/d' ? p.label : null,
      pnlUsd: p.usd,
      pnlSol: p.sol,
      wr: w.label !== 'n/d' ? w.label : null,
      wrPct: w.pct,
      hold: h.label,
      holdMin: h.minutes,
      reason: stripMd(line.replace(/`[^`]+`/g, '').replace(STATUS_RE, '')).slice(0, 240) || null,
      liq: null,
    });
  }

  const order = { APPROVED: 0, WATCH: 1, EXCLUDED: 2 };
  wallets.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.address.localeCompare(b.address));
  const counts = { APPROVED: 0, WATCH: 0, EXCLUDED: 0, total: wallets.length };
  for (const w of wallets) {
    if (counts[w.status] != null) counts[w.status] += 1;
  }
  return {
    missing: false,
    updatedAt,
    fileMtime: st && st.mtime,
    criteria: criteriaNotes(raw),
    counts,
    wallets,
  };
}

function approvedAddresses() {
  const book = parseCopyWallets();
  const wallets = book.wallets.filter((w) => w.status === 'APPROVED').map((w) => w.address);
  return { count: wallets.length, wallets, missing: book.missing };
}

function lastTableStamp(raw) {
  if (!raw) return null;
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith('|') || /Quando|---/.test(line)) continue;
    const m = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
    if (m) {
      const iso = parseRomeStamp(m[1] + '+01:00');
      return { stamp: m[1], iso };
    }
  }
  return null;
}

function lastLogStamp(raw) {
  if (!raw) return null;
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)/)
      || line.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) {
      const iso = parseRomeStamp(m[1].includes('T') || m[1].includes(' ') ? (m[1].includes('+') || /Z$/.test(m[1]) ? m[1] : m[1] + '+01:00') : m[1] + 'T00:00:00+01:00');
      return { stamp: stripMd(line).slice(0, 180), iso, line: stripMd(line).slice(0, 180) };
    }
  }
  return null;
}

function readLastSignal() {
  const raw = readDesk('copy-signals.md');
  const st = statDesk('copy-signals.md');
  const row = lastTableStamp(raw);
  return {
    lastSignalAt: row ? row.iso : (st && st.mtime) || null,
    lastSignalStamp: row ? row.stamp : null,
    fileMtime: st && st.mtime,
  };
}

function formatLag(lags) {
  if (!lags || !lags.length) return null;
  const nums = lags.filter((n) => Number.isFinite(n) && n >= 0);
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { min, max, last: nums[0], samples: nums.length };
}

function feedStatus(poll) {
  const sig = readLastSignal();
  const lag = formatLag(poll && poll.lastLagsSec) || (poll && poll.lastKnownLag) || null;
  const watched = (poll && poll.watched) || [];
  return {
    intervalMs: (poll && poll.intervalMs) || 45_000,
    status: (poll && poll.status) || 'idle',
    lastPollAt: (poll && (poll.lastFinishedAt || poll.lastStartedAt)) || null,
    lastStartedAt: poll && poll.lastStartedAt,
    lastFinishedAt: poll && poll.lastFinishedAt,
    lastError: (poll && poll.lastError) || null,
    lastLogged: (poll && poll.lastLogged) || 0,
    lastSignalAt: sig.lastSignalAt,
    lastSignalStamp: sig.lastSignalStamp,
    lag,
    watchedCount: watched.length,
    watched: watched.slice(0, 20),
  };
}

function reasonFromFlags(flags) {
  const list = Array.isArray(flags) ? flags : [];
  const parts = list
    .filter((f) => f && (BLOCK_VERDICTS.has(String(f.severity || '').toUpperCase()) || f.msg || f.code))
    .map((f) => f.msg || f.code)
    .filter(Boolean);
  return parts.join('; ') || null;
}

function publicRefusal(rec) {
  if (!rec) return null;
  const verdict = String(rec.verdict || rec.status || '').toUpperCase();
  const allowBuy = rec.allowBuy === true;
  const isBlock = rec.type === 'copy_refused' || BLOCK_VERDICTS.has(verdict) || allowBuy === false && verdict;
  if (!isBlock) return null;
  if (verdict && !BLOCK_VERDICTS.has(verdict) && rec.type !== 'copy_refused' && allowBuy !== false) return null;
  const symbol = rec.symbol || (rec.token && rec.token.symbol) || null;
  const mint = rec.mint || (rec.token && rec.token.mint) || null;
  const at = rec.at || rec.ts || rec.when || null;
  return {
    at: at ? (parseRomeStamp(at) || String(at)) : null,
    symbol: symbol ? String(symbol) : null,
    mint: mint ? String(mint) : null,
    verdict: verdict || 'BLOCK',
    reason: rec.reason || reasonFromFlags(rec.flags) || rec.msg || null,
    source: rec.sourceWallet || rec.source || null,
    origin: rec.origin || null,
  };
}

function refusalsFromAntifake() {
  const raw = readDesk('anti-fake.json');
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const hist = Array.isArray(data)
      ? data
      : (Array.isArray(data.history) ? data.history : (data && data.verdict ? [data] : []));
    return hist.map((h) => publicRefusal({ ...h, origin: 'anti-fake.json' })).filter(Boolean);
  } catch {
    return [];
  }
}

function refusalsFromLedger(limit = 40) {
  const p = deskPath('ledger.jsonl');
  if (!p || !fs.existsSync(p)) return [];
  let raw;
  try {
    const st = fs.statSync(p);
    if (st.size > 6 * 1024 * 1024) {
      const fd = fs.openSync(p, 'r');
      const size = Math.min(st.size, 1024 * 1024);
      const buf = Buffer.alloc(size);
      fs.readSync(fd, buf, 0, size, st.size - size);
      fs.closeSync(fd);
      raw = buf.toString('utf8');
      const nl = raw.indexOf('\n');
      if (nl >= 0) raw = raw.slice(nl + 1);
    } else {
      raw = fs.readFileSync(p, 'utf8');
    }
  } catch {
    return [];
  }
  const out = [];
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!/copy_refused|"verdict"\s*:\s*"(FAKE|EXIT_LIQ|BLOCK)/.test(line)) continue;
    try {
      const o = JSON.parse(line);
      const rec = publicRefusal({ ...o, origin: 'ledger.jsonl' });
      if (rec) out.push(rec);
    } catch { /* skip */ }
  }
  return out;
}

const SKIP_REFUSAL_SYMBOLS = new Set([
  'first', 'other', 'wallets', 'wallet', 'skipped', 'services', 'signals',
  'approved', 'none', 'last', 'open', 'processed',
]);

function refusalsFromCopyLive() {
  const raw = readDesk('copy-live.md');
  if (!raw) return [];
  const out = [];
  for (const block of raw.split('\n')) {
    if (!/Sniffer refused|verdict FAKE|allowBuy false|rifiut/i.test(block)) continue;
    const ts = (block.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/) || [])[1];
    const iso = ts ? parseRomeStamp(ts + '+01:00') : null;
    const after = (block.split(/Sniffer refused[^:]*:/i)[1] || '');
    const chunk = after.split(/Other wallets|0 open|Last processed|→ no exits/i)[0] || '';
    if (!chunk) continue;
    // "POPCAT 7GCihg… (top10 42.6%), AVA DKu9ky… (RugCheck danger, top10 71.5%)"
    const re = /([A-Za-z][A-Za-z0-9]{1,15})\s+([1-9A-HJ-NP-Za-km-z]{4,8})…?\s*\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(chunk))) {
      const sym = m[1];
      if (SKIP_REFUSAL_SYMBOLS.has(sym.toLowerCase())) continue;
      const reason = stripMd(m[3]);
      if (!/top\s*10|rug|liq|sell|honeypot|mint|freeze|danger|holder|concentrat|pressure/i.test(reason)) continue;
      out.push({
        at: iso,
        symbol: sym,
        mint: null,
        mintHint: m[2],
        verdict: 'FAKE',
        reason,
        source: null,
        origin: 'copy-live.md',
      });
    }
  }
  return out;
}

function closeInTime(a, b, windowMs) {
  if (!a || !b) return true;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return true;
  return Math.abs(da - db) <= (windowMs || 10 * 60 * 1000);
}

function sameRefusal(a, b) {
  if (a.mint && b.mint && a.mint === b.mint) return closeInTime(a.at, b.at);
  if (a.symbol && b.symbol && String(a.symbol).toUpperCase() === String(b.symbol).toUpperCase()) {
    if (a.mint && b.mintHint && a.mint.startsWith(b.mintHint)) return closeInTime(a.at, b.at);
    if (b.mint && a.mintHint && b.mint.startsWith(a.mintHint)) return closeInTime(a.at, b.at);
    if (!a.mint && !b.mint) return closeInTime(a.at, b.at);
    if ((a.mint || b.mint) && (a.mintHint || b.mintHint)) {
      const mint = a.mint || b.mint;
      const hint = a.mintHint || b.mintHint;
      if (mint.startsWith(hint)) return closeInTime(a.at, b.at);
    }
    if (!a.mint || !b.mint) return closeInTime(a.at, b.at);
  }
  return false;
}

function mergeRefusal(a, b) {
  const rank = { 'anti-fake.json': 3, 'ledger.jsonl': 2, 'copy-live.md': 1 };
  const betterReason = (rank[b.origin] || 0) >= (rank[a.origin] || 0);
  return {
    at: a.at && b.at ? (a.at < b.at ? a.at : b.at) : (a.at || b.at),
    symbol: a.symbol || b.symbol,
    mint: a.mint || b.mint,
    mintHint: a.mintHint || b.mintHint,
    verdict: a.verdict || b.verdict,
    reason: (betterReason && b.reason) || a.reason || b.reason,
    source: a.source || b.source,
    origin: (rank[b.origin] || 0) >= (rank[a.origin] || 0) ? b.origin : a.origin,
  };
}

function getCopyRefusals(limit = 16) {
  const items = [];
  const add = (r) => {
    if (!r) return;
    if (r.symbol && SKIP_REFUSAL_SYMBOLS.has(String(r.symbol).toLowerCase())) return;
    if (r.reason === 'Mint o wallet non validi') return;
    const idx = items.findIndex((it) => sameRefusal(it, r));
    if (idx >= 0) {
      items[idx] = mergeRefusal(items[idx], r);
      return;
    }
    items.push(r);
  };
  refusalsFromAntifake().forEach(add);
  refusalsFromLedger().forEach(add);
  refusalsFromCopyLive().forEach(add);
  return items
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, limit);
}

const ROUTINES = [
  { id: 'copy-live', name: 'Copy trade LIVE', schedule: 'ogni 5 min, 09:00–22:55', file: 'copy-live.md' },
  { id: 'meme-scan', name: 'Scansione meme', schedule: 'ogni 10 min, 09:00–23:50', file: 'go.md' },
  { id: 'phantom-watch', name: 'Phantom watch', schedule: 'ogni 3 ore', file: 'wallet-spark.json' },
  { id: 'night-guard', name: 'Night guard', schedule: 'ogni ora, 00:00–08:00', file: 'risk.md' },
  { id: 'engines', name: 'Engines', schedule: 'settimanale, lunedì 10:00', file: 'engines.md' },
  { id: 'ov-sweep', name: 'Sweep $OV', schedule: 'ogni 2 giorni, 21:00', file: 'ov-sweep.md' },
  { id: 'routine-health', name: 'Controllo routine', schedule: 'ogni giorno, 08:30', file: 'routine-health.md', optional: true },
];

function getRoutineHealth() {
  return ROUTINES.map((r) => {
    const st = statDesk(r.file);
    const raw = st ? readDesk(r.file) : null;
    const log = raw ? lastLogStamp(raw) : null;
    const lastAt = (log && log.iso) || (st && st.mtime) || null;
    return {
      id: r.id,
      name: r.name,
      schedule: r.schedule,
      file: r.file,
      missing: !st,
      lastActivityAt: lastAt,
      lastLine: log ? log.line : null,
    };
  });
}

module.exports = {
  DESK_DIR,
  parseCopyWallets,
  approvedAddresses,
  readLastSignal,
  feedStatus,
  getCopyRefusals,
  getRoutineHealth,
  formatLag,
};
