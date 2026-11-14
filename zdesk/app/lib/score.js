'use strict';

/**
 * Sfera predittiva — formula documentata in FORMULA.md
 *
 * score = somma (peso_i * s_i) sui fattori disponibili, pesi rinormalizzati.
 * Pesi originali (somma 1.00):
 *   liquidità 0.25 | crescita volume 0.20 | buy/sell 0.20
 *   concentrazione holder 0.20 | authority revocate 0.15
 */

const WEIGHTS = {
  liq: 0.25,
  vol: 0.20,
  bs: 0.20,
  hold: 0.20,
  auth: 0.15,
};

function clamp(x, a = 0, b = 1) {
  if (!Number.isFinite(x)) return null;
  return Math.min(b, Math.max(a, x));
}

function sLiq(liqUsd) {
  if (!Number.isFinite(liqUsd) || liqUsd <= 0) return null;
  // 0 sotto $1k, 1 a $200k+ (scala log10)
  const v = Math.log10(Math.max(liqUsd, 1) / 1000) / Math.log10(200);
  return clamp(v);
}

function sVol(vol1h, vol6h, vol24h) {
  let pace = null;
  if (Number.isFinite(vol1h) && Number.isFinite(vol6h) && vol6h >= 1) {
    pace = vol1h / Math.max(vol6h / 6, 1e-9);
  } else if (Number.isFinite(vol1h) && Number.isFinite(vol24h) && vol24h >= 1) {
    pace = vol1h / Math.max(vol24h / 24, 1e-9);
  } else {
    return null;
  }
  // 0 @ 0.25, 0.5 @ 1, 1 @ 3+
  if (pace <= 0.25) return 0;
  if (pace <= 1) return 0.5 * ((pace - 0.25) / 0.75);
  if (pace >= 3) return 1;
  return 0.5 + 0.5 * ((pace - 1) / 2);
}

function sBs(buys, sells) {
  const b = Number(buys) || 0;
  const s = Number(sells) || 0;
  if (b + s <= 0) return null;
  const share = b / (b + s);
  // 0 @ 30% buy, 0.5 @ 50%, 1 @ 80%+
  return clamp((share - 0.30) / 0.50);
}

function sHold(top10Pct, top1Pct) {
  if (!Number.isFinite(top10Pct)) return null;
  let s;
  if (top10Pct <= 15) s = 1;
  else if (top10Pct >= 55) s = 0;
  else s = 1 - (top10Pct - 15) / 40;
  if (Number.isFinite(top1Pct) && top1Pct > 15) {
    s *= 1 - Math.min((top1Pct - 15) / 35, 0.5);
  }
  return clamp(s);
}

function sAuth(mintRevoked, freezeRevoked) {
  if (mintRevoked == null && freezeRevoked == null) return null;
  const m = mintRevoked === true;
  const f = freezeRevoked === true;
  if (mintRevoked == null || freezeRevoked == null) {
    // un dato solo
    return (m || f) ? 0.7 : 0.2;
  }
  if (m && f) return 1;
  if (m || f) return 0.4;
  return 0;
}

function computeScore(input) {
  const factors = {
    liq: sLiq(input.liqUsd),
    vol: sVol(input.vol1h, input.vol6h, input.vol24h),
    bs: sBs(input.buys, input.sells),
    hold: sHold(input.top10Pct, input.top1Pct),
    auth: sAuth(input.mintRevoked, input.freezeRevoked),
  };

  let wSum = 0;
  let acc = 0;
  const used = {};
  const missing = [];
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (factors[k] == null) {
      missing.push(k);
      continue;
    }
    wSum += w;
    acc += w * factors[k];
    used[k] = { raw: factors[k], weight: w };
  }

  if (wSum <= 0) {
    return {
      score: null,
      factors,
      used: {},
      missing,
      notes: ['nessun fattore disponibile'],
      partial: true,
    };
  }

  // rinormalizza
  const renormalized = {};
  for (const [k, u] of Object.entries(used)) {
    renormalized[k] = { raw: u.raw, weight: u.weight / wSum };
  }
  let score = acc / wSum;
  const notes = [];
  if (missing.length) notes.push('dati parziali: rinorm senza ' + missing.join(', '));

  const danger = !!(input.rugged || (input.rugLevel && String(input.rugLevel).toLowerCase() === 'danger'));
  const warn = input.rugLevel && String(input.rugLevel).toLowerCase() === 'warn';
  if (danger) {
    if (score > 0.4) {
      notes.push('cap 0.40: RugCheck danger/rugged');
      score = 0.4;
    } else {
      notes.push('RugCheck danger/rugged');
    }
  } else if (warn) {
    score *= 0.9;
    notes.push('×0.90: RugCheck warn');
  }
  if (input.liqUsd == null || !Number.isFinite(input.liqUsd) || input.liqUsd <= 0) {
    if (score > 0.45) {
      notes.push('cap 0.45: liquidità assente o nulla');
      score = 0.45;
    }
  } else if (Number.isFinite(input.liqUsd) && input.liqUsd < 5000) {
    if (score > 0.45) {
      notes.push('cap 0.45: liquidità < $5k');
      score = 0.45;
    }
  }

  score = Math.round(score * 1000) / 1000;
  return {
    score,
    factors,
    used: renormalized,
    missing,
    notes,
    partial: missing.length > 0,
  };
}

module.exports = { computeScore, WEIGHTS, sLiq, sVol, sBs, sHold, sAuth, clamp };
