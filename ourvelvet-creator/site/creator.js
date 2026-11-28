/* OurVelvet Creator — © 2026 ZDOS1.3. Vanilla JS, nessuna dipendenza esterna, nessun dato inventato:
   i profili sono esempi dichiarati; i dati live arrivano da /api/firma/*, /api/velvet-ai/status, /api/domcoin/lsd-live. */
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

  /* ---------- dati di esempio (personaggi fittizi, tutti adulti) ---------- */
  var CATS = ["Tutti", "Cartoon", "Anime-style", "Cyber", "Gotico", "Fantasy", "Burlesque", "Roleplay", "Narrativa", "Musica", "Arte", "AI"];
  var CREATORS = [
    { id: "selene", n: "Selene Vox", r: "Narratrice gotica", b: "Storie a lume di candela, voce calda e ironica. Racconti per adulti, con consenso e cura.", t: ["Gotico", "Narrativa", "Roleplay"], g: "moon", a: 268, c: 320 },
    { id: "kiro", n: "Kiro Neon", r: "Artista cyber", b: "Illustrazioni cartoon al neon: città piovose, insegne rosa, atmosfera notturna.", t: ["Cyber", "Cartoon", "Arte"], g: "bolt", a: 190, c: 285 },
    { id: "satin", n: "Lord Satin", r: "Maestro di cerimonie", b: "Giochi di ruolo di velluto con regole chiare, limiti dichiarati e safeword ROSSO.", t: ["Roleplay", "Burlesque"], g: "crown", a: 345, c: 28 },
    { id: "eclat", n: "Madame Éclat", r: "Burlesque illustrata", b: "Teatro, piume e glitter in stile vignetta. Eleganza prima di tutto.", t: ["Burlesque", "Cartoon", "Arte"], g: "feather", a: 330, c: 270 },
    { id: "orfeo", n: "Orfeo Beat", r: "Musica e playlist", b: "Set lenti e playlist per serate a due. Niente chiasso, solo atmosfera.", t: ["Musica"], g: "note", a: 205, c: 300 },
    { id: "ambra", n: "Ámbra Noir", r: "Illustratrice noir", b: "Tavole in bianco, nero e rosso: gialli sensuali e sguardi di sfida.", t: ["Arte", "Narrativa", "Cartoon"], g: "keyhole", a: 350, c: 250 },
    { id: "vesper", n: "Vesper Atelier", r: "Mondi fantasy", b: "Creature, foreste e amanti immortali, tutti adulti. Mappe e racconti a puntate.", t: ["Fantasy", "Anime-style", "Narrativa"], g: "star", a: 160, c: 275 },
    { id: "cinabro", n: "Dr. Cinabro", r: "Fumetto anime-style", b: "Storie lunghe per adulti, trame mature e personaggi adulti con una vita vera.", t: ["Anime-style", "Narrativa", "Arte"], g: "mask", a: 15, c: 300 },
    { id: "zephyr", n: "Zéphyr Duo", r: "Podcast a due voci", b: "Due voci, un microfono, conversazioni su desiderio, limiti e fiducia.", t: ["Musica", "Narrativa"], g: "rose", a: 300, c: 20 }
  ];
  var AI_FALLBACK = [
    { id: "rubina", n: "Rubina Mistress", r: "Sovereign Protocol", g: "crown", a: 335, c: 275 },
    { id: "zara", n: "Zara AGI", r: "Scene & Club AI", g: "star", a: 275, c: 190 },
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
  var POSTS = [
    { by: "selene", t: "Stasera apro il primo capitolo: «La stanza delle candele». Le regole del gioco sono nella prima pagina: limiti, parola di sicurezza ROSSO, e si può fermare tutto quando si vuole.", tags: ["Gotico", "Narrativa"], when: "esempio" },
    { by: "kiro", t: "Nuova tavola neon: una città sotto la pioggia e un'insegna che dice «consenso». Colori: rosa, ciano, un po' di oro.", tags: ["Cyber", "Cartoon"], when: "esempio", art: true },
    { by: "eclat", t: "Prove generali del nuovo spettacolo illustrato. Piume sì, volgarità no.", tags: ["Burlesque", "Arte"], when: "esempio", art: true },
    { by: "orfeo", t: "Playlist «Dopo mezzanotte»: 12 brani lenti, zero pubblicità.", tags: ["Musica"], when: "esempio" },
    { by: "zephyr", t: "Puntata nuova: come si parla di limiti senza imbarazzo. Due minuti per iniziare, il resto è ascolto.", tags: ["Musica", "Narrativa"], when: "esempio" }
  ];
  function byId(id) { for (var i = 0; i < CREATORS.length; i++) if (CREATORS[i].id === id) return CREATORS[i]; }

  /* ---------- navigazione a viste (hash, nessun redirect) ---------- */
  var TITLES = { esplora: "Esplora", crea: "Crea", feed: "Feed", ai: "AI", monete: "Dom-Coin & VELVET", profilo: "Il mio profilo" };
  function show(v) {
    if (!TITLES[v]) v = "esplora";
    $$("[data-view]").forEach(function (s) { s.hidden = s.getAttribute("data-view") !== v; });
    $$("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === v); });
    $("#topTitle").textContent = TITLES[v];
    document.title = TITLES[v] + " · Creator · OurVelvet";
    window.scrollTo(0, 0);
    $$(".reveal", $("#v-" + v)).forEach(function (n) { n.classList.add("in"); });
    if (window.ZDOSGA && window.gtag && window.ZDOSGA.active) window.gtag("event", "page_view", { page_title: TITLES[v], page_location: location.href });
  }
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)); });

  /* ---------- Esplora ---------- */
  var state = { cat: "Tutti", q: "", ai: AI_FALLBACK.map(function (x) { return x; }) };
  function cardEl(c, kind) {
    var b = el("button", "card"); b.type = "button"; b.setAttribute("aria-label", c.n + ", " + c.r);
    var art = el("div", "art"); art.innerHTML = emblem(c.id, c.a, c.c, c.g); b.appendChild(art);
    var bd = el("div", "badges"); bd.appendChild(el("span", "b18", "18+")); bd.appendChild(el("span", "bex", kind === "ai" ? "AI" : "Esempio")); b.appendChild(bd);
    b.appendChild(el("span", "glint"));
    var info = el("div", "info"); info.appendChild(el("h4", "", c.n)); info.appendChild(el("p", "", c.r + (c.b ? " · " + c.b : "")));
    var tg = el("div", "tags"); (c.t || []).forEach(function (t) { tg.appendChild(el("span", "tag", t)); }); info.appendChild(tg); b.appendChild(info);
    return b;
  }
  function allCards() {
    var ai = state.ai.map(function (a) { return { id: a.id, n: a.n, r: a.r + " (AI)", b: AIDESC[a.id] || "", t: ["AI"].concat(a.id === "kali" ? ["Cyber"] : a.id === "zara" ? ["Musica"] : ["Roleplay"]), g: a.g, a: a.a, c: a.c, ai: true }; });
    return CREATORS.map(function (c) { return c; }).concat(ai);
  }
  function renderGrid() {
    var g = $("#grid"); g.textContent = "";
    var q = state.q.toLowerCase(), n = 0;
    allCards().forEach(function (c) {
      if (state.cat !== "Tutti" && c.t.indexOf(state.cat) < 0) return;
      if (q && (c.n + " " + c.r + " " + c.b + " " + c.t.join(" ")).toLowerCase().indexOf(q) < 0) return;
      var d = cardEl(c, c.ai ? "ai" : "ex"); d.addEventListener("click", function () { openProfile(c); }); g.appendChild(d); n++;
    });
    $("#empty").hidden = n > 0; bindTilt();
  }
  function renderCats() {
    var box = $("#cats"); CATS.forEach(function (c) {
      var b = el("button", "chip" + (c === state.cat ? " on" : ""), c); b.type = "button"; b.setAttribute("role", "tab");
      b.addEventListener("click", function () { state.cat = c; $$(".chip", box).forEach(function (x) { x.classList.toggle("on", x === b); }); renderGrid(); });
      box.appendChild(b);
    });
    $("#q").addEventListener("input", function (e) { state.q = e.target.value.trim(); renderGrid(); });
  }
  function openProfile(c) {
    var d = $("#dlg"); if (!d) { d = document.createElement("dialog"); d.id = "dlg"; d.className = "glass"; d.style.cssText = "max-width:420px;width:92vw;color:#f6eefc;padding:0;border:1px solid rgba(255,255,255,.14);overflow:hidden"; document.body.appendChild(d); d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); }
    d.textContent = "";
    var a = el("div", ""); a.style.cssText = "height:190px"; a.innerHTML = emblem(c.id, c.a, c.c, c.g); d.appendChild(a);
    var b = el("div", "pad");
    b.appendChild(el("h3", "", c.n)); b.appendChild(el("p", "muted", c.r));
    b.appendChild(el("p", "", c.b || ""));
    var tg = el("div", "tags chips"); tg.style.marginTop = "10px"; c.t.forEach(function (t) { tg.appendChild(el("span", "tag", t)); }); b.appendChild(tg);
    var f = el("p", "fine", c.ai ? "Personaggio AI di OurVelvet. Adulto (18+), solo consenso." : "Profilo di esempio: personaggio fittizio, adulto (18+). Nessun wallet collegato, quindi nessun badge «wallet verificato».");
    b.appendChild(f);
    var r = el("div", "row"); var fol = LS.get("ov-cr-follow", {});
    var bt = el("button", "btn primary sm", fol[c.id] ? "Segui già" : "Segui"); bt.type = "button";
    bt.addEventListener("click", function () { var o = LS.get("ov-cr-follow", {}); o[c.id] = !o[c.id]; LS.set("ov-cr-follow", o); bt.textContent = o[c.id] ? "Segui già" : "Segui"; toast(o[c.id] ? "Salvato sul tuo dispositivo" : "Rimosso"); });
    r.appendChild(bt);
    if (c.ai) { var st = el("a", "btn ghost sm", "Apri lo Studio"); st.href = "/creator/"; r.appendChild(st); }
    var cl = el("button", "btn ghost sm", "Chiudi"); cl.type = "button"; cl.addEventListener("click", function () { d.close(); }); r.appendChild(cl);
    b.appendChild(r); d.appendChild(b);
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
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

  /* ---------- Feed ---------- */
  function renderFeed() {
    var box = $("#posts"); box.textContent = "";
    var likes = LS.get("ov-cr-likes", {});
    var mine = LS.get("ov-cr-posts", []);
    mine.forEach(function (p, i) { box.appendChild(postEl({ me: true, n: "Tu", r: "bozza sul dispositivo", t: p.t, tags: [], id: "me" + i, g: "star", a: 280, c: 330 }, "bozza", likes)); });
    POSTS.forEach(function (p, i) { var c = byId(p.by); box.appendChild(postEl({ n: c.n, r: c.r, t: p.t, tags: p.tags, id: c.id, g: c.g, a: c.a, c: c.c, art: p.art, key: "p" + i }, p.when, likes)); });
    var tg = {}; POSTS.forEach(function (p) { p.tags.forEach(function (t) { tg[t] = (tg[t] || 0) + 1; }); });
    var tr = $("#trend"); tr.textContent = ""; Object.keys(tg).sort(function (a, b) { return tg[b] - tg[a]; }).forEach(function (t) {
      var b = el("button", "chip", "#" + t); b.type = "button"; b.addEventListener("click", function () { state.cat = CATS.indexOf(t) >= 0 ? t : "Tutti"; $$("#cats .chip").forEach(function (x) { x.classList.toggle("on", x.textContent === state.cat); }); renderGrid(); location.hash = "#esplora"; }); tr.appendChild(b);
    });
  }
  function postEl(p, when, likes) {
    var a = el("article", "glass post");
    var h = el("div", "post-h"), av = el("div", "av"); av.innerHTML = emblem(p.id, p.a, p.c, p.g); h.appendChild(av);
    var w = el("div", ""); w.appendChild(el("b", "", p.n)); w.appendChild(el("small", "", p.r + " · " + when)); h.appendChild(w); a.appendChild(h);
    a.appendChild(el("p", "", p.t));
    if (p.art) { var ar = el("div", "art"); ar.innerHTML = emblem(p.id + "x", p.c, p.a, p.g, true); a.appendChild(ar); }
    var ac = el("div", "acts"); (p.tags || []).forEach(function (t) { ac.appendChild(el("span", "tag", "#" + t)); });
    if (!p.me) {
      var lk = el("button", likes[p.key] ? "on" : "", likes[p.key] ? "♥ Mi piace" : "♡ Mi piace"); lk.type = "button";
      lk.addEventListener("click", function () { var o = LS.get("ov-cr-likes", {}); o[p.key] = !o[p.key]; LS.set("ov-cr-likes", o); lk.classList.toggle("on", o[p.key]); lk.textContent = o[p.key] ? "♥ Mi piace" : "♡ Mi piace"; });
      ac.appendChild(lk);
    } else {
      var rm = el("button", "", "Elimina"); rm.type = "button"; rm.addEventListener("click", function () { var m = LS.get("ov-cr-posts", []); m.splice(parseInt(p.id.slice(2), 10), 1); LS.set("ov-cr-posts", m); renderFeed(); }); ac.appendChild(rm);
    }
    a.appendChild(ac); return a;
  }
  function bindFeed() {
    var t = $("#postTxt"); t.addEventListener("input", function () { $("#pc2").textContent = t.value.length + "/280"; });
    $("#postBtn").addEventListener("click", function () {
      var v = t.value.trim(), g = $("#postGuard"); if (v.length < 3) { g.textContent = "Scrivi qualcosa."; g.className = "guard bad"; return; }
      if (!guard(v, g)) return;
      var m = LS.get("ov-cr-posts", []); m.unshift({ t: v, at: Date.now() }); LS.set("ov-cr-posts", m.slice(0, 20)); t.value = ""; $("#pc2").textContent = "0/280";
      g.textContent = "Bozza salvata sul tuo dispositivo: non è pubblica."; g.className = "guard ok"; renderFeed();
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
      var d = cardEl(c, "ai"); d.classList.add("ai-card"); d.addEventListener("click", function () { openProfile(c); }); box.appendChild(d);
    });
    bindTilt();
  }

  /* ---------- Dom-Coin live (solo fatti on-chain; il valore resta «dichiarato») ---------- */
  function loadCoin() {
    getJson("/api/domcoin/lsd-live", 7000).then(function (j) {
      if (!j || !j.ok || j.mintAddress !== "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP") return;
      if (j.totalSupply) $("#lsdSupply").textContent = Number(j.totalSupply).toLocaleString("it-IT") + " (dall'API)";
      if (j.decimals != null) $("#lsdDec").textContent = String(j.decimals);
    }).catch(function () {});
  }

  /* ---------- Profilo e firma OurVelvet ---------- */
  function short(a) { return a ? a.slice(0, 4) + "…" + a.slice(-4) : ""; }
  function setSession(s) {
    var chip = $("#meChip"), out = $("#meOut"), lo = $("#logout"), tl = $("#topLogin");
    out.textContent = "";
    if (!s || !s.autenticato) {
      chip.hidden = true; lo.hidden = true; tl.textContent = "Accedi con OurVelvet";
      out.appendChild(el("p", "muted", "Non sei connesso. Accedi per vedere il tuo indirizzo e il badge."));
      return;
    }
    chip.hidden = false; chip.textContent = short(s.address); lo.hidden = false; tl.textContent = short(s.address);
    out.appendChild(el("p", "muted", "Connesso con firma OurVelvet. Sessione valida fino a " + new Date(s.expiresAt).toLocaleString("it-IT") + "."));
    out.appendChild(el("div", "addr-big", s.address));
    var bd = el("span", "", ""); bd.setAttribute("data-firma-badge", s.address); out.appendChild(bd);
    var note = el("p", "fine", "Verifico il badge…"); out.appendChild(note);
    getJson("/api/firma/badge?address=" + encodeURIComponent(s.address), 6000).then(function (j) {
      if (j && j.verificato) { note.textContent = "Il badge «wallet verificato» è pubblico per questo indirizzo."; if (window.ZDOSFirmaBadge) window.ZDOSFirmaBadge.scan(); }
      else note.textContent = "Il badge pubblico non è attivo: lo scegli quando firmi (spunta «Mostra il badge»).";
    }).catch(function () { note.textContent = ""; });
  }
  function refreshSession() { getJson("/api/firma/session", 6000).then(setSession).catch(function () { setSession(null); }); }
  function bindProfile() {
    document.addEventListener("zdos-firma-login", function (e) { if (e.detail && e.detail.ok) { refreshSession(); toast("Accesso eseguito"); } });
    $("#logout").addEventListener("click", function () { fetch("/api/firma/logout", { method: "POST" }).then(function () { refreshSession(); toast("Disconnesso"); }); });
    var p = LS.get("ov-cr-profile", {}); $("#pfName").value = p.n || ""; $("#pfBio").value = p.b || ""; $("#pfTags").value = p.t || "";
    $("#pfSave").addEventListener("click", function () {
      var n = $("#pfName").value.trim(), b = $("#pfBio").value.trim(), t = $("#pfTags").value.trim(), m = $("#pfMsg");
      if (!guard(n + " " + b + " " + t, null)) { m.textContent = "Testo non ammesso: solo adulti e consenso."; m.style.color = "var(--bad)"; return; }
      LS.set("ov-cr-profile", { n: n, b: b, t: t }); m.textContent = "Bozza salvata sul dispositivo."; m.style.color = "var(--ok)";
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
  renderCats(); renderModels(); bindFeed(); bindTagAssist(); bindProfile();
  renderGrid(); renderFeed(); renderAI();
  show(location.hash.slice(1)); revealObs(); gate(); magic();
  loadAI(); loadCoin(); refreshSession();
})();
