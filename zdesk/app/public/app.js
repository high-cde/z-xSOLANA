
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const BASE = (typeof window.ZDESK_BASE === 'string' && window.ZDESK_BASE)
    ? window.ZDESK_BASE
    : (location.pathname.startsWith('/zdesk') ? '/zdesk' : '');

  const state = {
    tab: 'trending',
    pairs: { trending: [], new: [] },
    meta: {},
    prev: { trending: new Map(), new: new Map() },
    sort: { key: 'score', dir: -1 },
    minLiq: 30000,
    minScore: 0,
    q: '',
    deskWallet: '',
    nextRefresh: Date.now() + 45000,
    chart: null, volSeries: null, candleSeries: null,
    chartMint: null, chartPair: null, chartTf: { tf: 'minute', agg: 5 },
    seenToasts: new Set(),
    copyLogged: 0,
    ninjaWorst: null,
    ninjaSeen: new Set(),
    liveWallet: null,
    liveWalletPrev: null,
    antifake: null,
    copyLive: null,
    seenTx: new Set(),
  };

  function romeNow() {
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()) + ' Europe/Rome';
  }
  function tickClock() {
    $('#clock').textContent = romeNow();
    const left = Math.max(0, Math.ceil((state.nextRefresh - Date.now()) / 1000));
    const el = $('#countdown');
    if (el) el.textContent = left + 's';
  }
  tickClock();
  setInterval(tickClock, 1000);

  function fmtUsd(n, d = 2) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    const abs = Math.abs(x);
    if (abs >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (x / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'k';
    if (abs >= 1) return '$' + x.toFixed(d);
    if (abs === 0) return '$0';
    return '$' + x.toPrecision(4);
  }
  function fmtPx(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x) >= 1) return '$' + x.toLocaleString('it-IT', { maximumFractionDigits: 2 });
    return '$' + Number(x).toPrecision(4);
  }
  function fmtPct(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    const cls = x > 0 ? 'pos' : x < 0 ? 'neg' : '';
    const sign = x > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${x.toFixed(1)}%</span>`;
  }
  function fmtAge(ms) {
    if (!ms || ms < 0) return '—';
    const m = Math.floor(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 48) return h + 'h';
    return Math.floor(h / 24) + 'g';
  }
  function shortMint(m) {
    if (!m) return '';
    const s = String(m);
    if (s.length <= 10) return s;
    return s.slice(0, 4) + '…' + s.slice(-4);
  }
  function sferaHtml(score, partial) {
    if (score == null) return '<span class="sfera na">n/d</span>';
    const cls = score >= 0.85 ? 'hi' : score >= 0.55 ? 'mid' : 'lo';
    return `<span class="sfera ${cls}" title="${partial ? 'dati parziali' : ''}">${score.toFixed(3)}${partial ? '*' : ''}</span>`;
  }
  function bsHtml(tx) {
    const h = (tx && (tx.h1 || tx.h6 || tx.h24)) || {};
    const b = h.buys, s = h.sells;
    if (b == null && s == null) return '—';
    return `<span class="bs"><span class="b">${b ?? 0}</span>/<span class="s">${s ?? 0}</span></span>`;
  }
  function gaugeSvg(score) {
    const s = score == null ? 0 : Math.max(0, Math.min(1, score));
    const r = 28, c = 2 * Math.PI * r;
    const color = score == null ? '#253047' : s >= 0.85 ? '#4ade80' : s >= 0.55 ? '#f3d7a5' : '#f87171';
    const label = score == null ? 'n/d' : s.toFixed(2);
    return `<span class="gauge" title="Sfera ${label}">
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <g transform="rotate(-90 38 38)">
          <circle cx="38" cy="38" r="${r}" fill="none" stroke="#1a242c" stroke-width="6"/>
          <circle cx="38" cy="38" r="${r}" fill="none" stroke="${color}" stroke-width="6"
            stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - s)}"
            style="filter:drop-shadow(0 0 6px ${color}99)"/>
        </g>
        <text x="38" y="42" text-anchor="middle">${label}</text>
      </svg>
    </span>`;
  }

  function toast(msg, kind) {
    const key = kind + ':' + msg;
    if (state.seenToasts.has(key)) return;
    state.seenToasts.add(key);
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'warn' ? ' warn' : '');
    el.innerHTML = msg;
    box.appendChild(el);
    setTimeout(() => { el.remove(); }, 6000);
    if (state.seenToasts.size > 80) state.seenToasts.clear();
  }

  async function api(path) {
    const r = await fetch(BASE + path, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function refreshHealth() {
    try {
      const h = await api('/api/health');
      const src = h.sources || {};
      $('#src-health').innerHTML = ['dexscreener', 'geckoterminal', 'rugcheck', 'rpc', 'pumpfun', 'jupiter']
        .filter((k) => src[k])
        .map((k) => {
          const s = src[k];
          const cls = s.ok === true ? 'ok' : s.ok === false ? 'bad' : '';
          return `<span class="chip ${cls}" title="${s.note || ''}">${k}</span>`;
        }).join('');
    } catch { /* */ }
  }

  const COLS = [
    { key: 'symbol', label: 'Token', left: true },
    { key: 'priceUsd', label: 'Prezzo' },
    { key: 'mcap', label: 'MCap' },
    { key: 'liqUsd', label: 'Liquidità' },
    { key: 'vol.h1', label: 'Vol 1h' },
    { key: 'vol.h6', label: 'Vol 6h' },
    { key: 'vol.h24', label: 'Vol 24h' },
    { key: 'priceChange.h1', label: 'Δ 1h' },
    { key: 'bs', label: 'Buy/Sell' },
    { key: 'ageMs', label: 'Età' },
    { key: 'score', label: 'Sfera' },
  ];

  function getVal(row, key) {
    if (key === 'bs') {
      const t = row.txns || {};
      const h = t.h1 || t.h6 || {};
      const b = Number(h.buys) || 0, s = Number(h.sells) || 0;
      return b + s ? b / (b + s) : -1;
    }
    return key.split('.').reduce((a, k) => (a == null ? a : a[k]), row);
  }

  function flashClass(kind, mint, field, val) {
    const prevMap = state.prev[kind];
    if (!prevMap || val == null) return '';
    const old = prevMap.get(mint);
    if (!old || old[field] == null) return '';
    if (val > old[field] * 1.0001) return 'flash-up';
    if (val < old[field] * 0.9999) return 'flash-down';
    return '';
  }

  function renderTable(id, rows, kind) {
    const el = document.getElementById(id);
    const q = state.q.trim().toLowerCase();
    let list = (rows || []).filter((r) => (r.liqUsd || 0) >= state.minLiq || state.minLiq === 0);
    if (state.minScore > 0) list = list.filter((r) => (r.score || 0) >= state.minScore);
    if (q) {
      list = list.filter((r) =>
        (r.symbol || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.mint || '').toLowerCase().includes(q) ||
        (r.pairAddress || '').toLowerCase().includes(q)
      );
    }
    const { key, dir } = state.sort;
    list = list.slice().sort((a, b) => {
      const va = getVal(a, key), vb = getVal(b, key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });

    const thead = `<thead><tr>${COLS.map((c) =>
      `<th class="${c.left ? 'left' : ''}" data-k="${c.key}">${c.label}${state.sort.key === c.key ? (dir < 0 ? ' ▾' : ' ▴') : ''}</th>`
    ).join('')}</tr></thead>`;
    const body = list.map((r) => {
      const flPx = flashClass(kind, r.mint, 'priceUsd', r.priceUsd);
      const flSc = flashClass(kind, r.mint, 'score', r.score);
      const flV = flashClass(kind, r.mint, 'vol1h', r.vol && r.vol.h1);
      return `<tr data-mint="${r.mint || ''}" data-pair="${r.pairAddress || ''}">
      <td class="left"><div class="tok"><b>${esc(r.symbol || '—')}</b><span>${esc(shortMint(r.mint))} · ${esc(r.dexId || '')}</span></div></td>
      <td class="${flPx}">${fmtPx(r.priceUsd)}</td>
      <td>${fmtUsd(r.mcap)}</td>
      <td>${fmtUsd(r.liqUsd)}</td>
      <td class="${flV}">${fmtUsd(r.vol && r.vol.h1)}</td>
      <td>${fmtUsd(r.vol && r.vol.h6)}</td>
      <td>${fmtUsd(r.vol && r.vol.h24)}</td>
      <td>${fmtPct(r.priceChange && r.priceChange.h1)}</td>
      <td>${bsHtml(r.txns)}</td>
      <td class="age">${fmtAge(r.ageMs)}</td>
      <td class="${flSc}">${sferaHtml(r.score, r.scoreMeta && r.scoreMeta.partial)}</td>
    </tr>`;
    }).join('');
    el.innerHTML = thead + '<tbody>' + (body || `<tr><td colspan="11" class="empty">Nessuna pair con i filtri attuali.</td></tr>`) + '</tbody>';
    el.dataset.ready = list.length ? '1' : '0';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function rememberAndAlert(kind, rows) {
    const prev = state.prev[kind] || new Map();
    const next = new Map();
    let newCount = 0;
    for (const r of rows || []) {
      if (!r.mint) continue;
      next.set(r.mint, { priceUsd: r.priceUsd, score: r.score, vol1h: r.vol && r.vol.h1, symbol: r.symbol });
      if (prev.size && !prev.has(r.mint) && newCount < 3) {
        toast(`<b>Nuovo in ${kind === 'new' ? 'nuove pair' : 'tendenza'}:</b> ${esc(r.symbol || shortMint(r.mint))} · sfera ${r.score != null ? r.score.toFixed(3) : 'n/d'}`);
        newCount++;
      }
      const old = prev.get(r.mint);
      if (old && (old.score || 0) < 0.85 && (r.score || 0) >= 0.85) {
        toast(`<b>Sfera alta:</b> ${esc(r.symbol || '')} ${r.score.toFixed(3)} (zona entry desk, non è un ordine)`);
      }
    }
    state.prev[kind] = next;
  }

  async function loadPairs(tab) {
    const kind = tab === 'new' ? 'new' : 'trending';
    const data = await api('/api/pairs?tab=' + kind);
    rememberAndAlert(kind, data.rows || []);
    state.pairs[kind] = data.rows || [];
    state.meta[kind] = data;
    renderTable(kind === 'new' ? 'tbl-new' : 'tbl-trending', state.pairs[kind], kind);
    if (state.tab === kind || (state.tab === 'trending' && kind === 'trending')) {
      $('#updated').textContent = 'aggiornato ' + romeNow() + (data.stale ? ' (stale)' : '');
    }
    document.body.dataset.ready = '1';
  }

  function curveBlock(c) {
    if (!c) return '';
    if (c.complete) return '<p class="risk-ok">Curva pump.fun: <strong>graduato</strong></p>';
    const pct = ((c.progressSol || 0) * 100).toFixed(2);
    return `<div>
      <div class="muted">Progresso curva pump.fun (on-chain)</div>
      <div class="progress"><i style="width:${Math.min(100, c.progressSol * 100)}%"></i></div>
      <div><strong>${pct}%</strong> · ${c.realSol.toFixed(3)} / ${c.targetSol} SOL
        ${c.progressTok != null ? ' · token venduti ≈ ' + (c.progressTok * 100).toFixed(2) + '%' : ''}
        · non graduato</div>
    </div>`;
  }

  function kv(label, val) {
    return `<div><dt>${label}</dt><dd>${val}</dd></div>`;
  }

  function destroyChart() {
    if (state.chart) {
      try { state.chart.remove(); } catch { /* */ }
      state.chart = null;
      state.candleSeries = null;
      state.volSeries = null;
    }
  }

  async function renderChart(pairAddress) {
    const note = $('#d-chart-note');
    const host = $('#d-chart');
    if (!pairAddress || typeof LightweightCharts === 'undefined') {
      note.textContent = pairAddress ? 'Libreria grafici non caricata.' : 'Nessuna pair per il grafico.';
      destroyChart();
      host.innerHTML = '';
      return;
    }
    note.textContent = 'Carico candele…';
    const { tf, agg } = state.chartTf;
    let data;
    try {
      data = await api(`/api/ohlcv/${encodeURIComponent(pairAddress)}?tf=${tf}&aggregate=${agg}&limit=180`);
    } catch (e) {
      note.textContent = 'OHLCV non disponibile: ' + e.message;
      return;
    }
    const candles = (data.candles || []).filter((c) => c.time && c.close != null);
    if (!candles.length) {
      destroyChart();
      host.innerHTML = '';
      note.textContent = data.error ? ('Nessuna candela: ' + data.error) : 'Nessuna candela GeckoTerminal per questa pair (tipico sulle bonding curve pump.fun).';
      return;
    }
    destroyChart();
    host.innerHTML = '';
    const chart = LightweightCharts.createChart(host, {
      layout: { background: { color: '#060910' }, textColor: '#a7b3cc', fontFamily: 'IBM Plex Mono, monospace' },
      grid: { vertLines: { color: '#25304766' }, horzLines: { color: '#25304766' } },
      width: host.clientWidth,
      height: host.clientHeight || 280,
      timeScale: { timeVisible: true, secondsVisible: tf === 'minute', borderColor: '#253047' },
      rightPriceScale: { borderColor: '#253047' },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#4ade80', downColor: '#f87171',
      borderUpColor: '#4ade80', borderDownColor: '#f87171',
      wickUpColor: '#4ade80', wickDownColor: '#f87171',
    });
    series.setData(candles.map((c) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    const vol = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    vol.setData(candles.map((c) => ({
      time: c.time,
      value: c.volume || 0,
      color: (c.close >= c.open ? '#4ade8066' : '#f8717166'),
    })));
    chart.timeScale().fitContent();
    state.chart = chart;
    state.candleSeries = series;
    state.volSeries = vol;
    note.textContent = `${candles.length} candele · ${tf}/${agg} · ${data.stale ? 'cache stale' : 'live'}`;
    const onResize = () => { if (state.chart) state.chart.applyOptions({ width: host.clientWidth }); };
    window.addEventListener('resize', onResize, { passive: true });
  }

  async function openToken(mint, pairHint) {
    const drawer = $('#drawer');
    const body = $('#d-body');
    $('#d-title').textContent = 'Caricamento…';
    body.innerHTML = '<p class="muted">Carico DexScreener, RugCheck e RPC…</p>';
    drawer.hidden = false;
    state.chartMint = mint;
    try {
      const data = await api('/api/token/' + encodeURIComponent(mint));
      const t = data.token || {};
      state.chartPair = t.pairAddress || pairHint || (t.allPairs && t.allPairs[0] && t.allPairs[0].pairAddress);
      $('#d-title').textContent = (t.symbol || 'Token') + ' · ' + (t.name || '');
      const rug = t.rug || {};
      const holders = (rug.holdersExPool && rug.holdersExPool.length ? rug.holdersExPool : rug.holders) || [];
      const risks = (rug.risks || []).map((r) =>
        `<li class="risk-${esc(String(r.level).toLowerCase())}"><strong>${esc(r.name)}</strong> · ${esc(r.level)} ${r.description ? '— ' + esc(r.description) : ''}</li>`
      ).join('');
      const factors = (t.scoreMeta && t.scoreMeta.used) || {};
      const factorRows = Object.entries(factors).map(([k, v]) =>
        `<li>${esc(k)}: ${(v.raw).toFixed(3)} · peso ${v.weight.toFixed(2)}</li>`
      ).join('');
      body.innerHTML = `
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          ${gaugeSvg(t.score)}
          <div>
            <p class="muted" style="margin:0">${esc(t.mint)} · ${esc(t.dexId || '')}</p>
            <div style="font-size:1.4rem;font-weight:800">${fmtPx(t.priceUsd)} ${fmtPct(t.priceChange && t.priceChange.h24)}</div>
          </div>
        </div>
        <div class="kv">
          ${kv('MCap', fmtUsd(t.mcap))}
          ${kv('Liquidità', fmtUsd(t.liqUsd))}
          ${kv('Vol 1h / 6h / 24h', `${fmtUsd(t.vol && t.vol.h1)} / ${fmtUsd(t.vol && t.vol.h6)} / ${fmtUsd(t.vol && t.vol.h24)}`)}
          ${kv('Δ 1h / 24h', `${fmtPct(t.priceChange && t.priceChange.h1)} / ${fmtPct(t.priceChange && t.priceChange.h24)}`)}
          ${kv('Sfera', sferaHtml(t.score, t.scoreMeta && t.scoreMeta.partial))}
          ${kv('Buy/Sell 1h', bsHtml(t.txns))}
        </div>
        ${curveBlock(t.bondingCurve)}
        <h3>Rug check</h3>
        <div class="kv">
          ${kv('Mint authority', rug.mintRevoked ? '<span class="risk-ok">revocata</span>' : (rug.mintRevoked === false ? '<span class="risk-danger">attiva</span>' : 'n/d'))}
          ${kv('Freeze authority', rug.freezeRevoked ? '<span class="risk-ok">revocata</span>' : (rug.freezeRevoked === false ? '<span class="risk-danger">attiva</span>' : 'n/d'))}
          ${kv('Top 10% (ex pool)', rug.top10PctExPool != null ? rug.top10PctExPool.toFixed(1) + '%' : 'n/d')}
          ${kv('Holder più grande (ex pool)', rug.top1PctExPool != null ? rug.top1PctExPool.toFixed(1) + '%' : 'n/d')}
          ${kv('Holder totali', rug.totalHolders ?? 'n/d')}
          ${kv('RugCheck', `<span class="risk-${esc(rug.riskLevel || 'ok')}">${esc(rug.riskLevel || 'n/d')}${rug.rugged ? ' · rugged' : ''} ${rug.scoreNorm != null ? '· score ' + rug.scoreNorm : ''}</span>`)}
        </div>
        ${risks ? '<ul>' + risks + '</ul>' : '<p class="muted">Nessun rischio segnalato da RugCheck.</p>'}
        <h3>Holder principali</h3>
        <table class="holders">${holders.slice(0, 10).map((h) =>
          `<tr><td>${esc(shortMint(h.owner || h.address))}</td><td>${(h.pct || 0).toFixed(2)}%</td></tr>`
        ).join('') || '<tr><td>n/d</td></tr>'}</table>
        <h3>Scomposizione sfera</h3>
        <ul>${factorRows || '<li>dati insufficienti</li>'}</ul>
        ${(t.scoreMeta && t.scoreMeta.notes || []).map((n) => `<p class="muted">${esc(n)}</p>`).join('')}
        <h3>Link</h3>
        <p>
          ${t.links && t.links.dexscreener ? `<a href="${t.links.dexscreener}" target="_blank" rel="noopener">DexScreener</a> · ` : ''}
          ${t.links && t.links.solscan ? `<a href="${t.links.solscan}" target="_blank" rel="noopener">Solscan</a> · ` : ''}
          ${t.links && t.links.rugcheck ? `<a href="${t.links.rugcheck}" target="_blank" rel="noopener">RugCheck</a>` : ''}
        </p>
      `;
      await renderChart(state.chartPair);
    } catch (e) {
      body.innerHTML = '<p class="risk-danger">Errore: ' + esc(e.message) + '</p>';
    }
  }

  function tokenCard(item, extraHtml) {
    const t = item.token || {};
    const err = item.error ? `<p class="risk-danger">${esc(item.error)}</p>` : '';
    return `<article class="card" data-mint="${esc(t.mint || item.mint || '')}" data-pair="${esc(t.pairAddress || '')}">
      <h3>${esc(item.symbol || t.symbol || '—')}
        <span>${gaugeSvg(t.score)} ${sferaHtml(t.score, t.scoreMeta && t.scoreMeta.partial)}</span></h3>
      <p class="muted">${esc(item.name || t.name || '')} · ${esc(shortMint(item.mint || t.mint))} · ${esc(t.dexId || '')}</p>
      ${item.note ? `<p class="hint">${esc(item.note)}</p>` : ''}
      <div class="kv">
        ${kv('Prezzo', fmtPx(t.priceUsd))}
        ${kv('Δ 24h', fmtPct(t.priceChange && t.priceChange.h24))}
        ${kv('Liquidità', fmtUsd(t.liqUsd))}
        ${kv('Vol 24h', fmtUsd(t.vol && t.vol.h24))}
        ${kv('Vol 1h', fmtUsd(t.vol && t.vol.h1))}
        ${kv('MCap', fmtUsd(t.mcap))}
      </div>
      ${curveBlock(t.bondingCurve)}
      ${t.rug ? `<p class="hint">RugCheck: <span class="risk-${esc(t.rug.riskLevel || 'ok')}">${esc(t.rug.riskLevel)}</span>
        · mint ${t.rug.mintRevoked ? 'revocata' : 'attiva'} · freeze ${t.rug.freezeRevoked ? 'revocata' : 'attiva'}
        · top10 ex-pool ${t.rug.top10PctExPool != null ? t.rug.top10PctExPool.toFixed(1) + '%' : 'n/d'}</p>` : ''}
      ${extraHtml || ''}
      ${err}
    </article>`;
  }


  function ninjaPill(status) {
    const st = (status || 'OK').toUpperCase();
    const cls = st === 'EXIT' ? 'exit' : st === 'WARN' ? 'warn' : 'ok';
    return `<span class="ninja-pill ${cls}">${st}</span>`;
  }

  function updateNinjaBadge(data) {
    const el = $('#ninja-badge');
    if (!el) return;
    const alive = data && (data.daemonAlive !== false) && data.daemon && data.daemon.status === 'running';
    const worst = (data && data.daemon && data.daemon.worst) || ((data && data.positions || []).some((p) => p.status === 'EXIT') ? 'EXIT' : (data && data.positions || []).some((p) => p.status === 'WARN') ? 'WARN' : 'OK');
    const n = (data && data.positions && data.positions.length) || 0;
    const lag = data && data.tickAgeMs != null ? Math.round(data.tickAgeMs / 1000) + 's' : '—';
    if (data && data.missing) {
      el.className = 'ninja-badge na';
      el.textContent = 'NINJA · OFF';
      el.title = 'ninja.json non ancora scritto';
      return;
    }
    if (!alive) {
      el.className = 'ninja-badge offline';
      el.textContent = 'NINJA · OFFLINE';
      el.title = 'demone fermo';
      return;
    }
    const cls = worst === 'EXIT' ? 'exit' : worst === 'WARN' ? 'warn' : 'ok';
    el.className = 'ninja-badge ' + cls;
    el.textContent = `NINJA · ${worst}` + (n ? ` · ${n}` : '');
    el.title = `book ${n} · ultimo tick ${lag} fa`;
    el.style.cursor = 'pointer';
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', () => showTab('ninja'));
    }
    for (const pos of (data.positions || [])) {
      const key = pos.status + ':' + pos.mint;
      if (state.ninjaSeen.has(key)) continue;
      if (pos.status === 'EXIT') {
        state.ninjaSeen.add(key);
        toast(`<b>NINJA EXIT</b> ${esc(pos.symbol)} — vendita 100% via Phantom, slip 5%. ${esc(pos.exitReason || '')}`, 'warn');
      } else if (pos.status === 'WARN') {
        state.ninjaSeen.add(key);
        toast(`<b>NINJA WARN</b> ${esc(pos.symbol)} — trail 3%. ${esc(pos.warnReason || '')}`, 'warn');
      }
    }
    state.ninjaWorst = worst;
  }

  async function loadNinja() {
    const data = await api('/api/ninja');
    updateNinjaBadge(data);
    const box = $('#ninja-cards');
    const st = $('#ninja-status');
    if (!box || !st) return data;
    const d = data.daemon || {};
    const alive = data.daemonAlive !== false && d.status === 'running';
    st.textContent = (alive ? 'Demone attivo' : 'Demone fermo') +
      (d.lastTickRome ? ' · ultimo tick ' + d.lastTickRome : '') +
      (d.lagMs != null ? ' · lag ' + d.lagMs + 'ms' : '') +
      ' · chiavi ' + (d.keys ? 'SÌ (anomalia)' : 'no') +
      ' · ' + ((data.positions || []).length) + ' posizioni';
    const cards = (data.positions || []).map((p) => {
      const cls = p.status === 'EXIT' ? 'ninja-exit' : p.status === 'WARN' ? 'ninja-warn' : '';
      const sigs = (p.windowSignals || p.reds || []).map((s) =>
        `<li><code>${esc(s.id)}</code> — ${esc(s.detail || '')}</li>`
      ).join('');
      return `<article class="card ${cls}" data-mint="${esc(p.mint || '')}" data-pair="${esc(p.pairAddress || '')}">
        <h3>${esc(p.symbol || '—')} ${ninjaPill(p.status)}
          <small>${esc((p.source || '') + ' · ' + shortMint(p.mint))}</small></h3>
        <div class="kv">
          ${kv('PnL vs entry', p.pnlPct != null ? (p.pnlPct > 0 ? '+' : '') + p.pnlPct.toFixed(2) + '%' : '—')}
          ${kv('Vs picco', p.fromPeakPct != null ? (p.fromPeakPct > 0 ? '+' : '') + p.fromPeakPct.toFixed(2) + '%' : '—')}
          ${kv('Prezzo', fmtPx(p.mark))}
          ${kv('Entry', fmtPx(p.entryUsd))}
          ${kv('Liquidità', fmtUsd(p.liqUsd) + (p.liqPct != null ? ' (' + p.liqPct.toFixed(1) + '%)' : ''))}
          ${kv('Azione', p.action || 'nessuna')}
        </div>
        ${p.exitReason ? `<p class="risk-danger">${esc(p.exitReason)}</p>` : ''}
        ${p.warnReason && p.status === 'WARN' ? `<p class="risk-warn">${esc(p.warnReason)}</p>` : ''}
        <ul class="sig-list">${sigs || '<li class="muted">Nessun segnale rosso.</li>'}</ul>
      </article>`;
    }).join('');
    const empty = '<p class="empty">Nessuna posizione aperta. Il Ninja resta in ascolto su risk.md e copy-live.md (avvio copy 11 nov 09:00 Europe/Rome).</p>';
    const exits = (data.lastExits || []).slice(0, 5).map((p) =>
      `<li><span class="ninja-pill exit">EXIT</span> ${esc(p.symbol)} · ${esc(p.exitReason || '')}</li>`
    ).join('');
    box.innerHTML = cards || empty;
    if (exits) box.innerHTML += `<article class="card" style="cursor:default"><h3>Ultime uscite</h3><ul class="sig-list">${exits}</ul></article>`;
    box.dataset.ready = '1';
    return data;
  }

  async function loadWatchlist() {
    const data = await api('/api/watchlist');
    $('#watch-cards').innerHTML = (data.items || []).map((it) => tokenCard(it)).join('') || '<p class="empty">Nessun dato.</p>';
    $('#watch-cards').dataset.ready = '1';
  }

  async function loadXstocks() {
    const data = await api('/api/xstocks');
    $('#xstock-cards').innerHTML = (data.items || []).map((it) =>
      tokenCard(it, `<p class="risk-warn"><strong>Acquisto bloccato</strong> (georestriction Phantom) — solo watch.</p>`)
    ).join('') || '<p class="empty">Nessun titolo trovato.</p>';
    $('#xstock-cards').dataset.ready = '1';
  }

  async function loadDesk() {
    const data = await api('/api/desk');
    const order = [
      ['risk', 'Risk'],
      ['go', 'GO / Analyst'],
      ['survivors', 'Survivors'],
      ['signals', 'GMGN signals (ultimi)'],
    ];
    $('#desk-panels').innerHTML = order.map(([k, title]) => {
      const s = (data.sections || {})[k] || {};
      const wide = k === 'signals' || k === 'go' ? ' wide' : '';
      return `<article class="desk-panel${wide}" data-ready="1">
        <h2>${title} <small class="muted">${s.mtime ? new Date(s.mtime).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) + ' Europe/Rome' : ''} ${s.truncated ? ' · troncato' : ''}</small></h2>
        ${s.html || '<p class="muted">vuoto</p>'}
      </article>`;
    }).join('');
    $('#desk-panels').dataset.ready = '1';
  }


  function sniffClass(verdict) {
    const v = String(verdict || '').toUpperCase();
    if (v === 'FAKE') return 'fake';
    if (v === 'EXIT_LIQ') return 'exitliq';
    if (v === 'WARN') return 'warn';
    if (v === 'OK') return 'ok';
    return 'na';
  }
  function sniffPill(verdict) {
    const v = verdict ? String(verdict).toUpperCase() : '—';
    return `<span class="sniff-pill ${sniffClass(verdict)}">${esc(v)}</span>`;
  }
  function fmtRomeIso(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).replace('T', ' ');
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d) + ' Europe/Rome';
  }
  function sniffFlags(flags) {
    const list = (flags || []).map((f) =>
      `<li>${sniffPill(f.severity || '')} <code>${esc(f.code || '')}</code> ${esc(f.msg || '')}</li>`
    ).join('');
    return list ? `<ul class="flag-list">${list}</ul>` : '';
  }
  function updateSniffBadge(data) {
    const el = $('#sniff-badge');
    if (!el) return;
    if (!data || data.empty || !data.verdict) {
      el.className = 'sniff-badge na';
      el.textContent = 'SNIFF · in attesa';
      el.title = 'nessun controllo ancora';
    } else {
      const cls = sniffClass(data.verdict);
      el.className = 'sniff-badge ' + cls;
      el.textContent = 'SNIFF · ' + String(data.verdict).toUpperCase();
      el.title = (data.allowBuy ? 'buy consentito' : 'buy bloccato') + ' · ' + fmtRomeIso(data.at);
    }
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', () => showTab('copytrader'));
    }
  }
  function renderSniffCompact(el, data) {
    if (!el) return;
    if (!data || data.empty || !data.verdict) {
      el.innerHTML = `${sniffPill('')} <span class="sniff-main">Sniffer anti-fake</span> <span>nessun controllo ancora</span>`;
      el.dataset.ready = '1';
      if (!el.dataset.bound) {
        el.dataset.bound = '1';
        el.addEventListener('click', () => showTab('copytrader'));
      }
      return;
    }
    const src = data.sourceWallet ? shortMint(data.sourceWallet) : '—';
    const mint = data.symbol || (data.mint ? shortMint(data.mint) : '—');
    const buy = data.allowBuy ? 'buy ok' : 'buy bloccato';
    el.innerHTML = `${sniffPill(data.verdict)} <span class="sniff-main">Sniffer · ${esc(String(data.verdict).toUpperCase())}</span>
      <span>${esc(mint)} · src ${esc(src)}</span>
      <span>${esc(buy)}</span>
      <span>${esc(fmtRomeIso(data.at))}</span>`;
    el.dataset.ready = '1';
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', () => showTab('copytrader'));
    }
  }
  function renderSniffPanel(el, data) {
    if (!el) return;
    if (!data || data.empty || !data.verdict) {
      el.innerHTML = `<h3>Sniffer anti-fake</h3><p class="muted">nessun controllo ancora</p>
        <p class="hint">Obbligatorio prima di ogni copy buy. FAKE e EXIT_LIQ bloccano l'acquisto (source che vende sui follower, honeypot, mint/freeze aperti, rug, top10 &gt; 35%, liq &lt; $100k, impersonation, RugCheck assente).</p>`;
      el.dataset.ready = '1';
      return;
    }
    const hist = (data.history || []).slice(0, 6).map((h) =>
      `<li>${sniffPill(h.verdict)} <span>${esc(fmtRomeIso(h.at))}</span>
        <code>${esc(h.symbol || shortMint(h.mint))}</code>
        <span>src ${esc(shortMint(h.sourceWallet))}</span>
        <span>${h.allowBuy ? 'buy ok' : 'bloccato'}</span></li>`
    ).join('');
    el.innerHTML = `<h3>Sniffer anti-fake ${sniffPill(data.verdict)}</h3>
      <div class="sniff-meta">
        ${kv('Verdetto', String(data.verdict || '—').toUpperCase())}
        ${kv('Buy', data.allowBuy ? 'consentito' : 'bloccato')}
        ${kv('Mint', data.mint ? shortMint(data.mint) : '—')}
        ${kv('Source', data.sourceWallet ? shortMint(data.sourceWallet) : '—')}
        ${kv('Quando', fmtRomeIso(data.at))}
      </div>
      ${data.mint ? `<p class="hint"><code>${esc(data.mint)}</code>${data.sourceWallet ? ' · src <code>' + esc(data.sourceWallet) + '</code>' : ''}</p>` : ''}
      ${sniffFlags(data.flags)}
      ${hist ? `<ul class="sniff-history">${hist}</ul>` : ''}`;
    el.dataset.ready = '1';
  }
  async function loadAntifake() {
    try {
      const data = await api('/api/antifake');
      state.antifake = data;
      updateSniffBadge(data);
      renderSniffCompact($('#sniff-home'), data);
      renderSniffPanel($('#copy-sniff'), data);
      return data;
    } catch (e) {
      const empty = { empty: true, message: 'nessun controllo ancora' };
      updateSniffBadge(empty);
      renderSniffCompact($('#sniff-home'), empty);
      if ($('#copy-sniff')) renderSniffPanel($('#copy-sniff'), empty);
      return empty;
    }
  }
  function renderCopyLive(el, live, wallet) {
    if (!el) return;
    const L = live || {};
    const pol = (wallet && wallet.policy) || {};
    const approved = L.approvedCount != null ? L.approvedCount : 0;
    const budget = pol.budgetUsd != null ? pol.budgetUsd : null;
    const tradable = pol.tradableUsd != null ? pol.tradableUsd : null;
    const fills = L.hasLiveFills
      ? ((L.openCount || 0) + ' aperte · ' + (L.closedCount || 0) + ' chiuse')
      : 'nessun fill LIVE';
    el.innerHTML = `<h3>Copy LIVE · wallet agente</h3>
      <div class="sniff-meta">
        ${kv('Stato', 'HighKali compra e vende da solo sul wallet agente')}
        ${kv('APPROVED', '<span class="' + (approved === 0 ? 'zero' : '') + '">' + approved + '</span>')}
        ${kv('Budget', budget != null ? fmtUsdFull(budget) + ' / ' + fmtUsdFull(L.budgetMaxUsd || 30) : 'fino a ' + fmtUsdFull(L.budgetMaxUsd || 30))}
        ${kv('Floor', fmtUsdFull(L.floorUsd || 50) + ' su SOL+USDC')}
        ${kv('Tradabile', tradable != null ? fmtUsdFull(tradable) : '—')}
        ${kv('Size / max', (L.size || '~1/3 del budget') + ' · max ' + (L.maxPositions || 3))}
        ${kv('Stop / TP', 'stop −2% · +4% vende metà · runner +8% / +12% · pari a entry')}
        ${kv('Slippage', 'buy 1% · exit 1% (retry 2%) · impact ≤ 0,5%')}
        ${kv('Sniffer', 'obbligatorio prima di ogni buy')}
        ${kv('Book LIVE', fills)}
      </div>
      <p class="hint">${esc(L.notice || 'Solo wallet APPROVED. Niente perpetual. $OV tenuto · non in vendita.')}</p>
      <p class="ov-held">$OV tenuto · non in vendita · budget ${esc(fmtUsdFull(L.budgetMaxUsd || 30))} · floor ${esc(fmtUsdFull(L.floorUsd || 50))} su SOL+USDC</p>`;
    el.dataset.ready = '1';
  }


  function lagLabel(lag) {
    if (!lag || lag.min == null) return '—';
    if (lag.min === lag.max) return lag.min + ' s';
    return lag.min + '–' + lag.max + ' s';
  }
  function lagClass(lag) {
    if (!lag || lag.min == null) return '';
    const n = lag.max != null ? lag.max : lag.min;
    if (n <= 15) return 'lag-ok';
    if (n <= 60) return 'lag-warn';
    return 'lag-bad';
  }
  function walletPill(status) {
    const st = String(status || '').toUpperCase();
    const cls = st === 'APPROVED' ? 'approved' : (st === 'WATCH' ? 'watch' : (st === 'EXCLUDED' ? 'excluded' : ''));
    return `<span class="wallet-pill ${cls}">${esc(st || '—')}</span>`;
  }
  function renderCopyFeed(el, feed) {
    if (!el) return;
    const f = feed || {};
    const lag = lagLabel(f.lag);
    const poll = f.status === 'running' ? 'in corso' : (f.status === 'error' ? 'errore' : (f.lastPollAt ? 'ok' : 'in attesa'));
    el.innerHTML = `<h3>Feed segnali · ogni ${esc(String(Math.round((f.intervalMs || 45000) / 1000)))}s</h3>
      <div class="copy-feed-meta">
        ${kv('Stato', poll + (f.lastError ? ' · ' + esc(f.lastError) : ''))}
        ${kv('Ultimo poll', fmtRomeIso(f.lastPollAt))}
        ${kv('Ultimo segnale', f.lastSignalStamp ? esc(f.lastSignalStamp) + ' Europe/Rome' : fmtRomeIso(f.lastSignalAt))}
        ${kv('Lag misurato', '<span class="' + lagClass(f.lag) + '">' + esc(lag) + '</span>')}
        ${kv('Wallet osservati', f.watchedCount != null ? String(f.watchedCount) : '—')}
      </div>
      <p class="hint">Poller in background: il ritardo rispetto allo swap è il lag misurato (obiettivo 4–10 s, prima 15–20 min).</p>`;
    el.dataset.ready = '1';
  }
  function renderWalletBook(el, book) {
    if (!el) return;
    const b = book || { wallets: [], counts: {}, missing: true };
    const c = b.counts || {};
    const updated = b.updatedAt || (b.fileMtime ? fmtRomeIso(b.fileMtime) : '—');
    if (b.missing) {
      el.innerHTML = `<h3>Wallet copy · copy-wallets.md</h3><p class="empty">File non trovato. Lista riletta a ogni aggiornamento, senza wallet fissi.</p>`;
      el.dataset.ready = '1';
      return;
    }
    const rows = (b.wallets || []).map((w) => {
      const st = String(w.status || '').toUpperCase();
      const cls = st === 'APPROVED' ? 'approved-row' : (st === 'WATCH' ? 'watch-row' : '');
      const href = w.address ? 'https://solscan.io/account/' + encodeURIComponent(w.address) : '';
      const addr = w.address
        ? `<a href="${esc(href)}" target="_blank" rel="noopener"><code title="${esc(w.address)}">${esc(shortMint(w.address))}</code></a>`
        : '—';
      const hold = w.hold || '—';
      const pnlClass = (w.pnlSol != null ? w.pnlSol : w.pnlUsd) < 0 ? 'neg' : ((w.pnlSol != null ? w.pnlSol : w.pnlUsd) > 0 ? 'pos' : '');
      return `<tr class="${cls}">
        <td>${addr}</td>
        <td>${walletPill(st)}</td>
        <td class="num">${esc(w.closed != null ? String(w.closed) : (w.closedLabel || 'n/d'))}</td>
        <td class="num ${pnlClass}">${esc(w.pnl || 'n/d')}</td>
        <td class="num">${esc(w.wr || 'n/d')}</td>
        <td class="num">${esc(hold)}</td>
        <td class="reason">${esc(w.reason || '—')}</td>
      </tr>`;
    }).join('');
    const crit = (b.criteria || []).length
      ? `<p class="criteria">Criteri letti dal file: ${esc((b.criteria || []).join(' · '))}</p>`
      : '<p class="criteria">Lista letta in tempo reale da copy-wallets.md (nessun wallet hardcoded).</p>';
    el.innerHTML = `<h3>Lista wallet copy</h3>
      <p class="counts">APPROVED <strong>${c.APPROVED || 0}</strong> · WATCH <strong>${c.WATCH || 0}</strong> · EXCLUDED <strong>${c.EXCLUDED || 0}</strong> · aggiornata ${esc(updated)}</p>
      <div class="table-wrap"><table class="copy-book-table">
        <thead><tr>
          <th>Wallet</th><th>Stato</th>
          <th class="num">Chiusi 14g</th><th class="num">PnL</th>
          <th class="num">WR</th><th class="num">Hold mediano</th><th>Motivo</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="empty">Nessun wallet nel file.</td></tr>'}</tbody>
      </table></div>
      ${crit}`;
    el.dataset.ready = '1';
  }
  function renderCopyRefusals(el, list) {
    if (!el) return;
    const rows = (list || []).map((r) => `<tr>
      <td>${esc(r.at ? fmtRomeIso(r.at) : '—')}</td>
      <td><strong>${esc(r.symbol || (r.mint ? shortMint(r.mint) : '—'))}</strong>${r.mint ? '<div class="muted"><code title="' + esc(r.mint) + '">' + esc(shortMint(r.mint)) + '</code></div>' : ''}</td>
      <td>${sniffPill(r.verdict)}</td>
      <td class="reason">${esc(r.reason || '—')}</td>
    </tr>`).join('');
    el.innerHTML = `<h3>Rifiuti anti-fake</h3>
      <p class="hint">Verdetti recenti BLOCK / FAKE / EXIT_LIQ da anti-fake.json, ledger e copy-live.md. Token, verdetto e motivo.</p>
      <div class="table-wrap"><table class="copy-ref-table">
        <thead><tr><th>Quando</th><th>Token</th><th>Verdetto</th><th>Motivo</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">Nessun rifiuto recente.</td></tr>'}</tbody>
      </table></div>`;
    el.dataset.ready = '1';
  }
  function renderRoutines(el, list) {
    if (!el) return;
    const now = Date.now();
    const rows = (list || []).map((r) => {
      let cls = 'missing';
      let act = r.missing ? 'nessun log ancora' : (r.lastActivityAt ? fmtRomeIso(r.lastActivityAt) : '—');
      if (!r.missing && r.lastActivityAt) {
        const ageH = (now - Date.parse(r.lastActivityAt)) / 3600000;
        // Soft stale only for intra-day jobs with a fresh expected cadence.
        const tight = r.id === 'copy-live' || r.id === 'meme-scan';
        if (tight && Number.isFinite(ageH) && ageH > 0.5) cls = 'stale';
        else cls = 'ok';
      }
      return `<tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.schedule)}</td>
        <td class="${cls}">${esc(act)}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `<h3>Routine desk</h3>
      <p class="hint">Orari fissi. Ultima attività da data dei file e ultime righe di log (copy-live.md, go.md, risk.md, ov-sweep.md, engines.md).</p>
      <div class="table-wrap"><table class="copy-routine-table">
        <thead><tr><th>Routine</th><th>Orario</th><th>Ultima attività</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="empty">Nessuna routine.</td></tr>'}</tbody>
      </table></div>`;
    el.dataset.ready = '1';
  }

  function fmtUsdCompact(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const sign = n < 0 ? '−' : '';
    const abs = Math.abs(Number(n));
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'm';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'k';
    return sign + '$' + abs.toLocaleString('it-IT', { maximumFractionDigits: 0 });
  }
  function copytopPills(items, toneDefault) {
    return (items || []).map((it) => {
      const label = typeof it === 'string' ? it : (it && it.label) || '';
      if (!label) return '';
      const tone = (typeof it === 'object' && it.tone) ? it.tone : (toneDefault || 'warn');
      const title = (typeof it === 'object' && it.detail) ? it.detail : label;
      return `<span class="copytop-pill ${esc(tone)}" title="${esc(title)}">${esc(label)}</span>`;
    }).join('');
  }
  function renderCopyTop(el, data) {
    if (!el) return;
    const d = data || { empty: true };
    const when = d.fetchedAtRome || fmtRomeIso(d.fetchedAt);
    const winT = (d.window && d.window.traders) || '30d';
    const winC = (d.window && d.window.coins) || '24h';
    const head = `<p class="copytop-kicker">sola lettura · fonte pubblica · non APPROVED</p>
      <h3>copy.top · sola lettura</h3>
      <p class="hint">${esc(d.notice || 'Classifica pubblica di discovery. HighKali non compra da questa lista in automatico. Nessun deposito e nessun collegamento del wallet.')}</p>
      <p class="hint">Aggiornato ${esc(when || '—')}${when && !String(when).includes('Europe/Rome') && !String(when).includes('CET') ? ' Europe/Rome' : ''} · trader ${esc(winT)} · monete ${esc(winC)}</p>`;
    if (d.empty || (!(d.traders || []).length && !(d.coins || []).length)) {
      el.innerHTML = head + '<p class="empty">nessun dato ancora</p>';
      el.dataset.ready = '1';
      return;
    }
    const traders = (d.traders || []).map((t) => {
      const flagged = (t.flags || []).some((f) => f && (f.tone === 'loss' || /flagged|sells into|flipper|vende/i.test(f.label || '')))
        || (t.warnings || []).some((w) => /vende|flipper|flagged/i.test(w));
      const warned = !flagged && ((t.warnings || []).length || (t.flags || []).length);
      const wr = t.winRate != null ? (t.winRate * 100).toFixed(1) + '%' : '—';
      const wrClass = (t.warnings || []).some((w) => /win rate/i.test(w)) ? 'neg' : '';
      const cpClass = (t.warnings || []).some((w) => /copiator/i.test(w)) ? 'neg' : '';
      const pnl = t.realizedUsd;
      const pnlClass = pnl == null ? '' : (pnl >= 0 ? 'pos' : 'neg');
      const pills = copytopPills(t.flags) + copytopPills((t.warnings || []).filter((w) => {
        const low = String(w).toLowerCase();
        return !(t.flags || []).some((f) => {
          const l = String(f.label || '').toLowerCase();
          if (low.includes('vende') && (l.includes('sells into') || l.includes('vende'))) return true;
          if (low.includes('flipper') && l.includes('flipper')) return true;
          return false;
        });
      }));
      const href = t.profileUrl || (t.profilePath ? 'https://copy.top' + t.profilePath : '');
      const name = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(t.name || t.handle)}</a>`
        : esc(t.name || t.handle);
      return `<tr class="${flagged ? 'flag-row' : (warned ? 'warn-row' : '')}">
        <td class="num">${t.rank != null ? esc(String(t.rank)) : '—'}</td>
        <td>${name}<div class="muted">${esc(t.handle || '')}</div></td>
        <td>${esc(t.source || '—')}</td>
        <td class="num ${pnlClass}">${esc(fmtUsdCompact(pnl))}</td>
        <td class="num ${wrClass}">${esc(wr)}</td>
        <td class="num">${t.closed != null ? esc(String(t.closed)) : '—'}</td>
        <td class="num ${cpClass}">${t.copiers != null ? esc(String(t.copiers)) : '—'}</td>
        <td><div class="copytop-flags">${pills || '—'}</div></td>
      </tr>`;
    }).join('');
    const coins = (d.coins || []).map((c) => {
      const href = c.tokenUrl || (c.tokenPath ? 'https://copy.top' + c.tokenPath : '');
      const tick = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">$${esc(c.symbol || '')}</a>`
        : '$' + esc(c.symbol || '');
      return `<tr>
        <td>${tick}</td>
        <td>${esc(c.chain || '—')}</td>
        <td><code title="${esc(c.token || '')}">${esc((c.token || '').length > 12 ? (c.token.slice(0, 4) + '…' + c.token.slice(-4)) : (c.token || '—'))}</code></td>
        <td class="num">${c.tradersBought != null ? esc(String(c.tradersBought)) : '—'}</td>
        <td class="num">${esc(fmtUsdCompact(c.totalUsd))}</td>
      </tr>`;
    }).join('');
    el.innerHTML = `${head}
      <h4>Classifica trader · realized PnL ${esc(winT)}</h4>
      <div class="table-wrap"><table class="copytop-table">
        <thead><tr>
          <th class="num">#</th><th>Trader</th><th>Fonte</th>
          <th class="num">PnL real.</th><th class="num">Win rate</th>
          <th class="num">Chiusi</th><th class="num">Copiatori</th><th>Avvisi</th>
        </tr></thead>
        <tbody>${traders || '<tr><td colspan="8" class="empty">nessun dato ancora</td></tr>'}</tbody>
      </table></div>
      <h4>Monete che i top trader stanno comprando · ${esc(winC)}</h4>
      <div class="table-wrap"><table class="copytop-table">
        <thead><tr>
          <th>Token</th><th>Chain</th><th>Mint</th>
          <th class="num">Trader</th><th class="num">Totale $</th>
        </tr></thead>
        <tbody>${coins || '<tr><td colspan="5" class="empty">nessun dato ancora</td></tr>'}</tbody>
      </table></div>
      <p class="hint">I flag «vende sui copiatori» e «flipper» arrivano dal fair play pubblico di copy.top. Un wallet entra in copy LIVE solo se è APPROVED e passa lo sniffer.</p>`;
    el.dataset.ready = '1';
  }
  async function loadCopyTop() {
    const el = $('#copy-top');
    try {
      const data = await api('/api/copytop');
      renderCopyTop(el, data);
      return data;
    } catch (e) {
      renderCopyTop(el, { empty: true, message: 'nessun dato ancora' });
      return null;
    }
  }

  async function loadCopy() {
    const data = await api('/api/copytrader');
    const st = data.scan || {};
    const live = data.live || {};
    if (!state.liveWallet) {
      try { state.liveWallet = await api('/api/wallet'); } catch { /* */ }
    }
    state.copyLive = live;
    renderCopyLive($('#copy-live'), live, state.liveWallet);
    renderCopyFeed($('#copy-feed'), data.feed || data.poll);
    renderWalletBook($('#copy-book'), data.walletBook);
    renderCopyRefusals($('#copy-refusals'), data.refusals || []);
    renderRoutines($('#copy-routines'), data.routines || []);
    loadCopyTop().catch(() => {});
    loadAntifake().catch(() => {});
    const approved = live.approvedCount != null ? live.approvedCount : 0;
    const scanNote = data.status === 'scanning' || data.status === 'refreshing'
      ? ('Scansione pubblica top holder… ' + (st.progress || ''))
      : ('Scansione pubblica aggiornata ' + (data.updatedAt ? new Date(data.updatedAt).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) + ' Europe/Rome' : ''));
    $('#copy-status').textContent = 'APPROVED ' + approved + ' · ' +
      (live.hasLiveFills ? ('book LIVE ' + (live.openCount || 0) + ' aperte / ' + (live.closedCount || 0) + ' chiuse') : 'nessun fill LIVE') +
      ' · ' + scanNote;
    if ((data.loggedNewBuys || 0) > (state.copyLogged || 0) && data.status !== 'scanning') {
      toast(`<b>Copy segnali:</b> ${data.loggedNewBuys} nuovi buy osservati in copy-signals.md (scansione pubblica, non è un fill LIVE)`);
      state.copyLogged = data.loggedNewBuys;
    }
    $('#copy-gainers').innerHTML = (data.gainers || []).map((g) =>
      `<span class="pill">${esc(g.symbol)} ${fmtPct(g.changeH6 != null ? g.changeH6 : g.changeH24)} · liq ${fmtUsd(g.liqUsd)}</span>`
    ).join('');
    const scanCards = (data.wallets || []).map((w) => {
      const s = w.stats || {};
      const wr = s.winRate != null ? (s.winRate * 100).toFixed(0) + '%' : 'n/d';
      const pnl = s.realizedUsd != null ? fmtUsd(s.realizedUsd) : (s.realizedSol != null ? s.realizedSol.toFixed(3) + ' SOL' : 'n/d');
      const rec = (w.recent || []).slice(0, 8).map((e) =>
        `<li><span class="${e.side === 'BUY' ? 'pos' : 'neg'}">${e.side}</span> ${esc(e.symbol || shortMint(e.mint))} · size ${e.size != null ? Number(e.size).toPrecision(4) : '—'} · ${e.priceUsd != null ? fmtPx(e.priceUsd) : 'n/d'}</li>`
      ).join('');
      return `<article class="card" style="cursor:default">
        <h3><a href="${w.solscan}" target="_blank" rel="noopener">${esc(shortMint(w.wallet))}</a>
          <small>${w.appearances || 0} gainer · non APPROVED</small></h3>
        <div class="kv">
          ${kv('Win rate (chiusi)', wr)}
          ${kv('PnL realizzato est.', pnl)}
          ${kv('Trade chiusi', (s.closed ?? 0) + ' (W' + (s.wins ?? 0) + '/L' + (s.losses ?? 0) + ')')}
          ${kv('Tx analizzate', w.parsedTx ?? 0)}
        </div>
        <ul class="tx-list">${rec || '<li class="muted">Nessun buy/sell recente nel campione.</li>'}</ul>
      </article>`;
    }).join('');
    const emptyScan = data.status === 'scanning'
      ? '<p class="empty">Scansione RPC in corso (1–2 min)…</p>'
      : '<p class="empty">Nessun wallet in questa scansione pubblica. Il copy LIVE usa solo gli APPROVED (oggi 0).</p>';
    $('#copy-wallets').innerHTML = '<p class="hint">Sotto: scansione pubblica dei top holder (stime RPC). <strong>Non è la lista APPROVED</strong> e non viene copiata in LIVE.</p>' + (scanCards || emptyScan);
    if (data.status !== 'scanning') $('#copy-wallets').dataset.ready = '1';
  }


  function fmtUsdFull(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return '$' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtSolQty(n, d = 4) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function prefersReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function animateNum(el, to, fmt, ms) {
    if (!el) return;
    const duration = ms == null ? 700 : ms;
    const from = el.dataset.val != null && el.dataset.val !== '' ? Number(el.dataset.val) : to;
    el.dataset.val = String(to == null ? '' : to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || prefersReduced() || from === to) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    function frame(t) {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function sparkSvg(points, w, h, gid) {
    const width = w || 280, height = h || 56;
    const id = gid || ('sparkFill-' + Math.random().toString(36).slice(2, 8));
    const pts = (points || []).filter((p) => p && Number.isFinite(p.usd));
    if (!pts.length) {
      return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>`;
    }
    if (pts.length === 1) pts.push({ ...pts[0] });
    const ys = pts.map((p) => p.usd);
    const min = Math.min(...ys), max = Math.max(...ys);
    const span = max - min || 1;
    const pad = 3;
    const coords = pts.map((p, i, arr) => {
      const x = pad + (i / Math.max(1, arr.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (p.usd - min) / span) * (height - pad * 2);
      return [x, y];
    });
    const d = coords.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
    const last = coords[coords.length - 1];
    const first = coords[0];
    const area = d + ' L' + last[0].toFixed(1) + ' ' + height + ' L' + first[0].toFixed(1) + ' ' + height + ' Z';
    const up = pts[pts.length - 1].usd >= pts[0].usd;
    const color = up ? '#4ade80' : '#f87171';
    return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path class="area" d="${area}" fill="url(#${id})"/>
      <path class="line" d="${d}" style="stroke:${color}"/>
    </svg>`;
  }
  function shortRome(s) {
    if (!s) return '—';
    const m = String(s).match(/(\d{2}:\d{2})(?::\d{2})?/);
    return m ? m[1] : String(s).replace(' Europe/Rome', '');
  }
  function holdRows(balances) {
    return (balances || []).map((b) => {
      const held = !!(b.held || b.notForSale || (b.mint && b.mint === '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump'));
      const tag = held ? '<span class="held-tag" title="token del progetto · tenuto, non in vendita">tenuto</span>' : '';
      return `<div class="hold-row"${b.mint && b.mint !== 'SOL' ? ` data-mint="${esc(b.mint)}"` : ''}>
        <span class="sym">${esc(b.symbol || shortMint(b.mint))}${tag}</span>
        <span class="qty">${b.native || b.symbol === 'SOL' ? fmtSolQty(b.amount) : Number(b.amount).toLocaleString('it-IT', { maximumFractionDigits: 4 })}</span>
        <span class="val">${fmtUsd(b.valueUsd)}</span>
      </div>`;
    }).join('') || '<p class="muted">Nessun holding visibile.</p>';
  }
  function txItems(transactions, newSigs) {
    return (transactions || []).map((t) => {
      const fresh = newSigs && t.signature && newSigs.has(t.signature);
      const typ = (t.type || 'TX').toUpperCase();
      const when = shortRome(t.timeRome);
      const label = (t.label || typ).replace(/^[A-Z]+ · /, '');
      return `<li class="${fresh ? 'tx-in' : ''}" title="${esc(t.timeRome || '')}">
        <span class="when">${esc(when)}</span>
        <span class="what"><span class="tx-type ${typ}">${esc(typ)}</span>${esc(label)}</span>
        ${t.solscan ? `<a href="${esc(t.solscan)}" target="_blank" rel="noopener">Solscan</a>` : '<span></span>'}
      </li>`;
    }).join('') || '<li class="muted">Nessun movimento recente.</li>';
  }
  function renderLivePanel(el, data, opt) {
    if (!el || !data) return;
    const opts = opt || {};
    const prev = opts.from;
    const flash = opts.flash || '';
    const newSigs = opts.newSigs;
    const first = !el.dataset.ready;
    const delta = prev && prev.totalUsd != null && data.totalUsd != null
      ? data.totalUsd - prev.totalUsd : null;
    const deltaHtml = delta == null || Math.abs(delta) < 0.005 ? ''
      : `<span class="live-delta ${delta > 0 ? 'pos' : 'neg'}">${delta > 0 ? '+' : '−'}${fmtUsdFull(Math.abs(delta))}</span>`;
    const href = 'https://solscan.io/account/' + encodeURIComponent(data.address);
    el.innerHTML = `
      <div class="live-head">
        <div class="live-totals">
          <p class="eyebrow"><span class="signal"></span> WALLET AGENTE · LIVE · SOLA LETTURA</p>
          <div class="live-usd" data-val="">—</div>
          <div class="live-sol" data-val="">—</div>
          ${deltaHtml}
        </div>
        <div class="live-meta">
          <a class="addr" href="${href}" target="_blank" rel="noopener" title="${esc(data.address)}">${esc(data.address)}</a>
          <div class="hint">${esc(data.updatedRome || '—')}</div>
          <div class="spark-box" aria-hidden="true">${sparkSvg(data.spark, 280, 56, 'sf-' + el.id)}</div>
        </div>
      </div>
      ${data.policy ? `<div class="live-policy">
        <span class="mark-floor">Floor ${fmtUsdFull(data.policy.floorUsd)} su SOL+USDC</span>
        <span class="mark-budget">Budget copy ${fmtUsdFull(data.policy.budgetUsd)} / ${fmtUsdFull(data.policy.budgetMaxUsd)}</span>
        <span>Tradabile ${fmtUsdFull(data.policy.tradableUsd)}</span>
        ${data.policy.ovHeld ? `<span class="mark-ov">$OV tenuto · non in vendita${data.policy.ovValueUsd != null ? ' · ' + fmtUsdFull(data.policy.ovValueUsd) : ''}</span>` : ''}
      </div>` : ''}
      <div class="live-grid">
        <div class="live-holdings">
          <h3>Holding</h3>
          ${holdRows(data.balances)}
        </div>
        <div class="live-txs">
          <h3>Movimenti recenti</h3>
          <ul class="tx-feed">${txItems(data.transactions, first ? null : newSigs)}</ul>
        </div>
      </div>`;
    const usdEl = el.querySelector('.live-usd');
    const solEl = el.querySelector('.live-sol');
    const fromUsd = prev && Number.isFinite(prev.totalUsd) ? prev.totalUsd : data.totalUsd;
    const fromSol = prev && Number.isFinite(prev.sol) ? prev.sol : data.sol;
    if (usdEl) {
      usdEl.dataset.val = String(fromUsd ?? '');
      animateNum(usdEl, data.totalUsd, fmtUsdFull);
    }
    if (solEl) {
      solEl.dataset.val = String(fromSol ?? '');
      animateNum(solEl, data.sol, (n) => fmtSolQty(n) + ' SOL' + (data.solValueUsd != null ? ' · ' + fmtUsdFull(data.solValueUsd) : ''));
    }
    el.classList.remove('flash-up', 'flash-down');
    if (flash === 'up') { void el.offsetWidth; el.classList.add('flash-up'); }
    if (flash === 'down') { void el.offsetWidth; el.classList.add('flash-down'); }
    el.dataset.ready = '1';
  }
  function updateWalletChip(data, flash) {
    const el = $('#wallet-chip');
    if (!el || !data) return;
    const usd = fmtUsdFull(data.totalUsd);
    const sol = data.sol != null ? fmtSolQty(data.sol, 3) + ' SOL' : '';
    el.innerHTML = `<span>${usd}</span>${sol ? `<span class="muted">· ${sol}</span>` : ''}
      <span class="chip-spark">${sparkSvg((data.spark || []).slice(-24), 52, 16, 'chip-spark')}</span>`;
    el.className = 'wallet-chip ' + (flash === 'up' ? 'up' : flash === 'down' ? 'down' : 'ok');
    el.title = 'Wallet agente · ' + (data.updatedRome || '');
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('click', () => showTab('wallet'));
    }
  }
  async function loadLiveWallet() {
    try {
      const data = await api('/api/wallet');
      const prev = state.liveWallet;
      const flowChanged = !!(prev && prev.holdingsKey && data.holdingsKey && prev.holdingsKey !== data.holdingsKey);
      const newSigs = new Set();
      if (prev && prev.transactions) {
        const old = new Set((prev.transactions || []).map((x) => x.signature));
        for (const tx of data.transactions || []) {
          if (tx.signature && !old.has(tx.signature)) newSigs.add(tx.signature);
        }
      }
      state.liveWalletPrev = prev;
      state.liveWallet = data;
      const flash = flowChanged
        ? ((data.totalUsd || 0) >= (prev.totalUsd || 0) ? 'up' : 'down')
        : '';
      renderLivePanel($('#desk-live'), data, { flash, newSigs, from: prev });
      renderLivePanel($('#wallet-live'), data, { flash, newSigs, from: prev });
      updateWalletChip(data, flash);
      if ($('#copy-live') && $('#copy-live').dataset.ready === '1' && state.copyLive) {
        renderCopyLive($('#copy-live'), state.copyLive, data);
      }
      return data;
    } catch (e) {
      const el = $('#desk-live');
      if (el && el.dataset.ready !== '1') {
        el.innerHTML = '<p class="muted">Saldo non disponibile: ' + esc(e.message) + '</p>';
      }
      const chip = $('#wallet-chip');
      if (chip && !state.liveWallet) {
        chip.className = 'wallet-chip na';
        chip.textContent = 'SALDO · n/d';
      }
      return null;
    }
  }

  async function loadWallet(addr) {
    const box = $('#wallet-box');
    box.innerHTML = '<p class="muted">Lettura RPC…</p>';
    try {
      const data = await api('/api/wallet/' + encodeURIComponent(addr));
      const toks = (data.balances || []).map((b) =>
        `<tr data-mint="${esc(b.mint)}"><td class="left">${esc(b.symbol || shortMint(b.mint))}<div class="muted">${esc(shortMint(b.mint))}</div></td>
          <td>${Number(b.amount).toLocaleString('it-IT', { maximumFractionDigits: 4 })}</td>
          <td>${fmtPx(b.priceUsd)}</td><td>${fmtUsd(b.valueUsd)}</td></tr>`
      ).join('');
      const txs = (data.transactions || []).map((t) =>
        `<li>${t.err ? '<span class="neg">ERR</span>' : '<span class="pos">ok</span>'}
          <a href="${t.solscan}" target="_blank" rel="noopener">${esc(t.signature.slice(0, 8))}…</a>
          · ${t.blockTime ? new Date(t.blockTime * 1000).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) + ' Europe/Rome' : '—'}</li>`
      ).join('');
      box.innerHTML = `
        <div class="card" style="cursor:default">
          <h3>SOL <small>${esc(data.address)}</small></h3>
          <p><strong>${data.sol.toFixed(4)} SOL</strong> ${data.solValueUsd != null ? '· ' + fmtUsd(data.solValueUsd) : ''}</p>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table class="pairs" style="min-width:0">
            <thead><tr><th class="left">Token</th><th>Quantità</th><th>Prezzo</th><th>Valore</th></tr></thead>
            <tbody>${toks || '<tr><td colspan="4" class="empty">Nessun saldo SPL visibile.</td></tr>'}</tbody>
          </table>
        </div>
        <h3 style="padding:12px 8px 0">Transazioni recenti</h3>
        <ul class="tx-list">${txs || '<li>Nessuna firma recente.</li>'}</ul>`;
      box.dataset.ready = '1';
    } catch (e) {
      box.innerHTML = '<p class="risk-danger">' + esc(e.message) + '</p>';
    }
  }

  // ---------- ZDOS Radar (sola lettura) ----------
  state.radarSub = 'x';
  const RADAR_LABEL = { da_seguire: 'DA SEGUIRE', da_osservare: 'DA OSSERVARE', evitare: 'EVITARE' };
  const RADAR_CLS = { da_seguire: 'ok', da_osservare: 'warn', evitare: 'bad', 'NESSUN RED FLAG': 'ok', OSSERVARE: 'warn', EVITARE: 'bad', 'N/D': 'na' };
  const CHECK_ICON = { ok: '✓', warn: '!', fail: '✕', nd: '·' };
  function rPill(text, cls) { return '<span class="rpill ' + (cls || 'na') + '">' + esc(text) + '</span>'; }
  function rWhen(iso) { return iso ? esc(fmtRomeIso(iso)) : '—'; }
  function rExample(flag) { return flag ? '<p class="banner warn"><strong>ESEMPIO</strong> — dati dimostrativi, non reali. Il file vero lo scrive l\'agente Radar.</p>' : ''; }

  function renderRadarX(el, x) {
    if (!x || !x.ok) {
      el.innerHTML = '<p class="hint">Nessun file <code>' + esc((x && x.file) || 'radar-x.json') + '</code> nel desk (' + esc((x && x.error) || 'assente') + '). Lo scrive l\'agente Radar: zdesk non chiama X.</p>';
      return;
    }
    const c = x.counts || {};
    let h = rExample(x.example);
    h += '<p class="hint">Aggiornato ' + rWhen(x.generatedAt || x.mtime) + ' · ' + rPill('da seguire ' + (c.da_seguire || 0), 'ok') + ' ' + rPill('da osservare ' + (c.da_osservare || 0), 'warn') + ' ' + rPill('evitare ' + (c.evitare || 0), 'bad') + (x.dropped ? ' · ' + x.dropped + ' righe scartate (formato non valido)' : '') + '</p>';
    h += '<div class="table-wrap terminal-panel"><table class="pairs radar-tbl"><thead><tr><th>Account</th><th>Esito</th><th>Score</th><th>Età</th><th>Follower</th><th>Engagement</th><th>Shill a buon fine</th><th>Wallet</th><th>Motivi</th></tr></thead><tbody>';
    for (const a of x.accounts || []) {
      const s = a.signals || {};
      h += '<tr><td>' + (x.example ? '@' + esc(a.handle) : '<a href="https://x.com/' + encodeURIComponent(a.handle) + '" target="_blank" rel="noopener noreferrer">@' + esc(a.handle) + '</a>') + (s.verified ? ' <span class="micro">verificato</span>' : '') + '</td>'
        + '<td>' + rPill(RADAR_LABEL[a.label] || a.label, RADAR_CLS[a.label]) + '</td>'
        + '<td class="num">' + esc(a.score) + '/100</td>'
        + '<td class="num">' + (s.accountAgeDays != null ? esc(Math.round(s.accountAgeDays)) + ' g' : 'n/d') + '</td>'
        + '<td class="num">' + (s.followers != null ? esc(Number(s.followers).toLocaleString('it-IT')) : 'n/d') + '</td>'
        + '<td class="num">' + (s.engagementRate != null ? esc((s.engagementRate * 100).toFixed(2)) + '%' : 'n/d') + '</td>'
        + '<td class="num">' + (s.shillHitRate != null ? esc(Math.round(s.shillHitRate * 100)) + '% (' + (a.shilled || []).length + ')' : 'n/d') + '</td>'
        + '<td>' + esc(String(s.walletProof || 'n/d').replace('_', ' ')) + '</td>'
        + '<td class="radar-reasons">' + esc((a.reasons || []).join(' · ')) + '</td></tr>';
    }
    h += '</tbody></table></div>';
    el.innerHTML = h;
  }

  function renderRadarKira(el, k) {
    if (!k) { el.innerHTML = ''; return; }
    if (!k.items || !k.items.length) {
      el.innerHTML = '<p class="hint">' + (k.running ? 'Controlli K.I.R.A. in corso (un token ogni ~1 s, massimo ' + esc(k.maxTokens) + ')…' : 'Nessun token da controllare.') + '</p>';
      return;
    }
    let h = '<p class="hint">Ultimo giro ' + rWhen(k.finishedAt) + (k.running ? ' · aggiornamento in corso' : '') + ' · cache ' + esc(Math.round(k.ttlSec / 60)) + ' min · fonti DexScreener, RugCheck, RPC Solana.</p><div class="cards radar-cards">';
    for (const it of k.items) {
      h += '<article class="card terminal-panel" data-mint="' + esc(it.mint) + '"><header class="radar-card-head"><strong>' + esc(it.symbol) + '</strong> ' + rPill(it.verdict, RADAR_CLS[it.verdict]) + '<span class="micro"> ' + esc(it.from || '') + '</span></header>'
        + '<p class="micro"><code>' + esc(it.mint.slice(0, 6) + '…' + it.mint.slice(-4)) + '</code>' + (it.liqUsd != null ? ' · liq ' + esc(fmtUsd(it.liqUsd, 0)) : '') + (it.dexId ? ' · ' + esc(it.dexId) : '') + '</p>';
      if (it.error) h += '<p class="risk-danger">' + esc(it.error) + '</p>';
      h += '<ul class="radar-checks">';
      for (const c of it.checks || []) {
        h += '<li class="rc-' + esc(c.status) + '"><span class="rc-ico">' + (CHECK_ICON[c.status] || '·') + '</span> ' + esc(c.label) + ' <span class="micro">' + esc(c.detail || '') + '</span></li>';
      }
      h += '</ul><p class="micro"><a href="' + esc(it.links.dexscreener) + '" target="_blank" rel="noopener noreferrer">DexScreener</a> · <a href="' + esc(it.links.rugcheck) + '" target="_blank" rel="noopener noreferrer">RugCheck</a> · <a href="' + esc(it.links.solscan) + '" target="_blank" rel="noopener noreferrer">Solscan</a></p></article>';
    }
    el.innerHTML = h + '</div>';
  }

  function renderRadarNews(el, n) {
    if (!n) { el.innerHTML = ''; return; }
    let h = rExample(n.example);
    h += '<h3 class="radar-h">Dall\'agente Radar</h3>';
    if (!n.ok) h += '<p class="hint">Nessun file <code>' + esc(n.file) + '</code> (' + esc(n.error || 'assente') + ').</p>';
    else if (!n.items.length) h += '<p class="hint">Nessuna notizia nel file.</p>';
    else {
      h += '<ul class="radar-news">';
      for (const it of n.items) {
        h += '<li><span class="micro">' + rWhen(it.at) + ' · ' + esc(it.kind || 'nota') + '</span><br><strong>' + esc(it.title) + '</strong>' + (it.detail ? '<br><span class="micro">' + esc(it.detail) + '</span>' : '') + (it.source && /^https:\/\//.test(it.source) ? ' <a href="' + esc(it.source) + '" target="_blank" rel="noopener noreferrer">fonte</a>' : '') + '</li>';
      }
      h += '</ul>';
    }
    h += '<h3 class="radar-h">Pair giovani e veloci (meno di 3 h, vol 1h ≥ $' + esc(Math.round((n.fastMinVolH1 || 10000) / 1000)) + 'k)</h3>';
    if (!n.fastPairs || !n.fastPairs.length) h += '<p class="hint">Nessuna nella cache attuale' + (n.fastPairsUpdatedAt ? ' (' + rWhen(n.fastPairsUpdatedAt) + ')' : '') + '.</p>';
    else {
      h += '<div class="table-wrap terminal-panel"><table class="pairs"><thead><tr><th>Token</th><th>Età</th><th>Vol 1h</th><th>Liq</th><th>Δ1h</th></tr></thead><tbody>';
      for (const p of n.fastPairs) {
        h += '<tr data-mint="' + esc(p.mint) + '"><td><a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.symbol || '?') + '</a></td><td class="num">' + esc(p.ageMin) + ' min</td><td class="num">' + esc(fmtUsd(p.volH1, 0)) + '</td><td class="num">' + esc(fmtUsd(p.liqUsd, 0)) + '</td><td class="num">' + esc(fmtPct(p.changeH1)) + '</td></tr>';
      }
      h += '</tbody></table></div><p class="micro">Velocità, non qualità: passa sempre da K.I.R.A. prima di fidarti.</p>';
    }
    if (n.antifake) h += '<p class="micro">Ultimo verdetto sniffer: ' + rPill(n.antifake.verdict, n.antifake.verdict === 'OK' ? 'ok' : 'bad') + ' ' + esc(n.antifake.symbol || '') + ' · ' + rWhen(n.antifake.at) + '</p>';
    el.innerHTML = h;
  }

  function renderRadarWatch(el, w) {
    if (!w) { el.innerHTML = ''; return; }
    let h = rExample(w.example);
    h += '<p class="hint">Token controllati da K.I.R.A. (massimo 12): da <code>radar-watch.json</code>, watchlist desk e survivors.</p><div class="table-wrap terminal-panel"><table class="pairs"><thead><tr><th>Token</th><th>Mint</th><th>Origine</th><th>Nota</th></tr></thead><tbody>';
    for (const t of w.tracked || []) {
      h += '<tr data-mint="' + esc(t.mint) + '"><td>' + esc(t.symbol || '?') + '</td><td><code>' + esc(t.mint) + '</code></td><td>' + esc(t.from || '') + '</td><td>' + esc(t.note || '') + '</td></tr>';
    }
    h += '</tbody></table></div>';
    h += '<h3 class="radar-h">Account X seguiti</h3>';
    if (!w.handles || !w.handles.length) h += '<p class="hint">Nessun account in <code>radar-watch.json</code>' + (w.ok ? '' : ' (' + esc(w.error || 'file assente') + ')') + '.</p>';
    else h += '<p>' + w.handles.map((x) => '<a href="https://x.com/' + encodeURIComponent(x) + '" target="_blank" rel="noopener noreferrer">@' + esc(x) + '</a>').join(' · ') + '</p>';
    el.innerHTML = h;
  }


  /* ---------- Radar · Connetti app (X, GitHub, Phantom: sola lettura) ---------- */
  const LS_X = 'zdesk.connect.x';
  const LS_WALLET = 'zdesk.connect.phantom';
  const SOL_B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage off */ } }
  function phantomProvider() {
    const p = window.phantom && window.phantom.solana;
    if (p && p.isPhantom) return p;
    if (window.solana && window.solana.isPhantom) return window.solana;
    return null;
  }
  function sol(lamports) { return (Number(lamports || 0) / 1e9).toLocaleString('it-IT', { maximumFractionDigits: 4 }); }
  function short(a) { return a ? esc(a.slice(0, 4) + '…' + a.slice(-4)) : ''; }
  function ext(url, label) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>'; }

  async function renderConnect(el) {
    const x = lsGet(LS_X);
    const w = lsGet(LS_WALLET);
    const prov = phantomProvider();
    let h = '<p class="hint">Tre collegamenti, tutti in sola lettura. zdesk non pubblica su X, non scrive su GitHub e non chiede a Phantom firme o transazioni.</p><div class="cards radar-cards">';
    h += '<article class="card terminal-panel"><header class="radar-card-head"><strong>X</strong></header>'
      + '<p class="micro">Profilo pubblico da seguire. Nessun post dall\'app.</p>'
      + '<p><input id="cx-handle" type="text" maxlength="16" placeholder="@handle" value="' + esc(x ? '@' + x : '') + '"> <button type="button" id="cx-save">Salva</button></p>'
      + (x ? '<p>' + ext('https://x.com/' + encodeURIComponent(x), '@' + x) + '</p>' : '') + '</article>';
    h += '<article class="card terminal-panel" id="cx-github"><header class="radar-card-head"><strong>GitHub</strong></header><p class="micro">Stato pubblico dell\'organizzazione, in lettura.</p><p class="hint">Caricamento…</p></article>';
    h += '<article class="card terminal-panel"><header class="radar-card-head"><strong>Phantom Wallet</strong></header>'
      + '<p class="micro">Solo l\'indirizzo pubblico. Nessuna firma, nessuno swap, nessun fondo.</p>';
    if (w) {
      h += '<p>Collegato: <code>' + esc(w) + '</code></p><p><button type="button" id="cx-off">Disconnetti</button></p>';
    } else if (prov) {
      h += '<p><button type="button" id="cx-on">Connetti Phantom</button></p>';
    } else {
      h += '<p class="hint">Phantom non è presente in questo browser. Sul telefono apri zdesk dal browser interno di Phantom: '
        + ext('https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin), 'apri in Phantom') + '.</p>';
    }
    h += '<p class="micro">Oppure incolla un indirizzo pubblico:</p><p><input id="cx-addr" type="text" maxlength="44" placeholder="indirizzo Solana"> <button type="button" id="cx-addr-save">Usa</button></p></article>';
    h += '</div>';
    el.innerHTML = h;

    const save = $('#cx-save', el);
    if (save) save.addEventListener('click', () => {
      const v = String($('#cx-handle', el).value || '').trim().replace(/^@/, '');
      lsSet(LS_X, /^[A-Za-z0-9_]{1,15}$/.test(v) ? v : '');
      renderConnect(el);
    });
    const on = $('#cx-on', el);
    if (on) on.addEventListener('click', async () => {
      try {
        const r = await prov.connect();
        const addr = r && r.publicKey ? r.publicKey.toString() : '';
        if (SOL_B58.test(addr)) lsSet(LS_WALLET, addr);
      } catch (e) { /* utente ha annullato */ }
      renderConnect(el);
    });
    const off = $('#cx-off', el);
    if (off) off.addEventListener('click', async () => {
      lsSet(LS_WALLET, '');
      try { if (prov && prov.disconnect) await prov.disconnect(); } catch { /* ignora */ }
      renderConnect(el);
    });
    const use = $('#cx-addr-save', el);
    if (use) use.addEventListener('click', () => {
      const v = String($('#cx-addr', el).value || '').trim();
      if (SOL_B58.test(v)) { lsSet(LS_WALLET, v); renderConnect(el); }
    });

    try {
      const d = await api('/api/connect');
      const g = d.github || {};
      const box = $('#cx-github', el);
      if (box) box.innerHTML = '<header class="radar-card-head"><strong>GitHub</strong></header><p class="micro">Stato pubblico dell\'organizzazione, in lettura.</p>'
        + '<p>' + ext(g.orgUrl, g.org) + (g.publicRepos != null ? ' · ' + esc(g.publicRepos) + ' repo pubblici' : '') + '</p>'
        + '<p>' + ext(g.repoUrl, g.org + '/' + g.repo) + ' · privato, si apre solo con accesso</p>'
        + (g.error ? '<p class="hint">Stato GitHub non disponibile ora (limite API pubblica); i link funzionano.</p>' : '');
    } catch (e) { /* resta il segnaposto */ }
  }

  /* ---------- Radar · Staking (non custodial, sola lettura) ---------- */
  const STAKING_GUIDE = [
    ['Apri Phantom', 'Nella schermata principale tocca Solana (SOL).'],
    ['Avvia lo staking', 'Tocca «Stake» (o «Inizia a guadagnare SOL») e scegli lo staking nativo.'],
    ['Scegli un validator', 'Preferisci un validator con commissione bassa, buona uptime e non tra i più grandi: aiuta la decentralizzazione.'],
    ['Inserisci l\'importo', 'Lascia almeno 0,01–0,05 SOL liberi per le commissioni di rete.'],
    ['Conferma in Phantom', 'La firma avviene solo dentro Phantom. Lo stake si attiva all\'inizio dell\'epoca successiva (circa 2 giorni).'],
    ['Controlla qui', 'Questa sezione mostra conto di stake, validator, stato e ricompense, in sola lettura.'],
    ['Per ritirare', 'In Phantom: «Unstake». Dopo la fine dell\'epoca i SOL tornano prelevabili.'],
  ];

  async function renderStaking(el) {
    const w = lsGet(LS_WALLET);
    let h = '<p class="banner info"><strong>Staking · non custodial.</strong> zdesk legge soltanto dati pubblici della blockchain. Nessuna chiave, nessuna firma, nessun deposito in wallet dell\'app.</p>';
    if (!w) {
      h += '<p class="hint">Collega l\'indirizzo pubblico in «Connetti app» per vedere i tuoi stake.</p>';
    } else {
      h += '<p class="hint">Indirizzo <code>' + esc(w) + '</code> · caricamento…</p>';
    }
    el.innerHTML = h + stakingStatic();
    if (!w) return;
    try {
      const d = await api('/api/staking/' + encodeURIComponent(w));
      let b = '<p class="hint">Indirizzo <code>' + esc(w) + '</code> · epoca ' + esc(d.epoch) + ' · saldo ' + sol(d.solLamports) + ' SOL · dati in cache 5 min.</p>';
      b += '<h3 class="radar-h">Stake nativi</h3>';
      if (d.stakeError) b += '<p class="hint">' + esc(d.stakeError) + ' Intanto puoi vederli su ' + ext('https://solscan.io/account/' + encodeURIComponent(w) + '#stakeAccounts', 'Solscan') + ' (sola lettura).</p>';
      else if (!d.stakes.length) b += '<p class="hint">Nessun conto di stake nativo per questo indirizzo.</p>';
      else {
        const rw = new Map(((d.rewards && d.rewards.items) || []).map((r) => [r.address, r]));
        b += '<div class="table-wrap terminal-panel"><table class="pairs"><thead><tr><th>Conto</th><th>Validator</th><th>Stato</th><th>Delegati (SOL)</th><th>Ricompensa ep. ' + esc(d.rewards ? d.rewards.epoch : '–') + '</th></tr></thead><tbody>';
        for (const s of d.stakes) {
          const r = rw.get(s.address);
          b += '<tr><td>' + ext('https://solscan.io/account/' + s.address, short(s.address)) + '</td><td>' + (s.validator ? ext('https://solscan.io/account/' + s.validator, short(s.validator)) : '–') + '</td><td>' + esc(s.state) + '</td><td>' + sol(s.delegatedLamports) + '</td><td>' + (r && r.lamports != null ? sol(r.lamports) + ' SOL' : '–') + '</td></tr>';
        }
        b += '</tbody></table></div>';
        if (d.rewardsError) b += '<p class="hint">Ricompense non disponibili: ' + esc(d.rewardsError) + '</p>';
      }
      b += '<h3 class="radar-h">Liquid staking (saldi token)</h3>';
      if (d.lstError) b += '<p class="hint">Saldi non disponibili: ' + esc(d.lstError) + '</p>';
      else {
        b += '<div class="table-wrap terminal-panel"><table class="pairs"><thead><tr><th>Token</th><th>Saldo</th><th>Mint</th><th>Fonte ufficiale</th></tr></thead><tbody>';
        for (const t of d.lst) b += '<tr><td>' + esc(t.symbol) + ' <span class="micro">' + esc(t.name) + '</span></td><td>' + esc(t.amount) + '</td><td><code>' + short(t.mint) + '</code></td><td>' + ext(t.source, 'documentazione') + '</td></tr>';
        b += '</tbody></table></div>';
      }
      el.innerHTML = h.replace(/<p class="hint">Indirizzo[\s\S]*$/, '') + b + stakingStatic();
    } catch (e) {
      el.innerHTML = h.replace(/caricamento…/, 'errore: ' + esc(e.message)) + stakingStatic();
    }
  }

  function stakingStatic() {
    let s = '<h3 class="radar-h">Come fare staking di SOL in Phantom</h3><ol class="radar-news">';
    for (const [t, d] of STAKING_GUIDE) s += '<li><strong>' + esc(t) + '.</strong> ' + esc(d) + '</li>';
    s += '</ol>';
    s += '<h3 class="radar-h">$DSN e VELVET</h3><p class="hint">Staking a punti, nessun rendimento. Solo progetto: non è attivo e non promette guadagni.</p>';
    return s;
  }

  function showRadarSub(sub) {
    state.radarSub = sub;
    $$('#radar-sub button').forEach((b) => b.classList.toggle('on', b.dataset.rsub === sub));
    $$('.radar-pane').forEach((p) => p.classList.toggle('on', p.dataset.rpane === sub));
    if (sub === 'connect') renderConnect($('#radar-connect')).catch(() => {});
    if (sub === 'staking') renderStaking($('#radar-staking')).catch(() => {});
  }
  $$('#radar-sub button').forEach((b) => b.addEventListener('click', () => showRadarSub(b.dataset.rsub)));

  let radarTimer = null;
  async function loadRadar() {
    const st = $('#radar-status');
    try {
      const d = await api('/api/radar');
      renderRadarX($('#radar-x'), d.x);
      renderRadarKira($('#radar-kira'), d.kira);
      renderRadarNews($('#radar-news'), d.news);
      renderRadarWatch($('#radar-watch'), d.watch);
      if (st) st.textContent = 'Sola lettura · ' + romeNow() + (d.kira && d.kira.running ? ' · K.I.R.A. in calcolo' : '');
      clearTimeout(radarTimer);
      if (d.kira && d.kira.running && state.tab === 'radar') radarTimer = setTimeout(() => loadRadar().catch(() => {}), 6000);
    } catch (e) {
      if (st) st.textContent = 'Radar non disponibile: ' + e.message;
    }
  }

  function showTab(tab) {
    state.tab = tab;
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $$('.view').forEach((v) => v.classList.toggle('on', v.dataset.view === tab));
    const tableTabs = tab === 'trending' || tab === 'new';
    $('#table-toolbar').style.display = tableTabs ? 'flex' : 'none';
    const url = new URL(location.href);
    url.searchParams.set('tab', tab);
    history.replaceState(null, '', url);
    if (tab === 'watchlist') loadWatchlist().catch(console.error);
    if (tab === 'xstocks') loadXstocks().catch(console.error);
    if (tab === 'desk') loadDesk().catch(console.error);
    if (tab === 'copytrader') loadCopy().catch(console.error);
    if (tab === 'ninja') loadNinja().catch(console.error);
    if (tab === 'radar') loadRadar().catch(console.error);
    loadAntifake().catch(() => {});
    if (tab === 'trending') renderTable('tbl-trending', state.pairs.trending, 'trending');
    if (tab === 'new') renderTable('tbl-new', state.pairs.new, 'new');
    if (tab === 'trending' || tab === 'wallet') loadLiveWallet().catch(console.error);
  }

  $$('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#q').addEventListener('input', () => {
    state.q = $('#q').value;
    if (state.tab === 'trending' || state.tab === 'new') {
      renderTable(state.tab === 'new' ? 'tbl-new' : 'tbl-trending', state.pairs[state.tab === 'new' ? 'new' : 'trending'], state.tab === 'new' ? 'new' : 'trending');
    }
  });
  function rerenderList() {
    if (state.tab === 'trending' || state.tab === 'new') {
      renderTable(state.tab === 'new' ? 'tbl-new' : 'tbl-trending', state.pairs[state.tab === 'new' ? 'new' : 'trending'], state.tab === 'new' ? 'new' : 'trending');
    }
  }
  $('#minliq').addEventListener('change', () => { state.minLiq = Number($('#minliq').value); rerenderList(); });
  $('#minscore').addEventListener('change', () => { state.minScore = Number($('#minscore').value); rerenderList(); });
  document.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-k]');
    if (th) {
      const k = th.dataset.k;
      if (state.sort.key === k) state.sort.dir *= -1;
      else { state.sort.key = k; state.sort.dir = k === 'symbol' ? 1 : -1; }
      rerenderList();
      return;
    }
    const tr = e.target.closest('tr[data-mint], article.card[data-mint]');
    if (tr && tr.dataset.mint && !e.target.closest('a')) openToken(tr.dataset.mint, tr.dataset.pair);
  });
  $('#d-close').addEventListener('click', () => { $('#drawer').hidden = true; destroyChart(); });
  $('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') { $('#drawer').hidden = true; destroyChart(); } });
  $('#tf-btns').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tf]');
    if (!b) return;
    $$('#tf-btns button').forEach((x) => x.classList.toggle('on', x === b));
    state.chartTf = { tf: b.dataset.tf, agg: Number(b.dataset.agg) };
    if (state.chartPair) renderChart(state.chartPair);
  });

  $('#wallet-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const addr = $('#wallet-addr').value.trim();
    if (!addr) return;
    if (addr === state.deskWallet) {
      $('#wallet-box').innerHTML = '';
      loadLiveWallet().catch(console.error);
      return;
    }
    loadWallet(addr);
  });
  $('#wallet-addr').placeholder = state.deskWallet;

  async function refreshAll() {
    await Promise.all([
      loadPairs('trending').catch(console.error),
      loadPairs('new').catch(console.error),
      refreshHealth(),
    ]);
    if (state.tab === 'watchlist') await loadWatchlist().catch(console.error);
    if (state.tab === 'xstocks') await loadXstocks().catch(console.error);
    if (state.tab === 'desk') await loadDesk().catch(console.error);
    if (state.tab === 'copytrader') await loadCopy().catch(console.error);
    if (state.tab === 'ninja') await loadNinja().catch(console.error);
    if (state.tab === 'radar') await loadRadar().catch(console.error);
    loadAntifake().catch(() => {});
    if (!$('#drawer').hidden && state.chartPair) renderChart(state.chartPair).catch(() => {});
    loadLiveWallet().catch(() => {});
    state.nextRefresh = Date.now() + 45000;
  }

  const params = new URLSearchParams(location.search);
  const hash = location.hash.replace('#', '');
  const startTab = params.get('tab') || hash || 'trending';
  const mintQ = params.get('mint');
  showTab(['trending', 'new', 'watchlist', 'xstocks', 'copytrader', 'ninja', 'desk', 'wallet', 'radar'].includes(startTab) ? startTab : 'trending');
  loadNinja().catch(() => {});
  loadLiveWallet().catch(() => {});
  loadAntifake().catch(() => {});
  setInterval(() => loadNinja().catch(() => {}), 4000);
  setInterval(() => loadLiveWallet().catch(() => {}), 20_000);
  setInterval(() => loadAntifake().catch(() => {}), 20_000);
  refreshAll().then(() => {
    if (mintQ) openToken(mintQ);
    if (startTab === 'wallet') {
      const w = params.get('wallet') || state.deskWallet;
      $('#wallet-addr').value = w;
      if (w !== state.deskWallet) loadWallet(w);
    }
  });
  setInterval(refreshAll, 45_000);
})();
