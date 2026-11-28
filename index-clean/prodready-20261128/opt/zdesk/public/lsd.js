/* ZDESK · vista Dom-Coin (L$D) + salute ecosistema. Sola lettura. (c) 2026 ZDOS1.3 */
(function () {
  'use strict';
  var BASE = (typeof window.ZDESK_BASE === 'string' && window.ZDESK_BASE) ? window.ZDESK_BASE : (location.pathname.indexOf('/zdesk') === 0 ? '/zdesk' : '');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nd(v, f) { return v == null || (typeof v === 'number' && !isFinite(v)) ? 'n/d' : (f ? f(v) : esc(v)); }
  function usd(v) { return '$' + Number(v).toLocaleString('it-IT', { maximumFractionDigits: v < 1 ? 6 : 2 }); }
  function pct(v) { return Number(v).toLocaleString('it-IT', { maximumFractionDigits: 2 }) + '%'; }
  function n(v, d) { return Number(v).toLocaleString('it-IT', { maximumFractionDigits: d == null ? 2 : d }); }
  function short(a) { return a ? esc(a.slice(0, 5) + '…' + a.slice(-4)) : 'n/d'; }
  function kv(l, v) { return '<div><dt>' + l + '</dt><dd>' + v + '</dd></div>'; }
  function get(p) { return fetch(BASE + p, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function src(s, name) { return s && s.ok ? '' : '<p class="risk-warn">' + name + ': fonte non disponibile (' + esc((s && s.error) || 'n/d') + ')</p>'; }

  function card(d) {
    var c = d.onchain || {}, m = d.meteora || {}, x = d.dexscreener || {}, f = d.defiPanel || {}, l = d.lsdLive || {};
    var ma = c.ok ? c.mintAuthority : null, conc = c.ok ? c.concentration : null;
    var maHtml = !ma ? 'n/d' : ma.status === 'ACTIVE'
      ? '<span class="risk-danger"><b>ATTIVA</b></span> · ' + short(ma.address) : '<span style="color:var(--accent)"><b>REVOCATA</b></span>';
    var h = '';
    (d.warnings || []).forEach(function (w) { h += '<p class="banner warn">' + esc(w) + '</p>'; });
    h += '<div class="cards">';
    h += '<article class="card"><h3>On-chain · supply e autorità</h3><dl class="kv">' +
      kv('Programma', nd(c.program)) + kv('Decimali', nd(c.decimals)) +
      kv('Supply', nd(c.supply, function (v) { return n(v, 0); })) +
      kv('Mint authority', maHtml) +
      kv('Freeze authority', c.ok ? (c.freezeAuthority.status === 'ACTIVE' ? '<span class="risk-danger">ATTIVA</span>' : 'revocata') : 'n/d') +
      kv('Quota wallet autorità', nd(d.mintAuthorityWalletSharePct, pct)) + '</dl>' + src(c, 'RPC Solana') +
      (ma && ma.status === 'ACTIVE' ? '<p class="hint">Revoca irreversibile, firmata dal titolare del wallet: <a href="https://x-zdos.it/lsd-revoca/" target="_blank" rel="noopener noreferrer">x-zdos.it/lsd-revoca ↗</a></p>' : '') + '</article>';
    h += '<article class="card"><h3>Concentrazione holder</h3><dl class="kv">' +
      kv('Top 1', conc && conc.top1Pct != null ? pct(conc.top1Pct) : 'n/d') + kv('Top 5', conc && conc.top5Pct != null ? pct(conc.top5Pct) : 'n/d') +
      kv('Top 10', conc && conc.top10Pct != null ? pct(conc.top10Pct) : 'n/d') + kv('Holder (Meteora)', nd(m.holders)) + '</dl>' +
      (conc && conc.holders ? '<table class="holders">' + conc.holders.slice(0, 6).map(function (r) { return '<tr><td>' + short(r.owner || r.tokenAccount) + '</td><td>' + (r.pct != null ? pct(r.pct) : 'n/d') + '</td></tr>'; }).join('') + '</table>' : '') +
      (conc && conc.error ? '<p class="risk-warn">holder: ' + esc(conc.error) + '</p>' : '') + '</article>';
    h += '<article class="card"><h3>Pool Meteora DLMM</h3><dl class="kv">' +
      kv('Riserva L$D', nd(m.reserveL$D, function (v) { return n(v, 2); })) + kv('Riserva SOL', nd(m.reserveSOL, function (v) { return n(v, 5); })) +
      kv('TVL (Meteora)', nd(m.tvlUsd, usd)) + kv('Liquidità (DexScreener)', nd(x.liquidityUsd, usd)) +
      kv('Prezzo (DexScreener)', nd(x.priceUsd, usd)) + kv('Prezzo (Meteora)', m.priceUsdMeteora ? usd(m.priceUsdMeteora) : '0 (non verificato)') +
      kv('Vol 24h', nd(x.volume24hUsd, usd)) + kv('Δ 24h', nd(x.change24hPct, pct)) +
      kv('Tx 24h', x.txns24h ? esc(x.txns24h.buys + ' buy / ' + x.txns24h.sells + ' sell') : 'n/d') + kv('FDV', nd(x.fdvUsd, usd)) + '</dl>' +
      '<p class="hint">' + esc(m.note || '') + ' ' + esc(x.note || '') + '</p>' + src(m, 'Meteora') + src(x, 'DexScreener') + '</article>';
    h += '<article class="card"><h3>Pannello /defi · lsd-live</h3><dl class="kv">' +
      kv('Instradabile', f.ok && f.tradable ? (f.tradable.ok ? 'sì · ' + esc((f.tradable.route || []).join(', ')) : 'no') : 'n/d') +
      kv('K.I.R.A.', f.ok && f.kira ? esc(f.kira.level) : 'n/d') + kv('Liquidità (Jupiter)', nd(f.jupiterLiquidityUsd, usd)) +
      kv('Supply (lsd-live)', nd(l.totalSupply, function (v) { return n(v, 0); })) +
      '</dl>' +
      (f.ok && f.kira && f.kira.flags ? '<p class="hint">' + f.kira.flags.map(esc).join(' · ') + '</p>' : '') +
      '<p class="hint">' + esc(l.note || '') + '</p>' + src(f, '/defi') + src(l, 'lsd-live') +
      '<p class="links"><a href="https://x-zdos.it/defi/" target="_blank" rel="noopener noreferrer">Pannello DeFi ↗</a> · <a href="' + esc(d.token.poolUrl) + '" target="_blank" rel="noopener noreferrer">Pool Meteora ↗</a></p></article>';
    return h + '</div>';
  }

  function verde(d) {
    var lv = (d.kira && d.kira.level) || 'n/d';
    var col = lv === 'verde' ? 'var(--accent)' : lv === 'giallo' ? '#fbbf24' : 'var(--red)';
    var st = function (s) { return s === 'ok' ? '<b style="color:var(--accent)">✓</b>' : s === 'manca' ? '<b class="risk-danger">✗ manca</b>' : 'n/d'; };
    var c = d.concentration || {};
    var h = '<article class="card" style="margin-top:10px"><h3>K.I.R.A. · cosa manca per il verde</h3>';
    h += '<p>Verdetto /defi: <b style="color:' + col + ';text-transform:uppercase">' + esc(lv) + '</b> · soglie invariate, nessun flag forzato</p>';
    h += '<table class="holders"><tr><th style="text-align:left">Controllo</th><th>Soglia</th><th>Valore</th><th>Stato</th></tr>' + (d.checks || []).map(function (x) {
      return '<tr><td>' + esc(x.label) + ' <span class="hint">(' + esc(x.livello) + ')</span></td><td>' + esc(x.soglia) + '</td><td>' + esc(x.valore) + '</td><td>' + st(x.status) + '</td></tr>';
    }).join('') + '</table>';
    if (c.ok) h += '<dl class="kv">' + kv('Top holder (grezzo)', pct(c.topHolder ? c.topHolder.pct : 0) + ' · ' + short(c.topHolder && c.topHolder.owner)) + kv('Insider dichiarati (totale)', pct(c.insiderTotalPct) + ' <span class="hint">(liberi ' + pct(c.insiderLiquidPct) + ', bloccati ' + pct(c.insiderLockedPct) + ')</span>') + kv('Pool LP', pct(c.poolPct)) + kv('Holder on-chain', nd(c.holdersOnchain)) + '</dl>';
    h += '<p class="hint">' + esc(d.honesty || '') + '</p>';
    h += '<p class="links"><a href="https://x-zdos.it/lsd-trasparenza/" target="_blank" rel="noopener noreferrer">Trasparenza e piano L$D ↗</a></p></article>';
    return h;
  }

  function eco(d) {
    var rows = (d.services || []).map(function (s) {
      var cls = s.status === 'ok' ? 'color:var(--accent)' : s.status === 'down' ? 'color:var(--red)' : 'color:var(--muted)';
      return '<tr><td>' + esc(s.name) + '</td><td>:' + esc(s.port) + '</td><td style="' + cls + '"><b>' + esc(s.status.toUpperCase()) + '</b></td><td>' + (s.latencyMs != null ? esc(s.latencyMs) + ' ms' : 'n/d') + '</td><td>' + esc(s.detail || '') + '</td></tr>';
    }).join('');
    var f = d.fondoMerito || {};
    var h = '<div class="table-wrap terminal-panel"><table class="pairs"><thead><tr><th>Servizio</th><th>Porta</th><th>Stato</th><th>Latenza</th><th>Dettaglio</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    h += '<p class="hint" style="padding:0 8px">Controllo dal server ' + esc(new Date(d.checkedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })) + ' Europe/Rome · n/d = nessun endpoint health esposto.</p>';
    h += '<article class="card" style="margin:8px"><h3>Fondo merito · pagamenti</h3><dl class="kv">' +
      kv('Pagamenti', f.ok ? (f.payoutsOff ? '<span style="color:var(--accent)"><b>SPENTI</b></span>' : '<span class="risk-danger"><b>ATTIVI</b></span>') : 'n/d') +
      kv('emissionsLive', f.ok ? esc(String(f.emissionsLive)) : 'n/d') + kv('File STOP', f.ok ? (f.stopFile ? 'presente' : 'assente') : 'n/d') + kv('Stato', f.ok ? esc(f.status || 'n/d') : 'n/d') + '</dl>';
    if (f.ok && f.points) {
      h += '<p class="hint">Punti: ' + Object.keys(f.points).map(function (k) { return esc(k) + '=' + esc(f.points[k]); }).join(' · ') + '</p>';
      if (f.weeklyMax) h += '<p class="hint">Tetti settimanali nuovi: ' + Object.keys(f.weeklyMax).map(function (k) { return esc(k) + ' max ' + esc(f.weeklyMax[k]); }).join(' · ') + ' — <b>proposta, da confermare con doc</b> (work_proof, pool_snapshot).</p>';
    }
    return h + '</article>';
  }

  var busy = false;
  function load() {
    if (busy) return; busy = true;
    var a = document.getElementById('lsd-root'), b = document.getElementById('eco-health');
    if (!a || !b) { busy = false; return; }
    Promise.all([
      get('/api/domcoin').then(function (d) { a.innerHTML = card(d); get('/api/lsd-verde').then(function (v) { var el = document.createElement('div'); el.innerHTML = verde(v); a.appendChild(el); }).catch(function (e) { var el = document.createElement('p'); el.className = 'risk-warn'; el.textContent = 'Checklist verde non disponibile: ' + e.message; a.appendChild(el); }); document.getElementById('lsd-status').textContent = 'Letto ' + new Date(d.checkedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) + ' Europe/Rome' + (d.cached ? ' (cache 90 s)' : ''); }).catch(function (e) { a.innerHTML = '<p class="risk-danger">Dom-Coin non disponibile: ' + esc(e.message) + '</p>'; }),
      get('/api/ecosystem-health').then(function (d) { b.innerHTML = eco(d); }).catch(function (e) { b.innerHTML = '<p class="risk-danger">Salute ecosistema non disponibile: ' + esc(e.message) + '</p>'; }),
    ]).then(function () { busy = false; });
  }
  window.ZLSD = { load: load };
  if (document.querySelector('.view[data-view="domcoin"].on')) load();
})();
