/* ZDOS DeFi · pannello unico. JS vanilla, nessuna dipendenza esterna.
   Le transazioni sono costruite da Jupiter / SDK Meteora sul server e firmate SOLO nel wallet dell'utente (Wallet Standard).
   Nessuna richiesta di firma parte senza un clic esplicito. © 2026 ZDOS1.3 */
(function () {
  "use strict";
  var API = "/api/defi";
  var CHAIN = "solana:mainnet";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var S = { mode: "normale", tab: "swap", ov: null, slip: 100, q: null, pool: null, poolAddr: null, st: "spot", w: null, acc: null, addr: null, firma: false, bal: null };
  var CL = [];
  function clog(m, err) { CL.push({ ts: Date.now(), m: m, e: !!err }); if (CL.length > 60) CL.shift(); if (S.tab === "dev") renderClientLog(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nf(n, d) { if (n == null || !isFinite(n)) return "—"; var a = Math.abs(n); if (d == null) d = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 8; return Number(n).toLocaleString("it-IT", { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  function usd(n) { return n == null || !isFinite(n) ? "—" : "$" + nf(n, n >= 1 ? 2 : 6); }
  function short(a) { return a ? a.slice(0, 4) + "…" + a.slice(-4) : ""; }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove("show"); }, 4200); }
  function api(path, opt) {
    var t0 = performance.now();
    return fetch(API + path, Object.assign({ cache: "no-store" }, opt || {})).then(function (r) {
      return r.json().catch(function () { return { ok: false, errore: "risposta non valida (" + r.status + ")" }; }).then(function (j) { clog((opt && opt.method || "GET") + " " + path.split("?")[0] + " → " + r.status + " · " + Math.round(performance.now() - t0) + " ms", !r.ok); return j; });
    }).catch(function (e) { clog("rete: " + e.message, true); return { ok: false, errore: "rete non disponibile" }; });
  }
  function post(path, body) { return api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  function b64ToU8(b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function u8ToB64(u) { var s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function b58(u) { var d = [0]; for (var i = 0; i < u.length; i++) { var c = u[i]; for (var j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } } var s = ""; for (var k = 0; k < u.length && u[k] === 0; k++) s += "1"; for (var q = d.length - 1; q >= 0; q--) s += B58[d[q]]; return s; }

  /* ---------- modalità e tab ---------- */
  function setMode(m) {
    S.mode = m === "dev" ? "dev" : "normale"; document.body.classList.toggle("dev", S.mode === "dev");
    $$(".mode button").forEach(function (b) { b.classList.toggle("on", b.dataset.mode === S.mode); });
    try { localStorage.setItem("zdos-defi-mode", S.mode); } catch (e) {}
    if (S.mode !== "dev" && S.tab === "dev") setTab("swap"); else moveInk();
  }
  function setTab(t, noHash) {
    if (t === "dev" && S.mode !== "dev") setMode("dev");
    if (!$('[data-panel="' + t + '"]')) t = "swap";
    S.tab = t;
    $$("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== t; });
    $$(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"); });
    moveInk();
    if (!noHash) history.replaceState(null, "", "#" + t);
    if (t === "pool") loadPools(); if (t === "basket") renderBasket(); if (t === "posizioni") loadWallet(); if (t === "dev") devStart();
  }
  function moveInk() {
    var b = $('.tabs button[aria-selected="true"]'), ink = $(".tabs .ink"); if (!b || !ink) return;
    ink.style.width = b.offsetWidth + "px"; ink.style.transform = "translateX(" + b.offsetLeft + "px)";
  }

  /* ---------- wallet + firma ZDOS ---------- */
  function wallets() { return (window.ZDOSFirma && window.ZDOSFirma.wallets()) || []; }
  function openWallet() {
    if (S.addr) { if (confirm("Disconnettere " + short(S.addr) + " da questo pannello?")) { S.w = S.acc = S.addr = null; S.firma = false; renderWallet(); } return; }
    var m = $("#wm"); m.hidden = false; renderWList();
  }
  function renderWList() {
    var list = $("#wm-list"), ws = wallets(); list.textContent = "";
    if (!ws.length) {
      var u = location.href, link = "https://phantom.app/ul/browse/" + encodeURIComponent(u) + "?ref=" + encodeURIComponent(location.origin);
      list.innerHTML = '<p class="fine">Nessun wallet Solana rilevato in questo browser. Su telefono apri il pannello nel browser del tuo wallet.</p><a class="btn primary wide" href="' + esc(link) + '">Apri in Phantom</a>';
      return;
    }
    ws.forEach(function (w) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn wide";
      if (w.icon) { var i = document.createElement("img"); i.src = w.icon; i.alt = ""; b.appendChild(i); }
      b.appendChild(document.createTextNode(w.name)); b.addEventListener("click", function () { connect(w); }); list.appendChild(b);
    });
  }
  function connect(w) {
    var st = $("#wm-st"), useFirma = $("#wm-firma").checked; st.className = "msg"; st.textContent = "Apertura di " + w.name + "…";
    var p = useFirma ? window.ZDOSFirma.login(w, { onStatus: function (t) { st.textContent = t; } }).then(function (v) { S.firma = true; return v.address; })
      : w.features["standard:connect"].connect().then(function (r) { var a = (r.accounts && r.accounts[0]) || w.accounts[0]; if (!a) throw new Error("nessun account"); S.firma = false; return a.address; });
    p.then(function (addr) {
      S.w = w; S.addr = addr; S.acc = (w.accounts || []).filter(function (a) { return a.address === addr; })[0] || w.accounts[0];
      $("#wm").hidden = true; clog("wallet " + w.name + " " + short(addr) + (S.firma ? " (firma ZDOS verificata)" : " (solo connessione)"));
      toast(S.firma ? "Accesso con firma ZDOS verificato" : "Wallet connesso"); renderWallet();
    }).catch(function (e) { var m = (e && e.message) || String(e); if (/reject|denied|cancel|rifiut/i.test(m)) m = "Richiesta annullata nel wallet."; st.className = "msg err"; st.textContent = m; clog("wallet: " + m, true); });
  }
  function renderWallet() {
    var b = $("#wbtn"); b.textContent = S.addr ? (S.firma ? "✓ " : "") + short(S.addr) : "Accedi con ZDOS"; b.title = S.addr ? "Clic per disconnettere" : "";
    updateSwapBtn(); updateLpBtn(); if (S.tab === "posizioni") loadWallet(); refreshBalHints();
  }
  function feat(name) { return S.w && S.w.features && S.w.features[name]; }
  // Firma e invia una transazione serializzata (base64). Con signAndSend se il wallet lo offre, altrimenti firma + inoltro tramite /send.
  function signAndSend(b64) {
    var tx = b64ToU8(b64), f = feat("solana:signAndSendTransaction");
    if (f) return f.signAndSendTransaction({ account: S.acc, transaction: tx, chain: CHAIN }).then(function (o) { o = Array.isArray(o) ? o[0] : o; return b58(o.signature); });
    var g = feat("solana:signTransaction"); if (!g) return Promise.reject(new Error("il wallet non supporta la firma di transazioni"));
    return g.signTransaction({ account: S.acc, transaction: tx, chain: CHAIN }).then(function (o) { o = Array.isArray(o) ? o[0] : o; return post("/send", { tx: u8ToB64(o.signedTransaction) }); })
      .then(function (r) { if (!r.ok) throw new Error(r.errore || "invio non riuscito"); return r.signature; });
  }
  function signOnly(b64) {
    var g = feat("solana:signTransaction"); if (!g) return Promise.reject(new Error("il wallet non supporta la sola firma di transazioni, necessaria per aprire una posizione"));
    return g.signTransaction({ account: S.acc, transaction: b64ToU8(b64), chain: CHAIN }).then(function (o) { o = Array.isArray(o) ? o[0] : o; return u8ToB64(o.signedTransaction); });
  }
  function errMsg(e) { var m = (e && e.message) || String(e); return /user rejected|rejected the request|denied|cancel/i.test(m) ? "Firma annullata nel wallet." : m; }
  function txLink(sig) { return '<a href="https://solscan.io/tx/' + esc(sig) + '" target="_blank" rel="noopener">vedi su Solscan</a>'; }

  /* ---------- overview + filiera ---------- */
  function tok(sym) { return S.ov && S.ov.tokens.filter(function (t) { return t.sym === sym; })[0]; }
  function loadOverview() {
    return api("/overview").then(function (j) { if (!j.ok) { toast("Dati non disponibili: " + (j.errore || "")); return; } S.ov = j; fillSelects(); if (S.tab === "basket") renderBasket(); if (S.tab === "pool") renderPools(); });
  }
  function loadEco() {
    api("/ecosystem").then(function (j) {
      var el = $("#eco"); if (!j.ok) { el.innerHTML = '<span class="sk">Filiera non raggiungibile</span>'; return; }
      var h = "";
      if (j.vchain) h += '<span class="chip"><i class="dot"></i>vBLOCKCHAIN <b>blocco ' + esc(j.vchain.height) + "</b></span>";
      if (j.miner) h += '<span class="chip"><i class="dot"></i>ZDOS Miner <b>' + esc(j.miner.proofs) + " prove</b> · lavoro utile</span>";
      if (j.zpool) h += '<span class="chip">Z-Pool <b>' + nf(j.zpool.hashrateDichiaratoHs, 0) + " H/s</b> dichiarati</span>";
      h += '<span class="chip">Firma <b>ZDOS</b> · <a href="/verifica/">verifica</a></span>';
      el.innerHTML = h; S.eco = j; if (S.tab === "dev") $("#d-eco").textContent = JSON.stringify(j, null, 2);
    });
  }

  /* ---------- SWAP ---------- */
  var SWAP_SYMS = ["SOL", "USDC", "L$D", "VELVET", "xZDOS"];
  function fillSelects() {
    var si = $("#s-in"), so = $("#s-outm"), vi = si.value || "SOL", vo = so.value || "L$D";
    [si, so].forEach(function (sel) {
      sel.textContent = "";
      SWAP_SYMS.forEach(function (s) { var t = tok(s), o = document.createElement("option"); o.value = s; o.textContent = s + (t && t.tradable && !t.tradable.ok ? " · non instradabile" : ""); sel.appendChild(o); });
    });
    si.value = vi; so.value = vo; requote();
  }
  var qT;
  function requote() { clearTimeout(qT); qT = setTimeout(doQuote, 450); }
  function doQuote() {
    var a = $("#s-amt").value.trim().replace(",", "."), i = $("#s-in").value, o = $("#s-outm").value, box = $("#s-quote");
    S.q = null; updateSwapBtn(); $("#s-out").textContent = "—";
    if (!a || !(+a > 0)) { box.className = "quote muted"; box.textContent = "Inserisci un importo per vedere la quotazione."; $("#s-kira").textContent = ""; return; }
    if (i === o) { box.className = "quote muted"; box.textContent = "Scegli due monete diverse."; return; }
    box.className = "quote muted"; box.textContent = "Quotazione in corso…";
    api("/quote?in=" + encodeURIComponent(i) + "&out=" + encodeURIComponent(o) + "&amount=" + encodeURIComponent(a) + "&slippageBps=" + S.slip).then(function (q) {
      $("#s-raw").textContent = JSON.stringify(q, null, 2);
      renderKira([i, o]);
      if (!q.ok) { box.className = "quote"; box.innerHTML = "<b>Nessuna quotazione.</b> " + esc(q.errore || "") + (q.codice === "TOKEN_NOT_TRADABLE" ? "<br><span class='fine'>Jupiter non trova un percorso per questa moneta in questo momento.</span>" : ""); $("#s-route").textContent = "—"; return; }
      S.q = q; $("#s-out").textContent = nf(q.out.amount);
      box.className = "quote"; box.innerHTML = '<div class="big">1 ' + esc(q.in.sym) + " ≈ " + nf(q.rate) + " " + esc(q.out.sym) + "</div>" +
        "<div>Minimo garantito: <b>" + nf(q.out.minimum) + " " + esc(q.out.sym) + "</b> · slippage " + nf(q.slippageBps / 100, 2) + "%</div>" +
        "<div>Impatto sul prezzo: <b>" + nf(q.priceImpactEst * 100, 2) + "%</b>" + (q.priceImpactEst > 0.03 ? ' <span class="badge rosso">alto</span>' : "") + '<span class="fine dev-only"> (' + esc(q.priceImpactSource) + ", Jupiter: " + esc(q.priceImpactPct) + ")</span></div>";
      var r = $("#s-route"); r.innerHTML = '<span class="hop">' + esc(q.in.sym) + "</span>" + q.route.map(function (x) { return '<span class="arrow">→</span><span class="hop">' + esc(x.label || "AMM") + " · " + esc(x.pct) + '%<br><span class="mono dev-only">' + esc(x.amm) + "</span></span>"; }).join("") + '<span class="arrow">→</span><span class="hop">' + esc(q.out.sym) + "</span>";
      updateSwapBtn();
    });
  }
  function kiraBox(t) {
    if (!t || t.kind === "base") return "";
    var k = t.kira || { level: "giallo", flags: [] };
    return '<div class="kbox ' + esc(k.level) + '"><b>Controlli K.I.R.A. · ' + esc(t.sym) + '</b> <span class="badge ' + esc(k.level) + '">' + esc(k.level) + "</span>" + (k.flags.length ? "<ul>" + k.flags.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" : "<div>Nessun avviso.</div>") + "</div>";
  }
  function renderKira(syms) {
    var h = "", red = false;
    syms.forEach(function (s) { var t = tok(s); h += kiraBox(t); if (t && t.kira && t.kira.level === "rosso") red = true; });
    $("#s-kira").innerHTML = h; $("#s-ackw").classList.toggle("hidden", !red); if (!red) $("#s-ack").checked = false; S.qRed = red;
  }
  function updateSwapBtn() {
    var b = $("#s-go");
    if (!S.addr) { b.disabled = false; b.textContent = "Accedi con il wallet per lo swap"; return; }
    if (!S.q) { b.disabled = true; b.textContent = "Nessuna quotazione"; return; }
    if (S.qRed && !$("#s-ack").checked) { b.disabled = true; b.textContent = "Leggi e conferma gli avvisi"; return; }
    b.disabled = false; b.textContent = "Firma lo swap nel wallet";
  }
  function goSwap() {
    if (!S.addr) return openWallet();
    if (!S.q) return; var b = $("#s-go"), q = S.q; b.disabled = true; b.textContent = "Preparo la transazione…";
    post("/swap/build", { quoteResponse: q.quoteResponse, userPublicKey: S.addr }).then(function (r) {
      if (!r.ok) throw new Error(r.errore || "costruzione non riuscita");
      b.textContent = "Conferma nel wallet…"; return signAndSend(r.tx);
    }).then(function (sig) { $("#s-quote").innerHTML = '<span class="msg ok">Swap inviato.</span> ' + txLink(sig); clog("swap inviato " + sig); toast("Swap inviato"); setTimeout(refreshBal, 6000); })
      .catch(function (e) { toast(errMsg(e)); clog("swap: " + errMsg(e), true); }).then(function () { updateSwapBtn(); });
  }
  function refreshBal() { if (!S.addr) return; api("/wallet/" + S.addr).then(function (j) { if (j.ok) { S.bal = j; refreshBalHints(); if (S.tab === "posizioni") renderWalletData(j); } }); }
  function refreshBalHints() {
    var bi = $("#s-bal-in"), bo = $("#s-bal-out"); if (!S.bal || !S.addr) { bi.textContent = bo.textContent = ""; return; }
    var b = S.bal.balances; bi.textContent = "Saldo: " + nf(b[$("#s-in").value] || 0); bo.textContent = "Saldo: " + nf(b[$("#s-outm").value] || 0);
  }

  /* ---------- POOL ---------- */
  function loadPools() { if (!S.ov) return loadOverview(); renderPools(); }
  function poolStatus(p) { return p.blacklisted ? '<span class="badge rosso">segnalato</span>' : '<span class="badge verde">attivo</span>'; }
  function renderPools() {
    var tb = $("#p-list"); if (!S.ov) return;
    if (!S.ov.pools.length) { tb.innerHTML = '<tr><td colspan="9" class="muted">Nessun pool DLMM trovato per le monete ZDOS.</td></tr>'; return; }
    tb.innerHTML = S.ov.pools.map(function (p) {
      var liq = (p.x.amount || 0) * (p.x.priceUsd || 0) + (p.y.amount || 0) * (p.y.priceUsd || 0);
      var dsx = S.ov.tokens.reduce(function (a, t) { return a.concat(t.pairs || []); }, []).filter(function (x) { return x.pair === p.address; })[0];
      if (dsx && dsx.liquidityUsd != null) liq = dsx.liquidityUsd;
      return '<tr data-pool="' + esc(p.address) + '"' + (S.poolAddr === p.address ? ' class="sel"' : "") + "><td><b>" + esc(p.name) + "</b></td><td>" + nf(p.priceInY) + " " + esc(p.y.sym) + "</td><td>" + usd(liq) + "</td><td>" + usd(p.volume && p.volume["24h"]) + "</td><td>" + usd(p.fees && p.fees["24h"]) + '</td><td class="dev-only">' + esc(p.binStep) + '</td><td class="dev-only">' + nf(p.baseFeePct, 3) + '%</td><td class="dev-only">' + nf(p.dynamicFeePct, 3) + "%</td><td>" + poolStatus(p) + "</td></tr>";
    }).join("");
    $$("#p-list tr[data-pool]").forEach(function (tr) { tr.addEventListener("click", function () { openPool(tr.dataset.pool); }); });
    if (!S.poolAddr && S.ov.pools[0]) openPool(S.ov.pools[0].address);
  }
  function openPool(addr) {
    S.poolAddr = addr; $$("#p-list tr").forEach(function (t) { t.classList.toggle("sel", t.dataset.pool === addr); });
    $("#p-detail").hidden = false; $("#p-title").textContent = "Caricamento pool…";
    api("/pool/" + addr).then(function (d) {
      if (!d.ok) { $("#p-title").textContent = "Pool non disponibile: " + (d.errore || ""); return; }
      S.pool = d; var p = d.pool, o = d.onchain;
      $("#p-title").innerHTML = esc(p.name) + ' <small class="muted">bin step ' + esc(o.binStep) + "</small>";
      $("#lp-xl").textContent = p.x.sym || "Token X"; $(".lx").textContent = p.x.sym || "token X";
      var warn = [];
      if (p.blacklisted) warn.push("Le API Meteora segnalano questo pool (blacklist): l'interfaccia ufficiale potrebbe non mostrarlo.");
      var tx = tok(p.x.sym); if (tx && tx.kira) tx.kira.flags.forEach(function (f) { warn.push(p.x.sym + ": " + f); });
      $("#p-warn").innerHTML = warn.length ? '<div class="kbox rosso"><b>Avvisi</b><ul>' + warn.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul></div>" : "";
      $("#lp-ackw").classList.toggle("hidden", !warn.length); if (!warn.length) $("#lp-ack").checked = true; else $("#lp-ack").checked = false;
      $("#p-kv").innerHTML = kv([["Prezzo (bin attivo)", nf(o.activePrice) + " " + p.y.sym + " per " + p.x.sym], ["Riserve", nf(p.x.amount) + " " + p.x.sym + " · " + nf(p.y.amount) + " " + p.y.sym], ["Volume 24h", usd(p.volume && p.volume["24h"])], ["Commissioni 24h", usd(p.fees && p.fees["24h"])], ["Indirizzo", p.address]]);
      $("#p-raw").textContent = JSON.stringify({ binStep: o.binStep, activeBin: o.activeBin, feeInfo: o.feeInfo, dynamicFeePct: o.dynamicFeePct, baseFeePct: p.baseFeePct, maxFeePct: p.maxFeePct, protocolFeePct: p.protocolFeePct, pairType: p.pairType, collectFeeMode: p.collectFeeMode, status: o.status, reserveX: p.reserveX, reserveY: p.reserveY, slotRead: d.slotRead, meteora: p.meteoraUrl }, null, 2);
      drawBins(); lpRange(); updateLpBtn();
    });
  }
  function kv(rows) { return rows.map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join(""); }
  function drawBins() {
    var d = S.pool; if (!d) return; var el = $("#p-bins"), a = d.onchain.activeBin, L = +$("#lp-l").value, R = +$("#lp-r").value;
    var vals = d.bins.map(function (b) { return b.y + b.x * b.price; }), mx = Math.max.apply(null, vals.concat([1e-12]));
    el.textContent = "";
    d.bins.forEach(function (b, i) {
      var bar = document.createElement("i"); bar.className = b.id === a ? "a" : b.x > 0 ? "x" : "y";
      if (b.id >= a - L && b.id <= a + R) bar.classList.add("inr");
      bar.title = "bin " + b.id + " · prezzo " + nf(b.price) + " · " + nf(b.x) + " X · " + nf(b.y) + " SOL"; el.appendChild(bar);
      var h = Math.max(3, Math.round(Math.sqrt(vals[i] / mx) * 160)); // scala a radice: rende leggibili anche i bin piccoli
      requestAnimationFrame(function () { setTimeout(function () { bar.style.height = h + "px"; }, 8 * i); });
    });
  }
  function lpRange() {
    var d = S.pool; $("#lp-lv").textContent = $("#lp-l").value; $("#lp-rv").textContent = $("#lp-r").value; if (!d) return;
    var step = 1 + d.onchain.binStep / 10000, p0 = d.onchain.activePrice, L = +$("#lp-l").value, R = +$("#lp-r").value;
    $("#lp-range").innerHTML = "Intervallo: <b>" + nf(p0 * Math.pow(step, -L)) + "</b> → <b>" + nf(p0 * Math.pow(step, R)) + "</b> SOL per " + esc(d.pool.x.sym) + " · " + (L + R + 1) + " bin" +
      '<div class="fine">Sotto il prezzo attuale la posizione usa SOL, sopra usa ' + esc(d.pool.x.sym) + ".</div>";
    $$("#p-bins i").forEach(function (bar, i) { var id = d.bins[i].id; bar.classList.toggle("inr", id >= d.onchain.activeBin - L && id <= d.onchain.activeBin + R); });
  }
  function updateLpBtn() {
    var b = $("#lp-go"); if (!S.addr) { b.disabled = false; b.textContent = "Accedi con il wallet"; return; }
    var x = +($("#lp-x").value.replace(",", ".")) || 0, y = +($("#lp-y").value.replace(",", ".")) || 0;
    if (!S.pool) { b.disabled = true; b.textContent = "Scegli un pool"; return; }
    if (!(x > 0 || y > 0)) { b.disabled = true; b.textContent = "Inserisci un importo"; return; }
    if (!$("#lp-ack").checked) { b.disabled = true; b.textContent = "Conferma di aver letto gli avvisi"; return; }
    b.disabled = false; b.textContent = "Firma e apri la posizione";
  }
  function goLp() {
    if (!S.addr) return openWallet();
    var b = $("#lp-go"), m = $("#lp-msg"); b.disabled = true; m.className = "msg"; m.textContent = "Preparo la transazione con l'SDK Meteora…";
    var id;
    post("/lp/build", { pool: S.poolAddr, owner: S.addr, amountX: $("#lp-x").value.replace(",", "."), amountY: $("#lp-y").value.replace(",", "."), strategy: S.st, binsLeft: +$("#lp-l").value, binsRight: +$("#lp-r").value }).then(function (r) {
      if (!r.ok) throw new Error(r.errore || "costruzione non riuscita"); id = r.id; clog("lp/build posizione " + r.position);
      m.textContent = "Conferma nel wallet…"; return signOnly(r.tx);
    }).then(function (signed) { m.textContent = "Invio…"; return post("/lp/finalize", { id: id, tx: signed }); })
      .then(function (r) { if (!r.ok) throw new Error(r.errore || "invio non riuscito"); m.className = "msg ok"; m.innerHTML = "Posizione aperta. " + txLink(r.signature); toast("Posizione aperta"); clog("lp inviata " + r.signature); })
      .catch(function (e) { m.className = "msg err"; m.textContent = errMsg(e); clog("lp: " + errMsg(e), true); }).then(updateLpBtn);
  }

  /* ---------- BASKET ---------- */
  function renderBasket() {
    var box = $("#b-cards"); if (!S.ov) { loadOverview(); return; }
    var list = S.ov.tokens.filter(function (t) { return t.kind === "zdos"; });
    var h = list.map(function (t) {
      var m = t.market || {}, pair = (t.pairs || [])[0];
      return '<div class="card"><div class="tk">' + (t.icon ? '<img src="' + esc(t.icon) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ph">' + esc(t.sym.slice(0, 2)) + "</span>") +
        "<div><b>" + esc(t.sym) + "</b> <small>" + esc(t.alias || "") + " · Solana</small></div></div>" +
        '<dl class="kv">' + kv([["Prezzo", m.usdPrice != null ? usd(m.usdPrice) + " (Jupiter)" : pair && pair.priceUsd != null ? usd(pair.priceUsd) + " (DexScreener)" : "nessun prezzo di mercato"], ["Liquidità", pair ? usd(pair.liquidityUsd) + " (DexScreener)" : m.liquidityUsd != null ? usd(m.liquidityUsd) + " (Jupiter)" : "—"], ["Holder", m.holders != null ? nf(m.holders, 0) : "—"], ["Swap", t.tradable && t.tradable.ok ? "instradabile via " + ((t.tradable.route || []).join(", ") || "Jupiter") : "non instradabile ora"]]) + "</dl>" +
        kiraBox(t) + '<p class="fine">' + esc(t.note || "") + '</p><div class="mono dev-only">' + esc(t.mint) + "</div>" +
        '<div class="links"><a href="https://solscan.io/token/' + esc(t.mint) + '" target="_blank" rel="noopener">Solscan</a>' + (pair ? '<a href="' + esc(pair.url) + '" target="_blank" rel="noopener">DexScreener</a>' : "") + "</div></div>";
    }).join("");
    var pg = S.ov.polygon;
    h += '<div class="card"><div class="tk"><span class="ph">DS</span><div><b>' + esc(pg.sym) + "</b> <small>Polygon · ERC-20</small></div></div><p class=\"fine\">" + esc(pg.note) + '</p><div class="mono">' + esc(pg.contract) + "</div>" +
      (pg.pairs && pg.pairs.length ? '<dl class="kv">' + kv([["Prezzo", usd(pg.pairs[0].priceUsd)], ["Liquidità", usd(pg.pairs[0].liquidityUsd)]]) + "</dl>" : '<p class="fine">Nessuna coppia trovata su DexScreener.</p>') +
      '<div class="links"><a href="https://polygonscan.com/token/' + esc(pg.contract) + '" target="_blank" rel="noopener">Polygonscan</a></div></div>';
    box.innerHTML = h; renderLegs();
    $$("#b-cards img").forEach(function (im) { im.addEventListener("error", function () { var s = document.createElement("span"); s.className = "ph"; s.textContent = "Z"; im.replaceWith(s); }); });
  }
  function tradableZ() { return S.ov ? S.ov.tokens.filter(function (t) { return t.kind === "zdos" && t.tradable && t.tradable.ok; }) : []; }
  function renderLegs() {
    var box = $("#c-legs"), ts = tradableZ();
    if (!ts.length) { box.innerHTML = '<p class="muted">Nessuna moneta ZDOS è instradabile in questo momento.</p>'; return; }
    box.innerHTML = ts.map(function (t) { return '<div class="leg" data-sym="' + esc(t.sym) + '"><span><b>' + esc(t.sym) + '</b> <span class="badge ' + esc(t.kira.level) + '">' + esc(t.kira.level) + '</span></span><label><input type="number" min="0" max="100" value="' + Math.round(100 / ts.length) + '" aria-label="peso %"> %</label><span class="lq muted">—</span><button class="btn" type="button" disabled>Firma</button></div>'; }).join("");
    $$("#c-legs .leg button").forEach(function (b) { b.addEventListener("click", function () { legSwap(b.closest(".leg")); }); });
  }
  function composeQuotes() {
    var tot = +$("#c-amt").value.replace(",", "."); if (!(tot > 0)) return toast("Importo SOL non valido");
    $$("#c-legs .leg").forEach(function (leg) {
      var w = +$("input", leg).value || 0, amt = +(tot * w / 100).toFixed(9), out = $(".lq", leg), b = $("button", leg); leg._q = null; b.disabled = true;
      if (!(amt > 0)) { out.textContent = "peso 0"; return; }
      out.textContent = "…";
      api("/quote?in=SOL&out=" + encodeURIComponent(leg.dataset.sym) + "&amount=" + amt + "&slippageBps=" + S.slip).then(function (q) {
        if (!q.ok) { out.textContent = q.errore || "nessun percorso"; return; }
        leg._q = q; out.textContent = nf(amt) + " SOL → " + nf(q.out.amount) + " " + q.out.sym + " (min " + nf(q.out.minimum) + ")"; b.disabled = false;
      });
    });
  }
  function legSwap(leg) {
    if (!S.addr) return openWallet(); var q = leg._q; if (!q) return;
    var t = tok(leg.dataset.sym); if (t && t.kira.level === "rosso" && !confirm("K.I.R.A. segnala rischi alti per " + t.sym + ":\n- " + t.kira.flags.join("\n- ") + "\n\nProcedere comunque?")) return;
    var b = $("button", leg); b.disabled = true; b.textContent = "…";
    post("/swap/build", { quoteResponse: q.quoteResponse, userPublicKey: S.addr }).then(function (r) { if (!r.ok) throw new Error(r.errore); return signAndSend(r.tx); })
      .then(function (sig) { $(".lq", leg).innerHTML = "inviato · " + txLink(sig); clog("basket " + leg.dataset.sym + " " + sig); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { b.textContent = "Firma"; b.disabled = false; });
  }

  /* ---------- POSIZIONI ---------- */
  function loadWallet() {
    if (!S.addr) { $("#w-empty").hidden = false; $("#w-bal").textContent = ""; $("#w-pos").textContent = "—"; return; }
    $("#w-empty").hidden = true; $("#w-pos").textContent = "Lettura on-chain…";
    api("/wallet/" + S.addr).then(function (j) { if (!j.ok) { $("#w-pos").textContent = j.errore || "errore"; return; } S.bal = j; renderWalletData(j); refreshBalHints(); });
  }
  function renderWalletData(j) {
    $("#w-bal").innerHTML = ["SOL", "USDC", "VELVET", "xZDOS", "L$D"].map(function (s) { return '<div class="bal-i"><small class="muted">' + esc(s) + "</small><b>" + nf(j.balances[s] || 0) + "</b></div>"; }).join("");
    var ps = j.positions.filter(function (p) { return p.position; });
    if (!ps.length) { $("#w-pos").innerHTML = '<p class="muted">Nessuna posizione DLMM nei pool ZDOS.</p>'; return; }
    $("#w-pos").innerHTML = ps.map(function (p) {
      return '<div class="pos" data-pos="' + esc(p.position) + '" data-pool="' + esc(p.pool) + '"><b>' + short(p.pool) + "</b> · bin " + esc(p.lowerBin) + "→" + esc(p.upperBin) + " " + (p.inRange ? '<span class="badge verde">nel range</span>' : '<span class="badge giallo">fuori range</span>') +
        "<div>" + nf(p.x) + " X · " + nf(p.y) + " SOL · commissioni " + nf(p.feeX) + " X / " + nf(p.feeY) + ' SOL</div><div class="mono dev-only">' + esc(p.position) + '</div>' +
        '<label class="fld"><span>Quota da ritirare: <b class="pv">100</b>%</span><input type="range" min="1" max="100" value="100"></label><label class="ack"><input type="checkbox" class="cl" checked> Al 100% chiudi la posizione e recupera l\'affitto</label><button class="btn" type="button">Firma e ritira</button><div class="msg"></div></div>';
    }).join("");
    $$("#w-pos .pos").forEach(function (el) {
      var r = $("input[type=range]", el); r.addEventListener("input", function () { $(".pv", el).textContent = r.value; });
      $("button", el).addEventListener("click", function () { removeLp(el); });
    });
  }
  function removeLp(el) {
    var m = $(".msg", el), b = $("button", el); b.disabled = true; m.className = "msg"; m.textContent = "Preparo…";
    var bps = +$("input[type=range]", el).value * 100;
    post("/lp/remove", { pool: el.dataset.pool, owner: S.addr, position: el.dataset.pos, bps: bps, close: $(".cl", el).checked }).then(function (r) {
      if (!r.ok) throw new Error(r.errore || "errore"); var sigs = [];
      return r.txs.reduce(function (p, t, i) { return p.then(function () { m.textContent = "Conferma nel wallet (" + (i + 1) + "/" + r.txs.length + ")…"; return signAndSend(t).then(function (s) { sigs.push(s); }); }); }, Promise.resolve()).then(function () { return sigs; });
    }).then(function (sigs) { m.className = "msg ok"; m.innerHTML = "Ritiro inviato. " + sigs.map(txLink).join(" · "); setTimeout(loadWallet, 8000); })
      .catch(function (e) { m.className = "msg err"; m.textContent = errMsg(e); }).then(function () { b.disabled = false; });
  }

  /* ---------- DEV ---------- */
  var devT;
  function devStart() {
    if (!$("#d-api").children.length) api("/dev").then(function (j) {
      if (!j.ok) return;
      $("#d-api").innerHTML = j.endpoints.map(function (e) { var get = e[0] === "GET" && !/\{/.test(e[1]); return '<div class="api"><span class="m ' + e[0] + '">' + e[0] + "</span><code>" + esc(e[1]) + "</code>" + (get ? '<button class="btn" data-try="' + esc(e[1]) + '">Prova</button>' : "<span></span>") + "<em>" + esc(e[2]) + "</em></div>"; }).join("") + '<p class="fine">Regole: ' + j.regole.map(esc).join(" · ") + "</p>";
      $$("[data-try]").forEach(function (b) { b.addEventListener("click", function () { var p = b.dataset.try.replace(/^\/api\/defi/, ""); $("#d-out").textContent = "…"; api(p).then(function (r) { $("#d-out").textContent = JSON.stringify(r, null, 2); }); }); });
    });
    if (S.eco) $("#d-eco").textContent = JSON.stringify(S.eco, null, 2);
    devLog(); clearInterval(devT); devT = setInterval(function () { if (S.tab === "dev" && !document.hidden) devLog(); }, 5000);
    renderClientLog();
  }
  function t(ts) { return new Date(ts).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" }); }
  function devLog() {
    fetch(API + "/log", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      $("#d-log").innerHTML = j.richieste.map(function (x) { return "<div" + (x.status >= 400 ? ' class="e"' : "") + ">" + t(x.ts) + " " + esc(x.method) + " " + esc(x.path) + " " + x.status + " " + x.ms + "ms</div>"; }).join("");
      $("#d-up").innerHTML = j.upstream.map(function (x) { return "<div" + (!x.status || x.status >= 400 ? ' class="e"' : "") + ">" + t(x.ts) + " " + esc(x.url) + " " + x.status + " " + x.ms + "ms" + (x.err ? " " + esc(x.err) : "") + "</div>"; }).join("");
    }).catch(function () {});
  }
  function renderClientLog() { var el = $("#d-cl"); if (el) el.innerHTML = CL.slice().reverse().map(function (x) { return "<div" + (x.e ? ' class="e"' : "") + ">" + t(x.ts) + " " + esc(x.m) + "</div>"; }).join(""); }

  /* ---------- avvio ---------- */
  function init() {
    var qm = new URLSearchParams(location.search).get("mode"), saved = null; try { saved = localStorage.getItem("zdos-defi-mode"); } catch (e) {}
    setMode(qm || saved || "normale");
    $$(".tabs button").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });
    $$(".mode button").forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });
    $("#wbtn").addEventListener("click", openWallet); $("#wm-x").addEventListener("click", function () { $("#wm").hidden = true; });
    $("#wm").addEventListener("click", function (e) { if (e.target.id === "wm") $("#wm").hidden = true; });
    $("#s-amt").addEventListener("input", requote); $("#s-in").addEventListener("change", function () { requote(); refreshBalHints(); }); $("#s-outm").addEventListener("change", function () { requote(); refreshBalHints(); });
    $("#s-flip").addEventListener("click", function () { var a = $("#s-in").value; $("#s-in").value = $("#s-outm").value; $("#s-outm").value = a; requote(); refreshBalHints(); });
    $$(".slip button").forEach(function (b) { b.addEventListener("click", function () { S.slip = +b.dataset.slip; $$(".slip button").forEach(function (x) { x.classList.toggle("on", x === b); }); requote(); }); });
    $("#s-ack").addEventListener("change", updateSwapBtn); $("#s-go").addEventListener("click", goSwap);
    $$("#lp-st button").forEach(function (b) { b.addEventListener("click", function () { S.st = b.dataset.st; $$("#lp-st button").forEach(function (x) { x.classList.toggle("on", x === b); }); }); });
    ["#lp-l", "#lp-r"].forEach(function (s) { $(s).addEventListener("input", lpRange); });
    ["#lp-x", "#lp-y"].forEach(function (s) { $(s).addEventListener("input", updateLpBtn); }); $("#lp-ack").addEventListener("change", updateLpBtn); $("#lp-go").addEventListener("click", goLp);
    $("#c-quote").addEventListener("click", composeQuotes);
    window.addEventListener("resize", moveInk); window.addEventListener("hashchange", function () { setTab(location.hash.slice(1) || "swap", true); });
    setTab((location.hash || "#swap").slice(1), true);
    loadOverview(); loadEco(); setInterval(loadEco, 60000); setInterval(function () { if (!document.hidden) loadOverview(); }, 90000);
    renderWallet();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
