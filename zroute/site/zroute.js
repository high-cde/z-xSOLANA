/*! zRoute © 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
 * Swap via API pubblica Jupiter (swap v1) con controlli K.I.R.A. Firma solo nel Phantom dell'utente. Nessuna chiave server, nessuna fee zRoute. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const K = window.KiraCore, W = window.solanaWeb3;
  const WSOL = 'So11111111111111111111111111111111111111112';
  const TOKENS = [
    { sym: 'SOL', mint: WSOL, dec: 9 },
    { sym: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', dec: 6 },
    { sym: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', dec: 6 },
    { sym: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', dec: 6 },
    { sym: '$DSN', mint: '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4', dec: 6, note: 'Token-2022 · nessuna pool' },
    { sym: 'VELVET ($OV)', mint: '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump', dec: 6 },
  ];
  const JUP = ['https://lite-api.jup.ag/swap/v1', 'https://api.jup.ag/swap/v1'];
  const RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
  const JITO = 'https://mainnet.block-engine.jito.wtf/api/v1';
  // Fallback statico dei tip account Jito (letti da getTipAccounts il 15/11/2026); in uso si rilegge dal block engine.
  const JITO_TIPS = ['Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY', 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', 'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt', '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', 'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL', 'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49', 'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe', '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'];
  const PRIORITY_MAX = 100000; // 0,0001 SOL
  const st = { pk: null, quote: null, quoteAt: 0, kin: null, kout: null, dec: {}, sym: {} };
  TOKENS.forEach((t) => { st.dec[t.mint] = t.dec; st.sym[t.mint] = t.sym; });

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const log = (m) => { const l = $('log'); l.textContent += (l.textContent ? '\n' : '') + new Date().toLocaleTimeString('it-IT') + ' · ' + m; };

  async function rpc(method, params) {
    let err;
    for (const u of RPCS) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const j = await r.json();
        if (j.error) { err = new Error(j.error.message || 'errore RPC'); continue; }
        return j.result;
      } catch (e) { err = e; }
    }
    throw err || new Error('RPC non raggiungibile');
  }
  async function fetchJson(url, init) { const r = await fetch(url, init); const j = await r.json().catch(() => ({})); if (!r.ok && !j.error) throw new Error('HTTP ' + r.status); return j; }
  async function jup(path, init) {
    let last;
    for (const b of JUP) {
      try { const j = await fetchJson(b + path, init); if (j && j.error && /rate|limit/i.test(String(j.error))) { last = j; continue; } return j; }
      catch (e) { last = { error: e.message }; }
    }
    return last;
  }

  // ---- token select ----
  function fill(sel, def) {
    sel.innerHTML = TOKENS.map((t) => `<option value="${t.mint}">${esc(t.sym)}</option>`).join('') + '<option value="custom">Altro mint…</option>';
    sel.value = def;
  }
  fill($('in-tok'), WSOL); fill($('out-tok'), TOKENS[1].mint);
  const mintOf = (side) => { const v = $(side + '-tok').value; return v === 'custom' ? $(side + '-mint').value.trim() : v; };
  ['in', 'out'].forEach((s) => $(s + '-tok').addEventListener('change', () => { $(s + '-mint').hidden = $(s + '-tok').value !== 'custom'; reset(); }));
  ['amount', 'in-mint', 'out-mint'].forEach((id) => $(id).addEventListener('input', reset));
  document.querySelectorAll('input[name=slip], #mev, #tip').forEach((e) => e.addEventListener('change', reset));
  $('flip').onclick = () => {
    const a = $('in-tok').value, b = $('out-tok').value, am = $('in-mint').value, bm = $('out-mint').value;
    $('in-tok').value = b; $('out-tok').value = a; $('in-mint').value = bm; $('out-mint').value = am;
    $('in-mint').hidden = b !== 'custom'; $('out-mint').hidden = a !== 'custom'; reset();
  };
  function reset() { st.quote = null; $('out-amt').textContent = '—'; $('go').hidden = true; updateSwapBtn(); }

  // importo decimale -> unità base (stringa, senza float)
  function toBase(str, dec) {
    str = String(str || '').trim().replace(/\s/g, '').replace(',', '.');
    if (!/^\d*\.?\d*$/.test(str) || str === '' || str === '.') return null;
    const [i, f = ''] = str.split('.');
    if (f.length > dec) return null;
    const v = BigInt((i || '0') + f.padEnd(dec, '0'));
    return v > 0n ? v.toString() : null;
  }
  const fromBase = (raw, dec) => (Number(raw) / Math.pow(10, dec)).toLocaleString('it-IT', { maximumFractionDigits: Math.min(dec, 6) });

  // ---- K.I.R.A. render ----
  function vclass(v) { return /BLOCCATO/.test(v) ? 'v-fail' : /ATTENZIONE/.test(v) ? 'v-warn' : 'v-ok'; }
  function kiraHtml(role, r) {
    const name = r.symbol || st.sym[r.mint] || K.mask(r.mint);
    return `<div class="tk"><h3>${esc(role)}: ${esc(name)} <span class="verdict ${vclass(r.verdict)}">${esc(r.verdict)}</span></h3>
      <ul class="chk">${r.checks.map((c) => `<li class="s-${c.status}"><div><b>${esc(c.label)}</b> <span>${esc(c.detail)}</span></div></li>`).join('')}</ul>
      <p class="muted small mono">${esc(K.mask(r.mint))} · <a href="https://solscan.io/token/${esc(r.mint)}" target="_blank" rel="noopener">Solscan</a> · <a href="https://dexscreener.com/solana/${esc(r.mint)}" target="_blank" rel="noopener">DexScreener</a> · fonti: ${esc(r.sources.join(', ') || 'n/d')}</p></div>`;
  }

  // ---- quota ----
  $('quote').onclick = async () => {
    const inM = mintOf('in'), outM = mintOf('out');
    const b = $('quote'); $('res').hidden = false; $('go').hidden = true; st.quote = null;
    if (!K.isMint(inM) || !K.isMint(outM)) { $('kira').innerHTML = '<p class="alert fail">Mint non valido.</p>'; $('route').innerHTML = ''; return; }
    if (inM === outM) { $('kira').innerHTML = '<p class="alert fail">Scegli due token diversi.</p>'; $('route').innerHTML = ''; return; }
    b.disabled = true; b.textContent = 'K.I.R.A. sta controllando…';
    $('kira').innerHTML = '<p class="muted">Controllo on-chain e RugCheck in corso…</p>'; $('route').innerHTML = '<p class="muted">In attesa dei controlli…</p>';
    try {
      const [ki, ko] = await Promise.all([K.kiraReport(inM, { rpc, fetchJson }), K.kiraReport(outM, { rpc, fetchJson })]);
      st.kin = ki; st.kout = ko;
      [ki, ko].forEach((r) => { if (r.decimals != null) st.dec[r.mint] = r.decimals; if (r.symbol && !st.sym[r.mint]) st.sym[r.mint] = r.symbol; });
      $('kira').innerHTML = kiraHtml('Compri', ko) + kiraHtml('Vendi', ki) +
        (ko.fails ? '<p class="alert fail">Acquisto bloccato: il token che compri ha red flag gravi. La vendita resta sempre possibile.</p>' : '');
      const dec = st.dec[inM];
      if (dec == null) throw new Error('decimali del token venduto non disponibili');
      const amt = toBase($('amount').value, dec);
      if (!amt) { $('route').innerHTML = '<p class="alert">Inserisci una quantità valida da vendere (max ' + dec + ' decimali).</p>'; return; }
      b.textContent = 'Chiedo il prezzo a Jupiter…';
      const slip = document.querySelector('input[name=slip]:checked').value;
      const q = await jup(`/quote?inputMint=${inM}&outputMint=${outM}&amount=${amt}&slippageBps=${slip}`);
      if (!q || q.error || !q.routePlan) {
        const nt = q && (q.errorCode === 'TOKEN_NOT_TRADABLE' || /not tradable|no route|COULD_NOT_FIND/i.test(String(q.error || q.errorCode)));
        $('route').innerHTML = `<p class="alert">${nt ? 'Jupiter non trova un percorso per questo scambio: uno dei due token non ha pool di liquidità indicizzate.' + (outM === TOKENS[4].mint || inM === TOKENS[4].mint ? ' È il caso di $DSN su Solana: oggi non ha pool.' : '') : 'Jupiter non ha risposto: ' + esc(q && (q.error || q.errorCode) || 'errore')}</p>`;
        return;
      }
      st.quote = q; st.quoteAt = Date.now();
      renderRoute(q);
      $('go').hidden = false; $('ack2w').hidden = !(ko.warns > 0 && !ko.fails);
      updateSwapBtn();
    } catch (e) { $('route').innerHTML = '<p class="alert fail">' + esc(e.message) + '</p>'; }
    finally { b.disabled = false; b.textContent = 'Controlla e quota'; }
  };

  function renderRoute(q) {
    const sym = (m) => st.sym[m] || K.mask(m), dec = (m) => (st.dec[m] != null ? st.dec[m] : null);
    const ex = K.explainRoute(q, sym, dec);
    const outDec = dec(q.outputMint);
    $('out-amt').textContent = outDec != null ? fromBase(q.outAmount, outDec) : q.outAmount;
    const pi = ex.priceImpactPct;
    const mev = $('mev').checked;
    $('route').innerHTML = `<p class="muted small">${esc(ex.summary)}</p><ol class="steps">${ex.steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>
      <dl class="kv"><dt>Ricevi (stima)</dt><dd class="mono">${outDec != null ? fromBase(q.outAmount, outDec) : q.outAmount} ${esc(sym(q.outputMint))}</dd>
      <dt>Minimo garantito (slippage ${(q.slippageBps / 100).toLocaleString('it-IT')}%)</dt><dd class="mono">${outDec != null ? fromBase(q.otherAmountThreshold, outDec) : q.otherAmountThreshold}</dd>
      <dt>Impatto sul prezzo</dt><dd class="mono">${pi.toLocaleString('it-IT', { maximumFractionDigits: 3 })}%</dd>
      <dt>Commissione zRoute</dt><dd class="mono">0</dd>
      <dt>Invio</dt><dd class="mono">${mev ? 'Jito bundle · tip ' + fromBase($('tip').value, 9) + ' SOL' : 'Phantom · priority fee ≤ 0,0001 SOL'}</dd></dl>
      ${pi > 5 ? '<p class="alert">Impatto sul prezzo alto (oltre 5%): la pool è piccola rispetto all\'importo.</p>' : ''}
      <p class="muted small">Le commissioni delle pool (AMM) sono già comprese nel prezzo di Jupiter. Quotazione dello slot ${esc(q.contextSlot)}.</p>`;
  }

  function updateSwapBtn() {
    const ok = st.quote && st.pk && $('ack1').checked && st.kout && !st.kout.fails && ($('ack2w').hidden || $('ack2').checked);
    $('swap').disabled = !ok;
    $('swap').textContent = !st.pk ? 'Connetti Phantom per firmare' : (st.kout && st.kout.fails) ? 'Bloccato da K.I.R.A.' : 'Swap con Phantom';
  }
  $('ack1').onchange = updateSwapBtn; $('ack2').onchange = updateSwapBtn;

  // ---- Phantom ----
  const provider = () => { const p = (window.phantom && window.phantom.solana) || window.solana; return p && p.isPhantom ? p : null; };
  async function showBalance() {
    if (!st.pk) { $('bal').textContent = ''; return; }
    try { const b = await rpc('getBalance', [st.pk]); $('bal').textContent = 'Saldo SOL: ' + fromBase(b.value, 9); } catch (_) { $('bal').textContent = ''; }
  }
  $('connect').onclick = async () => {
    const p = provider();
    if (!p) {
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) { location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin); return; }
      window.open('https://phantom.app/download', '_blank', 'noopener'); return;
    }
    try {
      if (st.pk) { await p.disconnect(); st.pk = null; $('connect').textContent = 'Connetti Phantom'; $('connect').classList.remove('ok'); }
      else { const r = await p.connect(); st.pk = r.publicKey.toString(); $('connect').textContent = K.mask(st.pk); $('connect').classList.add('ok'); }
    } catch (e) { alert('Connessione rifiutata: ' + e.message); }
    showBalance(); updateSwapBtn();
  };

  // ---- verifica della transazione prima della firma ----
  async function tipAccounts() {
    try { const j = await fetchJson(JITO + '/getTipAccounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTipAccounts', params: [] }) }); if (Array.isArray(j.result) && j.result.length) return j.result; } catch (_) {}
    return JITO_TIPS;
  }
  function systemTransfers(tx) {
    const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
    const out = [];
    tx.message.compiledInstructions.forEach((ix) => {
      if (keys[ix.programIdIndex] !== '11111111111111111111111111111111') return;
      const d = ix.data; if (d.length < 12) return;
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      if (dv.getUint32(0, true) !== 2) return;
      out.push({ from: keys[ix.accountKeyIndexes[0]], to: keys[ix.accountKeyIndexes[1]] || null, lamports: dv.getBigUint64(4, true) });
    });
    return { keys, out };
  }
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function confirm(sig) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const r = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]);
        const s = r && r.value && r.value[0];
        if (s && s.err) return 'errore on-chain: ' + JSON.stringify(s.err);
        if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return 'ok';
      } catch (_) {}
    }
    return 'non ancora confermata (controlla su Solscan)';
  }

  $('swap').onclick = async () => {
    const p = provider(); if (!p || !st.pk || !st.quote) return;
    const btn = $('swap'); btn.disabled = true; $('log').textContent = '';
    const mev = $('mev').checked, tip = Number($('tip').value);
    try {
      if (Date.now() - st.quoteAt > 20000) {
        log('Quotazione vecchia di oltre 20 s: la aggiorno.');
        const q0 = st.quote;
        const q = await jup(`/quote?inputMint=${q0.inputMint}&outputMint=${q0.outputMint}&amount=${q0.inAmount}&slippageBps=${q0.slippageBps}`);
        if (!q || !q.routePlan) throw new Error('Jupiter non ha aggiornato la quotazione');
        st.quote = q; st.quoteAt = Date.now(); renderRoute(q);
      }
      log('Chiedo a Jupiter la transazione (nessuna fee zRoute)…');
      const body = { quoteResponse: st.quote, userPublicKey: st.pk, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: mev ? { jitoTipLamports: tip } : { priorityLevelWithMaxLamports: { maxLamports: PRIORITY_MAX, priorityLevel: 'medium' } } };
      const s = await jup('/swap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!s || !s.swapTransaction) throw new Error('Jupiter non ha restituito la transazione: ' + (s && (s.error || s.errorCode) || 'errore'));
      if (s.simulationError) throw new Error('La simulazione di Jupiter fallisce (' + (s.simulationError.error || s.simulationError.errorCode) + '). Non firmare: controlla saldo e importo.');
      const tx = W.VersionedTransaction.deserialize(unb64(s.swapTransaction));
      const { keys, out } = systemTransfers(tx);
      if (keys[0] !== st.pk) throw new Error('Il pagatore della transazione non è il tuo wallet: firma annullata.');
      if (mev) {
        const tips = new Set(await tipAccounts());
        const t = out.filter((x) => tips.has(x.to));
        if (t.length !== 1 || t[0].lamports !== BigInt(tip) || t[0].from !== st.pk) throw new Error('Non trovo nella transazione esattamente la tip Jito scelta: invio Jito annullato.');
        log('Verificata la tip Jito: ' + fromBase(tip, 9) + ' SOL a ' + K.mask(t[0].to) + '.');
        log('Firma in Phantom (solo firma, invio da Jito)…');
        const signed = await p.signTransaction(tx);
        const raw = b64(signed.serialize());
        const j = await fetchJson(JITO + '/transactions?bundleOnly=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: [raw, { encoding: 'base64' }] }) });
        if (j.error || !j.result) throw new Error('Jito ha rifiutato la transazione: ' + (j.error ? j.error.message || JSON.stringify(j.error) : 'nessuna risposta'));
        log('Inviata a Jito come bundle. Firma: ' + j.result);
        const r = await confirm(j.result);
        log(r === 'ok' ? 'Confermata. https://solscan.io/tx/' + j.result : 'Esito: ' + r + ' · https://solscan.io/tx/' + j.result);
      } else {
        log('Firma e invio in Phantom…');
        const r0 = await p.signAndSendTransaction(tx);
        const sig = r0.signature || r0;
        log('Inviata. Firma: ' + sig);
        const r = await confirm(sig);
        log(r === 'ok' ? 'Confermata. https://solscan.io/tx/' + sig : 'Esito: ' + r + ' · https://solscan.io/tx/' + sig);
      }
      showBalance();
    } catch (e) { log('Fermato: ' + (e && e.message ? e.message : e)); }
    finally { updateSwapBtn(); }
  };

  const p0 = provider();
  if (p0 && p0.on) p0.on('accountChanged', (pk) => { st.pk = pk ? pk.toString() : null; $('connect').textContent = st.pk ? K.mask(st.pk) : 'Connetti Phantom'; showBalance(); updateSwapBtn(); });
  if (p0) p0.connect({ onlyIfTrusted: true }).then((r) => { st.pk = r.publicKey.toString(); $('connect').textContent = K.mask(st.pk); $('connect').classList.add('ok'); showBalance(); updateSwapBtn(); }).catch(() => {});
  $('amount').value = '0,1';
  updateSwapBtn();
})();
