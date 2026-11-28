/* OurVelvet Creator — © 2026 ZDOS1.3. Vanilla JS, nessuna dipendenza esterna, nessun dato inventato.
   Profili, post, like, follow e segnalazioni arrivano dall'API reale /api/social/* (identità = firma OurVelvet).
   Altri dati live: /api/firma/*, /api/velvet-ai/status e /chat, /api/domcoin/lsd-live. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var toastT; function toast(t) { var b = $("#toast"); b.textContent = t; b.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { b.classList.remove("on"); }, 2200); }
  function getJson(u, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 6000);
    return fetch(u, { cache: "no-store", signal: c.signal }).then(function (r) { clearTimeout(t); return r.json(); });
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- filtro di sicurezza: solo adulti, solo consenso ---------- */
  var BLOCK = /(minor\w*|bambin\w*|ragazzin\w*|\bteen\w*|lolit\w*|under\s*-?\s*18|infant\w*|scolar\w*|studentess\w*|liceal\w*|adolescen\w*|\bchild\w*|\bkids?\b|\bstep\s*-?\s*\w+|patrign\w*|matrign\w*|figliast\w*|incest\w*|stupr\w*|forzat\w*|non\s*consensual\w*|senza\s+consenso|\brape\w*|\b(1[0-7]|[0-9])\s*(anni|years?|yo|y\/o)\b)/i;
  function guard(text, out) {
    if (BLOCK.test(text || "")) {
      if (out) { out.textContent = "Questa descrizione contiene un termine non ammesso (minori, legami «step», non consenso). Riscrivila con soli adulti e consenso."; out.className = "guard bad"; }
      return false;
    }
    if (out) { out.textContent = ""; out.className = "guard"; }
    return true;
  }

  /* ---------- emblemi SVG originali (nessun volto, nessuna figura umana) ---------- */
  var GLYPH = {
    crown: '<path d="M26 84 L30 46 L43 62 L50 40 L57 62 L70 46 L74 84 Z"/><rect x="26" y="88" width="48" height="7" rx="3"/>',
    moon: '<path d="M62 36 A29 29 0 1 0 62 94 A23 23 0 1 1 62 36 Z"/>',
    bolt: '<path d="M56 30 L32 72 H48 L43 100 L70 56 H53 Z"/>',
    rose: '<g><circle cx="50" cy="48" r="13"/><circle cx="64" cy="62" r="13"/><circle cx="50" cy="76" r="13"/><circle cx="36" cy="62" r="13"/><circle cx="50" cy="62" r="9" fill="#1b0b2e"/></g>',
    note: '<ellipse cx="42" cy="86" rx="13" ry="10"/><rect x="52" y="38" width="6" height="48"/><path d="M58 38 Q78 44 74 66 Q68 52 58 54Z"/>',
    keyhole: '<circle cx="50" cy="58" r="16"/><path d="M41 68 L59 68 L65 100 L35 100 Z"/>',
    star: '<path d="M50 30 L58 52 L82 54 L63 69 L70 92 L50 78 L30 92 L37 69 L18 54 L42 52 Z"/>',
    flame: '<path d="M50 28 C72 54 76 70 67 87 C60 99 40 99 33 87 C25 72 37 58 50 28Z"/>',
    mask: '<path d="M22 52 Q50 36 78 52 Q78 84 50 96 Q22 84 22 52Z"/><ellipse cx="37" cy="64" rx="8" ry="5" fill="#1b0b2e"/><ellipse cx="63" cy="64" rx="8" ry="5" fill="#1b0b2e"/>',
    feather: '<path d="M72 30 Q28 48 33 100 Q68 82 72 30Z"/><path d="M33 100 L56 64" stroke="#1b0b2e" stroke-width="2" fill="none"/>'
  };
  var EMB = 0;
  function emblem(seed, h1, h2, glyph, wide) {
    var r = hash(seed), id = "g" + r.toString(36) + "_" + (++EMB);
    var dots = "";
    for (var i = 0; i < 7; i++) {
      var x = (hash(seed + i) % 90) + 5, y = (hash(seed + "y" + i) % 120) + 6, rad = 1.5 + (hash(seed + "r" + i) % 30) / 10, d = 4 + (i % 4) * 1.7;
      dots += '<circle cx="' + x + '" cy="' + y + '" r="' + rad.toFixed(1) + '" fill="#fff" opacity="' + (0.25 + (i % 3) * 0.15) + '" style="animation:float ' + d + 's ease-in-out ' + (-i) + 's infinite"/>';
    }
    return '<svg viewBox="0 0 100 133" preserveAspectRatio="' + (wide ? "xMidYMid slice" : "xMidYMid slice") + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustrazione stilizzata">' +
      '<defs><linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + h1 + ',70%,26%)"/><stop offset="1" stop-color="hsl(' + h2 + ',75%,14%)"/></linearGradient>' +
      '<radialGradient id="' + id + 'b" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="hsl(' + h1 + ',90%,62%)" stop-opacity=".75"/><stop offset="1" stop-color="hsl(' + h1 + ',90%,62%)" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c9"/><stop offset="1" stop-color="#f5c36c"/></linearGradient></defs>' +
      '<rect width="100" height="133" fill="url(#' + id + 'a)"/><circle cx="50" cy="60" r="46" fill="url(#' + id + 'b)"/>' +
      '<circle cx="50" cy="62" r="34" fill="none" stroke="rgba(245,195,108,.35)" stroke-width=".8" stroke-dasharray="2 3"/>' +
      dots + '<g fill="url(#' + id + 'c)" stroke="rgba(255,255,255,.55)" stroke-width=".6" style="filter:drop-shadow(0 0 4px rgba(245,195,108,.6))">' + (GLYPH[glyph] || GLYPH.star) + '</g></svg>';
  }

  /* ---------- dati statici (categorie, personaggi AI di OurVelvet, stili) ---------- */
  var CATS = ["Tutti", "Cartoon", "Anime-style", "Cyber", "Gotico", "Fantasy", "Burlesque", "Roleplay", "Narrativa", "Musica", "Arte", "AI"];
  var AI_FALLBACK = [
    { id: "rubina", n: "Rubina Mistress", r: "Sovereign Protocol", g: "crown", a: 335, c: 275 },
    { id: "zara", n: "Velvet AGI", r: "Scene & Club AI", g: "star", a: 275, c: 190 },
    { id: "kali", n: "Kali", r: "Cyber-Velvet Node", g: "bolt", a: 190, c: 330 }
  ];
  var AIDESC = { rubina: "Compagna narrativa: imposta la scena, il tono e i limiti prima di iniziare.", zara: "Assistente di scene e serate: idee, copioni e atmosfere per i tuoi contenuti.", kali: "Nodo cyber-velvet: strumenti per prompt, tag e coerenza dei personaggi." };
  var STYLES = [
    { id: "cartoon", n: "Cartoon", d: "Linee nette, colori pieni", a: 330, c: 270 },
    { id: "anime", n: "Anime-style", d: "Adulti, tratto da manga", a: 280, c: 200 },
    { id: "noir", n: "Noir", d: "Bianco, nero, rosso", a: 350, c: 240 },
    { id: "neon", n: "Neon", d: "Cyber, luci al neon", a: 190, c: 300 },
    { id: "pittorico", n: "Pittorico", d: "Velluto e olio", a: 30, c: 330 },
    { id: "fumetto", n: "Fumetto", d: "Tavole e retini", a: 160, c: 280 }
  ];
  var GLYPHS = ["crown", "moon", "bolt", "rose", "note", "keyhole", "star", "flame", "mask", "feather"];
  function look(seed) { var h = hash(seed); return { g: GLYPHS[h % GLYPHS.length], a: h % 360, c: (h >>> 9) % 360 }; }

  /* ---------- API social ---------- */
  function api(method, path, body, raw) {
    var o = { method: method, credentials: "same-origin", cache: "no-store", headers: { "X-OV-Social": "1" } };
    if (raw) { o.body = raw; o.headers["Content-Type"] = raw.type; }
    else if (body !== undefined) { o.body = JSON.stringify(body); o.headers["Content-Type"] = "application/json"; }
    return fetch("/api/social" + path, o).then(function (r) { return r.json().catch(function () { return { ok: false, errore: "Risposta non valida (" + r.status + ")" }; }).then(function (j) { j.__s = r.status; return j; }); });
  }
  var ME = { addr: null, prof: null };

  /* ---------- navigazione a viste (hash, nessun redirect) ---------- */
  var TITLES = { esplora: "Esplora", crea: "Crea", feed: "Feed", ai: "AI", monete: "Dom-Coin & VELVET", profilo: "Il mio profilo" };
  function show(v) {
    if (!TITLES[v]) v = "esplora";
    var dd = document.getElementById("dlg"); if (dd && dd.open) dd.close();
    $$("[data-view]").forEach(function (s) { s.hidden = s.getAttribute("data-view") !== v; });
    $$("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === v); });
    $("#topTitle").textContent = TITLES[v];
    document.title = TITLES[v] + " · Creator · OurVelvet";
    window.scrollTo(0, 0);
    $$(".reveal", $("#v-" + v)).forEach(function (n) { n.classList.add("in"); });
    if (window.ZDOSGA && window.gtag && window.ZDOSGA.active) window.gtag("event", "page_view", { page_title: TITLES[v], page_location: location.href });
  }
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)); });

  /* ---------- Esplora: creator reali + personaggi AI ---------- */
  var state = { cat: "Tutti", q: "", ai: AI_FALLBACK.map(function (x) { return x; }), creators: [], loaded: false };
  function cardEl(c, kind) {
    var b = el("button", "card"); b.type = "button"; b.setAttribute("aria-label", c.n + ", " + c.r);
    var art = el("div", "art");
    if (c.img) { var im = el("img"); im.src = c.img; im.alt = ""; im.loading = "lazy"; art.appendChild(im); } else art.innerHTML = emblem(c.id, c.a, c.c, c.g);
    b.appendChild(art);
    var bd = el("div", "badges"); bd.appendChild(el("span", "b18", "18+")); bd.appendChild(el("span", "bex", kind === "ai" ? "AI" : kind === "draft" ? "Bozza" : c.v ? "✓ Wallet verificato" : "Creator")); b.appendChild(bd);
    b.appendChild(el("span", "glint"));
    var info = el("div", "info"); info.appendChild(el("h4", "", c.n)); info.appendChild(el("p", "", c.r + (c.b ? " · " + c.b : "")));
    var tg = el("div", "tags"); (c.t || []).forEach(function (t) { tg.appendChild(el("span", "tag", t)); }); info.appendChild(tg); b.appendChild(info);
    return b;
  }
  function crCard(p) { var l = look(p.handle); return { id: p.handle, n: "@" + p.handle, r: p.follower + " follower · " + p.post + " post", b: p.bio, t: p.cats, g: l.g, a: l.a, c: l.c, img: p.avatar, v: p.verificato, p: p }; }
  function aiCards() { return state.ai.map(function (a) { return { id: a.id, n: a.n, r: a.r + " (AI)", b: AIDESC[a.id] || "", t: ["AI"].concat(a.id === "kali" ? ["Cyber"] : a.id === "zara" ? ["Musica"] : ["Roleplay"]), g: a.g, a: a.a, c: a.c, ai: true }; }); }
  function match(c) { var q = state.q.toLowerCase(); return (state.cat === "Tutti" || c.t.indexOf(state.cat) >= 0) && (!q || (c.n + " " + c.r + " " + c.b + " " + c.t.join(" ")).toLowerCase().indexOf(q) >= 0); }
  function renderGrid() {
    var g = $("#grid"), ga = $("#gridAi"); g.textContent = ""; ga.textContent = "";
    var n = 0;
    if (!state.loaded) { for (var i = 0; i < 3; i++) g.appendChild(el("div", "skel")); }
    state.creators.map(crCard).forEach(function (c) { if (!match(c)) return; var d = cardEl(c, "cr"); d.addEventListener("click", function () { openCreator(c.p.handle); }); g.appendChild(d); n++; });
    aiCards().forEach(function (c) { if (!match(c)) return; var d = cardEl(c, "ai"); d.addEventListener("click", function () { openAI(c); }); ga.appendChild(d); });
    var none = state.loaded && state.creators.length === 0;
    $("#firstBox").hidden = !none; $("#crT").hidden = none || !state.loaded;
    $("#empty").hidden = !state.loaded || none || n > 0; bindTilt();
  }
  function loadCreators() {
    api("GET", "/creators").then(function (j) { state.creators = (j && j.ok && j.creator) || []; state.loaded = true; renderGrid(); })
      .catch(function () { state.loaded = true; renderGrid(); });
  }
  function renderCats() {
    var box = $("#cats"); CATS.forEach(function (c) {
      var b = el("button", "chip" + (c === state.cat ? " on" : ""), c); b.type = "button"; b.setAttribute("role", "tab");
      b.addEventListener("click", function () { state.cat = c; $$(".chip", box).forEach(function (x) { x.classList.toggle("on", x === b); }); renderGrid(); });
      box.appendChild(b);
    });
    $("#q").addEventListener("input", function (e) { state.q = e.target.value.trim(); renderGrid(); });
  }
  function dlg() {
    var d = $("#dlg"); if (!d) { d = document.createElement("dialog"); d.id = "dlg"; d.className = "glass"; d.style.cssText = "max-width:460px;width:92vw;color:#f6eefc;padding:0;border:1px solid rgba(255,255,255,.14);overflow:hidden;max-height:90vh;overflow-y:auto"; document.body.appendChild(d); d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); }
    d.textContent = ""; return d;
  }
  function openDlg(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute("open", ""); }
  function openAI(c) {
    var d = dlg(); var a = el("div", ""); a.style.cssText = "height:190px"; a.innerHTML = emblem(c.id, c.a, c.c, c.g); d.appendChild(a);
    var b = el("div", "pad"); b.appendChild(el("h3", "", c.n)); b.appendChild(el("p", "muted", c.r)); b.appendChild(el("p", "", c.b || ""));
    b.appendChild(el("p", "fine", "Personaggio AI di OurVelvet. Adulto (18+), solo consenso. Safeword ROSSO."));
    var r = el("div", "dlg-acts"); var ch = el("button", "btn primary sm", "Parla in chat"); ch.type = "button";
    ch.addEventListener("click", function () { d.close(); chat.pick(c.id); location.hash = "#ai"; setTimeout(function () { $("#chatBox").scrollIntoView({ behavior: "smooth" }); }, 60); }); r.appendChild(ch);
    var cl = el("button", "btn ghost sm", "Chiudi"); cl.type = "button"; cl.addEventListener("click", function () { d.close(); }); r.appendChild(cl);
    b.appendChild(r); d.appendChild(b); openDlg(d);
  }
  function openCreator(handle) {
    var d = dlg(); d.appendChild(el("div", "pad", "Carico il profilo…")); openDlg(d);
    api("GET", "/creators/" + encodeURIComponent(handle)).then(function (j) {
      d.textContent = "";
      if (!j.ok) { d.appendChild(el("div", "pad", j.errore || "Profilo non disponibile.")); return; }
      var p = j.profilo, l = look(p.handle), a = el("div", ""); a.style.cssText = "height:190px;position:relative";
      if (p.avatar) { var im = el("img"); im.src = p.avatar; im.alt = "Avatar di @" + p.handle; im.style.cssText = "width:100%;height:100%;object-fit:cover"; a.appendChild(im); } else a.innerHTML = emblem(p.handle, l.a, l.c, l.g);
      d.appendChild(a);
      var b = el("div", "pad"); var h = el("h3", "", "@" + p.handle); if (p.verificato) h.appendChild(el("span", "vbadge", "✓ wallet verificato")); b.appendChild(h);
      b.appendChild(el("p", "muted", p.follower + " follower · " + p.seguiti + " seguiti · " + p.post + " post · su OurVelvet dal " + p.dal.split("-").reverse().join("/")));
      if (p.bio) b.appendChild(el("p", "", p.bio));
      var tg = el("div", "tags chips"); tg.style.marginTop = "10px"; p.cats.forEach(function (t) { tg.appendChild(el("span", "tag", t)); }); b.appendChild(tg);
      if (p.verificato && p.wallet) b.appendChild(el("p", "fine", "Wallet: " + short(p.wallet) + " (badge pubblico scelto dal creator)"));
      var r = el("div", "dlg-acts");
      if (!p.mio) {
        var fb = el("button", "btn primary sm", p.segui ? "Segui già" : "Segui"); fb.type = "button";
        fb.addEventListener("click", function () { need(function () { api("POST", "/creators/" + p.handle + "/follow", {}).then(function (x) { if (!x.ok) return toast(x.errore); p.segui = x.segui; fb.textContent = x.segui ? "Segui già" : "Segui"; toast(x.segui ? "Ora segui @" + p.handle : "Non segui più @" + p.handle); loadFeed(true); }); }); });
        r.appendChild(fb);
        var bl = el("button", "btn ghost sm", p.bloccato ? "Sblocca" : "Blocca"); bl.type = "button";
        bl.addEventListener("click", function () { need(function () { if (!p.bloccato && !confirm("Bloccare @" + p.handle + "? Non vedrete più i rispettivi contenuti.")) return; api("POST", "/creators/" + p.handle + "/block", {}).then(function (x) { if (!x.ok) return toast(x.errore); toast(x.bloccato ? "Bloccato" : "Sbloccato"); d.close(); loadCreators(); loadFeed(true); refreshMe(); }); }); });
        r.appendChild(bl);
        var rp = el("button", "btn ghost sm danger", "Segnala"); rp.type = "button"; rp.addEventListener("click", function () { report("profile", p.handle); }); r.appendChild(rp);
      } else r.appendChild(el("span", "fine", "Questo è il tuo profilo."));
      var cl = el("button", "btn ghost sm", "Chiudi"); cl.type = "button"; cl.addEventListener("click", function () { d.close(); }); r.appendChild(cl);
      b.appendChild(r);
      if (j.post && j.post.length) { b.appendChild(el("h3", "mt", "Post")); j.post.forEach(function (x) { b.appendChild(postEl(x)); }); }
      else b.appendChild(el("p", "fine mt", "Nessun post pubblico per ora."));
      d.appendChild(b);
    });
  }
  function need(fn) { if (ME.addr && ME.prof) return fn(); if (window.ZDOSGA) {} toast(ME.addr ? "Crea prima il tuo profilo creator" : "Accedi con OurVelvet per continuare"); var d = $("#dlg"); if (d && d.open) d.close(); location.hash = "#profilo"; }
  function report(kind, target) {
    need(function () {
      var why = prompt("Perché segnali questo " + (kind === "post" ? "post" : "profilo") + "? (es. minori, non consenso, spam, contenuto esplicito)");
      if (!why || why.trim().length < 3) return;
      api("POST", "/report", { kind: kind, target: target, reason: why.trim() }).then(function (x) { toast(x.ok ? "Segnalazione inviata allo staff" : x.errore); if (x.ok && x.nascosto) loadFeed(true); });
    });
  }

  /* ---------- tilt delle card (solo puntatori fini) ---------- */
  function bindTilt() {
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches || window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    $$(".card").forEach(function (c) {
      if (c.__t) return; c.__t = 1;
      c.addEventListener("pointermove", function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = "perspective(700px) rotateY(" + (x * 9).toFixed(2) + "deg) rotateX(" + (-y * 9).toFixed(2) + "deg) translateY(-4px)"; });
      c.addEventListener("pointerleave", function () { c.style.transform = ""; });
    });
  }

  /* ---------- Crea ---------- */
  var cur = { style: STYLES[0], tags: [], card: null };
  function renderModels() {
    var box = $("#models");
    STYLES.forEach(function (s, i) {
      var b = el("button", "model" + (i === 0 ? " on" : "")); b.type = "button";
      b.innerHTML = '<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="m' + i + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + s.a + ',70%,32%)"/><stop offset="1" stop-color="hsl(' + s.c + ',75%,16%)"/></linearGradient></defs><rect width="100" height="60" fill="url(#m' + i + ')"/><circle cx="30" cy="30" r="14" fill="hsl(' + s.a + ',90%,64%)" opacity=".7"/><path d="M0 52 Q30 28 56 46 T100 34 V60 H0Z" fill="rgba(0,0,0,.35)"/></svg>';
      b.appendChild(el("span", "", s.n)).appendChild(el("small", "", s.d));
      b.addEventListener("click", function () { cur.style = s; $$(".model", box).forEach(function (x) { x.classList.toggle("on", x === b); }); });
      box.appendChild(b);
    });
    var tp = $("#tagpick");
    CATS.slice(1, 11).forEach(function (t) {
      var b = el("button", "chip", t); b.type = "button";
      b.addEventListener("click", function () { var k = cur.tags.indexOf(t); if (k < 0) cur.tags.push(t); else cur.tags.splice(k, 1); b.classList.toggle("on", k < 0); });
      tp.appendChild(b);
    });
    var p = $("#prompt"); p.addEventListener("input", function () { $("#pcount").textContent = p.value.length + "/400"; });
    $("#mk").addEventListener("click", makeCard);
    $("#cp").addEventListener("click", function () { var t = $("#prompt").value; if (!t) return toast("Niente da copiare"); copy(t); });
    $("#toStudio").addEventListener("click", function () { var t = $("#prompt").value; if (t && navigator.clipboard) navigator.clipboard.writeText(t).catch(function () {}); });
    renderDrafts();
  }
  function nameFrom(t) { var w = t.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 3).join(" "); return (w || "Nuovo personaggio").slice(0, 28); }
  function makeCard() {
    var t = $("#prompt").value.trim(), g = $("#guard");
    if (t.length < 12) { g.textContent = "Scrivi almeno una frase per descrivere il personaggio."; g.className = "guard bad"; return; }
    if (!guard(t, g)) return;
    var glyphs = Object.keys(GLYPH), h = hash(t);
    var c = { id: "u" + h.toString(36), n: nameFrom(t), r: cur.style.n, b: t.slice(0, 120), t: cur.tags.length ? cur.tags.slice(0, 4) : [cur.style.n], g: glyphs[h % glyphs.length], a: cur.style.a, c: cur.style.c, own: true };
    cur.card = c;
    var pv = $("#preview"); pv.textContent = ""; var cd = cardEl(c, "ex"); cd.querySelector(".bex").textContent = "Bozza"; pv.appendChild(cd);
    var all = LS.get("ov-cr-drafts", []); all.unshift({ n: c.n, s: cur.style.n, t: t, tags: c.t, at: Date.now() }); LS.set("ov-cr-drafts", all.slice(0, 8));
    g.textContent = "Scheda salvata sul tuo dispositivo."; g.className = "guard ok"; renderDrafts(); bindTilt();
  }
  function renderDrafts() {
    var box = $("#drafts"), all = LS.get("ov-cr-drafts", []); box.textContent = "";
    if (!all.length) { box.appendChild(el("p", "muted", "Nessuna bozza.")); return; }
    all.forEach(function (d, i) {
      var r = el("div", "draft"); r.appendChild(el("span", "", d.n + " · " + d.s));
      var x = el("button", "", "Elimina"); x.type = "button"; x.addEventListener("click", function () { var a = LS.get("ov-cr-drafts", []); a.splice(i, 1); LS.set("ov-cr-drafts", a); renderDrafts(); });
      r.appendChild(x); box.appendChild(r);
    });
  }
  function copy(t) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Copiato"); }, function () { toast("Copia non riuscita"); }); else toast("Copia non disponibile"); }

  /* ---------- Feed reale ---------- */
  var feed = { scope: "tutti", oldest: 0, img: null };
  function when(t) { var s = Math.floor(Date.now() / 1000) - t; if (s < 60) return "adesso"; if (s < 3600) return Math.floor(s / 60) + " min fa"; if (s < 86400) return Math.floor(s / 3600) + " h fa"; return new Date(t * 1000).toLocaleDateString("it-IT"); }
  var STATI = { pubblico: "pubblico", in_revisione: "in revisione", rifiutato: "rifiutato", nascosto: "nascosto dallo staff" };
  function postEl(p) {
    var a = el("article", "glass post");
    var h = el("div", "post-h"), av = el("div", "av"), l = look(p.autore.handle);
    if (p.autore.avatar) { var im = el("img"); im.src = p.autore.avatar; im.alt = ""; im.loading = "lazy"; av.appendChild(im); } else av.innerHTML = emblem(p.autore.handle, l.a, l.c, l.g);
    h.appendChild(av);
    var w = el("button", "who"); w.type = "button"; var nm = el("b", "", "@" + p.autore.handle); if (p.autore.verificato) nm.appendChild(el("span", "vbadge", "✓")); w.appendChild(nm);
    var sm = el("small", "", when(p.creato)); if (p.stato) sm.appendChild(el("span", "st " + p.stato, STATI[p.stato] || p.stato)); w.appendChild(sm);
    w.addEventListener("click", function () { openCreator(p.autore.handle); }); h.appendChild(w); a.appendChild(h);
    if (p.text) a.appendChild(el("p", "", p.text));
    if (p.media) { var m = el("div", "media"), mi = el("img"); mi.src = p.media; mi.alt = "Immagine del post"; mi.loading = "lazy"; m.appendChild(mi); a.appendChild(m); }
    var ac = el("div", "acts");
    var lk = el("button", p.piace ? "on" : "", (p.piace ? "♥ " : "♡ ") + p.like); lk.type = "button"; lk.setAttribute("aria-label", "Mi piace");
    if (p.stato && p.stato !== "pubblico") lk.disabled = true;
    lk.addEventListener("click", function () { need(function () { api("POST", "/posts/" + p.id + "/like", {}).then(function (x) { if (!x.ok) return toast(x.errore); p.piace = x.piace; p.like = x.like; lk.classList.toggle("on", x.piace); lk.textContent = (x.piace ? "♥ " : "♡ ") + x.like; }); }); });
    ac.appendChild(lk); ac.appendChild(el("span", "sp"));
    if (p.mio) { var rm = el("button", "", "Elimina"); rm.type = "button"; rm.addEventListener("click", function () { if (!confirm("Eliminare il post?")) return; api("DELETE", "/posts/" + p.id).then(function (x) { toast(x.ok ? "Post eliminato" : x.errore); loadFeed(true); refreshMe(); }); }); ac.appendChild(rm); }
    else { var rp = el("button", "", "Segnala"); rp.type = "button"; rp.addEventListener("click", function () { report("post", p.id); }); ac.appendChild(rp); }
    a.appendChild(ac); return a;
  }
  function loadFeed(reset) {
    if (reset) { feed.oldest = 0; $("#posts").textContent = ""; }
    if (feed.scope === "seguiti" && !ME.addr) { $("#feedEmpty").hidden = false; $("#feedEmptyT").textContent = "Accedi per vedere chi segui"; $("#feedEmptyP").textContent = "Il feed «Chi segui» mostra i post dei creator che segui."; $("#more").hidden = true; return; }
    api("GET", "/feed?scope=" + feed.scope + (feed.oldest ? "&prima=" + feed.oldest : "")).then(function (j) {
      var box = $("#posts"), list = (j && j.post) || [];
      list.forEach(function (p) { box.appendChild(postEl(p)); feed.oldest = p.creato; });
      var empty = !box.children.length; $("#feedEmpty").hidden = !empty;
      if (empty) { $("#feedEmptyT").textContent = feed.scope === "seguiti" ? "Nessun post da chi segui" : "Il feed è ancora vuoto"; $("#feedEmptyP").textContent = feed.scope === "seguiti" ? "Segui qualche creator da Esplora: i loro post compariranno qui." : "Scrivi il primo post: sarà il primo di tutta la community."; }
      $("#more").hidden = list.length < 30;
      var tg = {}; state.creators.forEach(function (c) { c.cats.forEach(function (t) { tg[t] = (tg[t] || 0) + 1; }); });
      var tr = $("#trend"); tr.textContent = ""; var keys = Object.keys(tg).sort(function (a, b) { return tg[b] - tg[a]; });
      if (!keys.length) tr.appendChild(el("span", "muted", "Compaiono quando i creator scelgono le categorie."));
      keys.forEach(function (t) { var b = el("button", "chip", "#" + t); b.type = "button"; b.addEventListener("click", function () { state.cat = t; $$("#cats .chip").forEach(function (x) { x.classList.toggle("on", x.textContent === t); }); renderGrid(); location.hash = "#esplora"; }); tr.appendChild(b); });
    }).catch(function () { $("#feedEmpty").hidden = false; $("#feedEmptyT").textContent = "Feed non raggiungibile ora"; $("#feedEmptyP").textContent = "Riprova tra poco."; });
  }
  function setImg(f) {
    var g = $("#postGuard");
    if (!f) { feed.img = null; $("#imgPrev").hidden = true; $("#postImg").value = ""; return; }
    if (["image/jpeg", "image/png", "image/webp"].indexOf(f.type) < 0) { g.textContent = "Formato non ammesso: solo JPG, PNG o WebP."; g.className = "guard bad"; return; }
    if (f.size > 5 * 1024 * 1024) { g.textContent = "Immagine troppo grande: massimo 5 MB."; g.className = "guard bad"; return; }
    feed.img = f; $("#imgPrevI").src = URL.createObjectURL(f); $("#imgPrev").hidden = false; g.textContent = ""; g.className = "guard";
  }
  function bindFeed() {
    var t = $("#postTxt"); t.addEventListener("input", function () { $("#pc2").textContent = t.value.length + "/500"; });
    $("#postImg").addEventListener("change", function (e) { setImg(e.target.files[0]); });
    $("#imgRm").addEventListener("click", function () { setImg(null); });
    $$(".seg .chip").forEach(function (b) { b.addEventListener("click", function () { feed.scope = b.getAttribute("data-scope"); $$(".seg .chip").forEach(function (x) { x.classList.toggle("on", x === b); }); loadFeed(true); }); });
    $("#more").addEventListener("click", function () { loadFeed(false); });
    $("#postBtn").addEventListener("click", function () {
      var v = t.value.trim(), g = $("#postGuard"), btn = $("#postBtn");
      if (!v && !feed.img) { g.textContent = "Scrivi qualcosa o allega un'immagine."; g.className = "guard bad"; return; }
      if (v && !guard(v, g)) return;
      btn.disabled = true; g.textContent = feed.img ? "Carico l'immagine…" : "Pubblico…"; g.className = "guard";
      var step = feed.img ? api("POST", "/media", undefined, feed.img) : Promise.resolve({ ok: true });
      step.then(function (m) {
        if (!m.ok) throw new Error(m.errore || "Caricamento non riuscito");
        return api("POST", "/posts", { text: v, media: m.media || null });
      }).then(function (x) {
        btn.disabled = false;
        if (!x.ok) { g.textContent = x.errore; g.className = "guard bad"; return; }
        t.value = ""; $("#pc2").textContent = "0/500"; setImg(null);
        g.textContent = x.stato === "in_revisione" ? "Post inviato: con l'immagine passa prima dalla revisione dello staff, poi diventa pubblico." : "Pubblicato."; g.className = "guard ok";
        loadFeed(true); refreshMe();
      }).catch(function (e) { btn.disabled = false; g.textContent = e.message; g.className = "guard bad"; });
    });
  }

  /* ---------- AI ---------- */
  var TAGKW = { Gotico: /gotic|candel|vampir|cripta|oscur/i, Narrativa: /racconto|storia|storie|capitol|narrat|romanz/i, Roleplay: /ruolo|roleplay|scena|personagg|copione/i, Cyber: /cyber|neon|futur|robot|android/i, Cartoon: /cartoon|vignett|fumett|illustraz/i, "Anime-style": /anime|manga/i, Fantasy: /fantasy|elf|drag|magi|creatur/i, Burlesque: /burlesque|piume|teatro|cabaret|glitter/i, Musica: /music|playlist|brano|canzon|podcast|voce/i, Arte: /arte|disegn|dipint|illustr|tavol/i, AI: /\bai\b|intelligenza artificiale|assistente/i };
  function bindTagAssist() {
    var i = $("#tagIn"), o = $("#tagOut");
    i.addEventListener("input", function () {
      o.textContent = ""; var v = i.value; if (!v.trim()) return;
      if (!guard(v, null)) { o.appendChild(el("span", "guard bad", "Testo non ammesso: solo adulti e consenso.")); return; }
      var hit = Object.keys(TAGKW).filter(function (k) { return TAGKW[k].test(v); });
      if (!hit.length) o.appendChild(el("span", "muted", "Nessun tag suggerito: aggiungi qualche dettaglio sullo stile o sul tema."));
      hit.forEach(function (k) { o.appendChild(el("span", "chip on", "#" + k)); });
    });
  }
  function loadAI() {
    var dot = $("#aiDot"), tx = $("#aiTxt");
    getJson("/api/velvet-ai/status", 7000).then(function (j) {
      if (!j || !j.ok) throw new Error("no");
      var chars = (j.characters || []).slice(0, 6), look = { rubina: AI_FALLBACK[0], zara: AI_FALLBACK[1], kali: AI_FALLBACK[2] };
      state.ai = chars.map(function (c, k) { var b = look[c.id] || AI_FALLBACK[k % 3]; return { id: c.id, n: c.name, r: c.role, g: b.g, a: b.a, c: b.c }; });
      dot.className = "dot " + (j.bridgeAlive ? "on" : "off");
      tx.textContent = (j.bridgeAlive ? "Servizio AI attivo" : "Servizio AI raggiungibile, generazione ferma") + " · " + chars.length + " personaggi · " + (j.models || []).length + " modelli";
      renderAI(); renderGrid();
    }).catch(function () { dot.className = "dot off"; tx.textContent = "Servizio AI non raggiungibile ora: mostro i personaggi senza stato live."; renderAI(); });
  }
  function renderAI() {
    var box = $("#aiCards"); box.textContent = "";
    state.ai.forEach(function (a) {
      var c = { id: a.id, n: a.n, r: a.r, b: AIDESC[a.id] || "Personaggio AI di OurVelvet.", t: ["AI"], g: a.g, a: a.a, c: a.c, ai: true };
      var d = cardEl(c, "ai"); d.classList.add("ai-card"); d.addEventListener("click", function () { openAI(c); }); box.appendChild(d);
    });
    bindTilt(); renderChatChars();
  }

  /* ---------- Chat AI (velvet-ai /chat, con la sessione OurVelvet dell'utente) ---------- */
  var chat = { id: "rubina", pick: function (id) { chat.id = id; $$("#chatChars .chip").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-id") === id); }); } };
  function renderChatChars() {
    var box = $("#chatChars"); box.textContent = "";
    state.ai.forEach(function (a) { var b = el("button", "chip" + (a.id === chat.id ? " on" : ""), a.n); b.type = "button"; b.setAttribute("data-id", a.id); b.addEventListener("click", function () { chat.pick(a.id); }); box.appendChild(b); });
  }
  function bubble(cls, txt, meta) { var m = el("div", "msg " + cls, txt); if (meta) m.appendChild(el("small", "", meta)); var log = $("#chatLog"); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
  function bindChat() {
    var inp = $("#chatTxt"), g = $("#chatGuard");
    function sendMsg() {
      var v = inp.value.trim(); if (!v) return;
      if (!ME.addr) { g.textContent = "Accedi con OurVelvet per usare la chat: la sessione resta tua, i messaggi non sono pubblici."; g.className = "guard bad"; return; }
      if (/^\s*rosso\s*$/i.test(v)) { inp.value = ""; $("#chatLog").textContent = ""; bubble("ai", "Scena interrotta. Safeword ROSSO ricevuta: ci fermiamo qui. Riprendi solo se e quando vuoi.", "OurVelvet"); return; }
      if (!guard(v, g)) return;
      var h = $("#chatHint"); if (h) h.remove();
      bubble("me", v); inp.value = ""; $("#chatSend").disabled = true;
      var wait = bubble("ai", "…");
      fetch("/api/velvet-ai/chat", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: v, characterId: chat.id }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          $("#chatSend").disabled = false; wait.remove();
          if (!j.ok) { bubble("ai", j.error || "Il servizio AI non ha risposto.", "errore"); return; }
          bubble("ai", j.message.replyText, j.message.characterName + " · " + j.costLsd + " L$D (saldo demo del servizio: " + j.lsdBalance + ")");
        }).catch(function () { $("#chatSend").disabled = false; wait.remove(); bubble("ai", "Servizio AI non raggiungibile ora.", "errore"); });
    }
    $("#chatSend").addEventListener("click", sendMsg);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });
  }

  /* ---------- Dom-Coin live (solo fatti on-chain; il valore resta «dichiarato») ---------- */
  function loadCoin() {
    getJson("/api/domcoin/lsd-live", 7000).then(function (j) {
      if (!j || !j.ok || j.mintAddress !== "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP") return;
      if (j.totalSupply) $("#lsdSupply").textContent = Number(j.totalSupply).toLocaleString("it-IT") + " (dall'API)";
      if (j.decimals != null) $("#lsdDec").textContent = String(j.decimals);
    }).catch(function () {});
  }

  /* ---------- Profilo: firma OurVelvet + profilo creator reale ---------- */
  function short(a) { return a ? a.slice(0, 4) + "…" + a.slice(-4) : ""; }
  var pf = { cats: [] };
  function renderPfCats() {
    var box = $("#pfCats"); box.textContent = "";
    CATS.slice(1).forEach(function (c) {
      var b = el("button", "chip" + (pf.cats.indexOf(c) >= 0 ? " on" : ""), c); b.type = "button";
      b.addEventListener("click", function () { var k = pf.cats.indexOf(c); if (k >= 0) pf.cats.splice(k, 1); else if (pf.cats.length < 4) pf.cats.push(c); else return toast("Massimo 4 categorie"); renderPfCats(); });
      box.appendChild(b);
    });
  }
  function setAv(url, pending) {
    var a = $("#pfAv"); a.textContent = "";
    if (url) { var im = el("img"); im.src = url; im.alt = ""; a.appendChild(im); a.style.opacity = pending ? ".55" : "1"; }
    else { var l = look(ME.prof ? ME.prof.handle : "nuovo"); a.innerHTML = emblem("me", l.a, l.c, l.g); }
  }
  function setSession(j) {
    var chip = $("#meChip"), out = $("#meOut"), lo = $("#logout"), tl = $("#topLogin");
    out.textContent = "";
    ME.addr = j && j.autenticato ? j.address : null; ME.prof = j && j.profilo ? j.profilo : null;
    $("#composer").classList.toggle("locked", !(ME.addr && ME.prof));
    $("#loginBox").hidden = !!ME.addr;
    if (!ME.addr) {
      chip.hidden = true; lo.hidden = true; tl.textContent = "Accedi con OurVelvet";
      out.appendChild(el("p", "muted", "Non sei connesso. Accedi per creare il profilo, pubblicare e usare la chat AI."));
      $("#pfLock").hidden = false; $("#pfForm").hidden = true; $("#myBox").hidden = true; return;
    }
    chip.hidden = false; chip.textContent = ME.prof ? "@" + ME.prof.handle : short(ME.addr); lo.hidden = false; tl.textContent = ME.prof ? "@" + ME.prof.handle : short(ME.addr);
    out.appendChild(el("p", "muted", "Connesso con firma OurVelvet. Sessione valida fino a " + new Date(j.scade).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) + " (ora di Roma)."));
    out.appendChild(el("div", "addr-big", ME.addr));
    var note = el("p", "fine", "Verifico il badge…"); out.appendChild(note);
    getJson("/api/firma/badge?address=" + encodeURIComponent(ME.addr), 6000).then(function (b) {
      note.textContent = b && b.verificato ? "Il badge «wallet verificato» è pubblico: compare sul tuo profilo creator." : "Il badge pubblico non è attivo: lo scegli quando firmi (spunta «Mostra il badge»).";
    }).catch(function () { note.textContent = ""; });
    $("#pfLock").hidden = true; $("#pfForm").hidden = false;
    if (ME.prof) {
      out.appendChild(el("p", "fine", "Profilo merito: " + (ME.prof.merito ? "collegato (le tue attività entrano nel registro zcomm)" : "nessun profilo OV collegato a questo wallet") + "."));
      $("#pfTitle").textContent = "Il tuo profilo creator · @" + ME.prof.handle + (ME.prof.stato === "sospeso" ? " (sospeso dallo staff)" : "");
      $("#pfHandle").value = ME.prof.handle; $("#pfBio").value = ME.prof.bio; pf.cats = ME.prof.cats.slice(); renderPfCats();
      $("#pfConsents").hidden = true; $("#pfSave").textContent = "Salva modifiche";
      setAv(ME.prof.avatarInRevisione || ME.prof.avatar, !!ME.prof.avatarInRevisione);
      $("#pfAvMsg").textContent = ME.prof.avatarInRevisione ? "Avatar nuovo in revisione: lo vedi solo tu finché lo staff non lo approva." : "JPG, PNG o WebP fino a 5 MB. Ridimensionato a 512×512, metadati rimossi, visibile dopo la revisione dello staff.";
      $("#myBox").hidden = false;
      var mp = $("#myPosts"); mp.textContent = ""; (j.post || []).forEach(function (p) { mp.appendChild(postEl(p)); }); if (!mp.children.length) mp.appendChild(el("p", "muted", "Nessun post. Scrivi il primo dal Feed."));
      api("GET", "/me/blocks").then(function (b) {
        var box = $("#myBlocks"); box.textContent = ""; var l = (b && b.bloccati) || [];
        if (!l.length) box.appendChild(el("p", "muted", "Nessuno."));
        l.forEach(function (h) { var c = el("button", "chip", "@" + h + " · sblocca"); c.type = "button"; c.addEventListener("click", function () { api("POST", "/creators/" + h + "/block", {}).then(function () { toast("Sbloccato"); refreshMe(); loadCreators(); }); }); box.appendChild(c); });
      });
    } else {
      $("#pfTitle").textContent = "Crea il tuo profilo creator"; $("#pfConsents").hidden = false; $("#pfSave").textContent = "Pubblica profilo"; renderPfCats(); setAv(null);
      $("#pfAvMsg").textContent = "Potrai caricare l'avatar dopo aver creato il profilo."; $("#myBox").hidden = true;
    }
    $("#pfAvIn").disabled = !ME.prof;
  }
  function refreshMe() { return api("GET", "/me").then(setSession).catch(function () { setSession(null); }); }
  function bindProfile() {
    document.addEventListener("zdos-firma-login", function (e) { if (e.detail && e.detail.ok) { refreshMe().then(function () { loadFeed(true); loadCreators(); }); toast("Accesso eseguito"); } });
    $("#logout").addEventListener("click", function () { fetch("/api/firma/logout", { method: "POST" }).then(function () { refreshMe(); loadFeed(true); toast("Disconnesso"); }); });
    $("#openTerms").addEventListener("click", function (e) { e.preventDefault(); var t = $("#regole"); t.open = true; t.scrollIntoView({ behavior: "smooth" }); });
    $("#pfSave").addEventListener("click", function () {
      var m = $("#pfMsg"), h = $("#pfHandle").value.trim().replace(/^@/, ""), b = $("#pfBio").value.trim();
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(h)) { m.textContent = "Handle: 3–24 caratteri tra lettere, numeri e _."; m.style.color = "var(--bad)"; return; }
      if (!guard(h + " " + b, null)) { m.textContent = "Testo non ammesso: solo adulti e consenso."; m.style.color = "var(--bad)"; return; }
      var body = { handle: h, bio: b, cats: pf.cats };
      if (!ME.prof) {
        body.maggiorenne = $("#pf18").checked; body.termini = $("#pfTerms").checked; body.consenso = $("#pfConsent").checked;
        if (!body.maggiorenne || !body.termini || !body.consenso) { m.textContent = "Per pubblicare servono le tre conferme: 18+, regolamento e consenso."; m.style.color = "var(--bad)"; return; }
      }
      api("PUT", "/me/profile", body).then(function (x) {
        if (!x.ok) { m.textContent = x.errore; m.style.color = "var(--bad)"; return; }
        m.textContent = x.creato ? "Profilo pubblicato. Benvenuto tra i creator!" : "Modifiche salvate."; m.style.color = "var(--ok)";
        refreshMe(); loadCreators();
      });
    });
    $("#pfAvIn").addEventListener("change", function (e) {
      var f = e.target.files[0], m = $("#pfAvMsg"); if (!f) return;
      if (["image/jpeg", "image/png", "image/webp"].indexOf(f.type) < 0) { m.textContent = "Formato non ammesso: solo JPG, PNG o WebP."; return; }
      if (f.size > 5 * 1024 * 1024) { m.textContent = "Immagine troppo grande: massimo 5 MB."; return; }
      m.textContent = "Carico…";
      api("POST", "/me/avatar", undefined, f).then(function (x) { m.textContent = x.ok ? "Avatar inviato: è in revisione dallo staff." : x.errore; e.target.value = ""; refreshMe(); });
    });
    $("#gdprDel").addEventListener("click", function () {
      var c = prompt("Questa azione cancella profilo, post, immagini, like, follow e segnalazioni. Non si può annullare.\nScrivi ELIMINA per confermare.");
      if (c !== "ELIMINA") return toast("Cancellazione annullata");
      api("DELETE", "/me", { conferma: "ELIMINA" }).then(function (x) { toast(x.ok ? "Profilo cancellato" : x.errore); refreshMe(); loadCreators(); loadFeed(true); });
    });
  }

  /* ---------- copia indirizzi ---------- */
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-copy]"); if (b) copy(b.getAttribute("data-copy")); });

  /* ---------- gate 18+ ---------- */
  function gate() {
    var g = $("#gate"); if (LS.get("ov-18", false)) return;
    g.hidden = false; $("#gateOk").addEventListener("click", function () { LS.set("ov-18", true); g.hidden = true; });
    $("#gateOk").focus();
  }

  /* ---------- particelle d'oro e viola ---------- */
  function magic() {
    var cv = $("#magic"), cx = cv.getContext("2d"), W, H, dpr, P = [], mx = -1e3, my = -1e3, run = true;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; }
    size(); addEventListener("resize", size);
    var N = innerWidth < 700 ? 34 : 70, cols = ["245,195,108", "255,61,127", "155,92,255", "94,230,255"];
    for (var i = 0; i < N; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.8 + .5) * dpr, vx: (Math.random() - .5) * .18 * dpr, vy: -(Math.random() * .3 + .08) * dpr, c: cols[i % 4], p: Math.random() * 6.28 });
    addEventListener("pointermove", function (e) { mx = e.clientX * dpr; my = e.clientY * dpr; }, { passive: true });
    document.addEventListener("visibilitychange", function () { run = !document.hidden; if (run) tick(); });
    function tick() {
      if (!run) return; cx.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) {
        var p = P[i]; p.p += .02; p.x += p.vx + Math.sin(p.p) * .15 * dpr; p.y += p.vy;
        var dx = p.x - mx, dy = p.y - my, d = Math.sqrt(dx * dx + dy * dy); if (d < 140 * dpr) { p.x += dx / d * .6; p.y += dy / d * .6; }
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        var a = .25 + .35 * (Math.sin(p.p * 1.7) + 1) / 2, g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, "rgba(" + p.c + "," + a + ")"); g.addColorStop(1, "rgba(" + p.c + ",0)");
        cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r * 6, 0, 6.283); cx.fill();
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ---------- avvio ---------- */
  function revealObs() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach(function (n) { n.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .08 });
    $$(".reveal").forEach(function (n) { io.observe(n); });
  }
  renderCats(); renderModels(); bindFeed(); bindTagAssist(); bindProfile(); bindChat();
  renderGrid(); renderAI();
  show(location.hash.slice(1)); revealObs(); gate(); magic();
  loadAI(); loadCoin(); loadCreators(); refreshMe().then(function () { loadFeed(true); });
})();
