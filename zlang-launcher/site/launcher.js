/* ZLang Launcher by ZDOS — DEMO. Tutto gira nel browser: nessuna rete, nessuna firma, nessuna transazione. © ZDOS1.3 */
(function () {
  'use strict';
  var P = {
    rentPerByte: 5080,            // lamport per byte (fonti pubbliche, 22/11/2026): da rileggere on-chain
    rentOverhead: 128,
    zdosFee: 10000000,            // 0,01 SOL, proposta
    partyBps: 5000,               // 50% al party pool, proposta
    metaFee: 10000000,            // commissione programma metadati (SPL)
    metaBytes: 607,
    poolRent: 9300000,            // 0,0093 SOL
    posRent: 8700000,             // 0,0087 SOL
    netMargin: 500000,            // 0,0005 SOL, firme e priorità
    faucetAmount: 50, faucetDays: 7, faucetMinAge: 14
  };
  var $ = function (id) { return document.getElementById(id); };
  var LAM = 1e9;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rent(bytes) { return (bytes + P.rentOverhead) * P.rentPerByte; }
  function itNum(x, minD, maxD) { return x.toLocaleString('it-IT', { minimumFractionDigits: minD || 0, maximumFractionDigits: maxD == null ? 20 : maxD }); }
  function solN(l) { var v = l / LAM, s = v.toFixed(7).replace(/0+$/, ''); var p = s.split('.'); var d = p[1] || ''; while (d.length < 3) d += '0'; return p[0] + ',' + d; }
  function short(a) { return a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a; }
  function utf8len(s) { return new TextEncoder().encode(s).length; }
  function sha256(str) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('non-disponibile');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function say(box, kind, title, lines) {
    box.className = 'zl-res on' + (kind ? ' ' + kind : ''); box.textContent = '';
    var b = el('b', null, title); box.appendChild(b);
    lines.forEach(function (l) { var p = el('div', l.mono ? 'mono u-mt6' : 'u-mt6', l.t || l); box.appendChild(p); });
    box.focus({ preventScroll: true });
  }

  /* ---------- schede ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.zl-tab[data-p]'));
  function openTab(name, focus) {
    if (!document.getElementById('p-' + name)) name = 'crea';
    tabs.forEach(function (t) { var on = t.dataset.p === name; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    Array.prototype.forEach.call(document.querySelectorAll('.zl-panel'), function (p) { p.classList.toggle('on', p.id === 'p-' + name); });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { openTab(t.dataset.p); history.replaceState(null, '', '#' + t.dataset.p); var tb = document.querySelector('.zl-tabs'); if (window.scrollY > tb.offsetTop - 56) window.scrollTo(0, tb.offsetTop - 56); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length]; openTab(n.dataset.p, true); e.preventDefault();
    });
  });
  openTab((location.hash || '#crea').slice(1));
  window.addEventListener('hashchange', function () { openTab(location.hash.slice(1)); });

  /* ---------- crea token ---------- */
  var F = { name: $('fName'), sym: $('fSym'), dec: $('fDec'), sup: $('fSupply'), img: $('fImg'), sol: $('fSol'), pct: $('fPct'), fee: $('fFee'), std: $('fStd'), mint: $('tMint'), frz: $('tFreeze'), lock: $('tLock') };
  var U64 = (1n << 64n) - 1n, current = null, imgTimer = null, imgOk = true;

  function read() {
    var s = { errors: {} };
    s.name = F.name.value.trim().replace(/["\\]/g, '');
    if (!s.name) s.errors.name = 'Scrivi un nome (massimo 32 caratteri).';
    s.sym = F.sym.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(s.sym)) s.errors.sym = 'Simbolo di 2–10 lettere o numeri, senza spazi.';
    s.dec = parseInt(F.dec.value, 10);
    var raw = F.sup.value.replace(/[.\s_']/g, '').replace(/,/g, '');
    s.supply = null;
    if (!/^[0-9]{1,20}$/.test(raw) || BigInt(raw) < 1n) s.errors.supply = 'Scrivi un numero intero maggiore di zero.';
    else {
      var sup = BigInt(raw), mult = 10n ** BigInt(s.dec);
      if (sup * mult > U64) s.errors.supply = 'Troppo grande per ' + s.dec + ' decimali (massimo ' + itNum(Number(U64 / mult)) + ').';
      else s.supply = sup;
    }
    s.img = F.img.value.trim();
    if (s.img) { try { var u = new URL(s.img); if (u.protocol !== 'https:') throw 0; } catch (e) { s.errors.img = 'Serve un indirizzo che inizia con https://'; } }
    var solv = parseFloat(F.sol.value.replace(',', '.'));
    if (!(solv >= 0.1 && solv <= 100000)) s.errors.sol = 'Almeno 0,1 SOL.'; else s.seed = Math.round(solv * LAM);
    s.pct = parseInt(F.pct.value, 10); s.feeBps = parseInt(F.fee.value, 10); s.std = F.std.value;
    s.rMint = F.mint.checked; s.rFrz = F.frz.checked; s.lock = F.lock.checked;
    return s;
  }
  function metaCost(s) {
    if (s.std === 't22') { var bytes = 166 + 68 + 84 + utf8len(s.name) + utf8len(s.sym) + utf8len(s.img || ''); return { mint: rent(bytes), meta: 0, fee: 0 }; }
    return { mint: rent(82), meta: rent(P.metaBytes), fee: P.metaFee };
  }
  function costs(s) {
    var m = metaCost(s), rows = [];
    var zd = P.zdosFee, party = Math.floor(zd * P.partyBps / 10000), serv = zd - party;
    var net = m.mint + rent(165) + m.meta + m.fee + P.poolRent + P.posRent + P.netMargin;
    return { m: m, zd: zd, party: party, serv: serv, net: net, total: zd + net, ata: rent(165) };
  }
  function priceStr(s) {
    if (!s.supply || !s.seed) return '—';
    var pool = Number(s.supply) * s.pct / 100; if (!(pool > 0)) return '—';
    var p = (s.seed / LAM) / pool; if (!(p > 0)) return '—';
    var d = Math.min(18, Math.max(2, -Math.floor(Math.log10(p)) + 3));
    return p.toFixed(d).replace('.', ',').replace(/0+$/, '') + ' SOL';
  }
  function specText(s) {
    var pb = Math.floor(P.zdosFee * P.partyBps / 10000);
    var std = s.rMint && s.rFrz && s.lock;
    var supplyRaw = s.supply ? (s.supply * 10n ** BigInt(s.dec)).toString() : '0';
    var q = function (x) { return '"' + x + '"'; };
    return [
      '// ZLang Launch Spec · DEMO · simulazione, nessuna transazione reale',
      'launch ZLangLaunch {',
      '  version: "1.0.0"',
      '  mode: "demo"',
      '  disclaimer: "Nessun rendimento promesso. Informazione tecnica, non è un consiglio di investimento."',
      '',
      '  token {',
      '    name: ' + q(s.name || '?'),
      '    symbol: ' + q(s.sym || '?'),
      '    decimals: ' + s.dec,
      '    supply_raw: ' + supplyRaw,
      '    standard: ' + q(s.std === 't22' ? 'token-2022' : 'spl'),
      '    image_uri: ' + q(s.img || ''),
      '  }',
      '  safety {',
      '    revoke_mint: ' + s.rMint,
      '    revoke_freeze: ' + s.rFrz,
      '    lp_lock: ' + q(s.lock ? 'permanent' : 'none'),
      '    zdos_standard_profile: ' + std,
      '  }',
      '  pool {',
      '    quote: "SOL"',
      '    seed_lamports: ' + (s.seed || 0),
      '    supply_in_pool_bps: ' + (s.pct * 100),
      '    base_fee_bps: ' + s.feeBps,
      '  }',
      '  fees {',
      '    zdos_launch_lamports: ' + P.zdosFee,
      '    party_pool_bps: ' + P.partyBps,
      '    zdos_trading_fee_bps: 0',
      '  }',
      '',
      '  rule on_launch(creator, party_pool, zdos_service) {',
      '    let party = (fees.zdos_launch_lamports * fees.party_pool_bps) / 10000',
      '    let service = fees.zdos_launch_lamports - party',
      '    transfer(creator, party_pool, party)        // ' + pb + ' lamport',
      '    transfer(creator, zdos_service, service)    // ' + (P.zdosFee - pb) + ' lamport',
      '    emit LaunchReceipt(creator, spec_hash)',
      '  }',
      '}'
    ].join('\n');
  }
  function steps(s, c) {
    var L = [];
    L.push(['Crea il conto mint', s.dec + ' decimali · ' + solN(c.m.mint) + ' SOL di deposito']);
    L.push(['Crea il tuo conto token e conia la supply', solN(c.ata) + ' SOL di deposito']);
    L.push([s.std === 't22' ? 'Scrive i metadati nel mint' : 'Crea i metadati (nome, simbolo, immagine)', s.std === 't22' ? 'già compresi nel deposito del mint' : solN(c.m.meta + c.m.fee) + ' SOL']);
    if (s.rMint) L.push(['Revoca la mint authority', 'solo firma di rete']);
    if (s.rFrz) L.push(['Revoca la freeze authority', 'solo firma di rete']);
    L.push(['Crea il pool SOL + token e deposita la liquidità', solN(P.poolRent + P.posRent) + ' SOL di deposito']);
    if (s.lock) L.push(['Blocca la liquidità per sempre', 'solo firma di rete']);
    L.push(['Paga la commissione ZDOS', solN(c.party) + ' SOL al party pool + ' + solN(c.serv) + ' SOL al servizio']);
    L.push(['Scrive la ricevuta ZLang (Memo con l\'hash della specifica)', 'solo firma di rete']);
    return L;
  }
  function render() {
    var s = read(); current = s;
    ['name', 'sym', 'supply', 'img', 'sol'].forEach(function (k) {
      var inp = { name: F.name, sym: F.sym, supply: F.sup, img: F.img, sol: F.sol }[k];
      var msg = s.errors[k] || (k === 'img' && F.img.value.trim() && !imgOk ? 'Immagine non raggiungibile: uso quella di prova.' : '');
      $({ name: 'eName', sym: 'eSym', supply: 'eSupply', img: 'eImg', sol: 'eSol' }[k]).textContent = msg;
      if (s.errors[k]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    });
    var c = costs(s), ok = Object.keys(s.errors).length === 0;
    $('pvName').textContent = s.name || '…'; $('pvSym').textContent = s.sym ? '$' + s.sym : '…';
    $('pvSupply').textContent = s.supply ? itNum(Number(s.supply)) : '—';
    $('pvPool').textContent = s.supply ? itNum(Number(s.supply) * s.pct / 100) + ' (' + s.pct + '%)' : '—';
    $('pvKeep').textContent = s.supply ? itNum(Number(s.supply) * (100 - s.pct) / 100) : '—';
    $('pvPrice').textContent = priceStr(s);
    $('pvStd').textContent = s.std === 't22' ? 'Token-2022' : 'SPL Token';
    // controlli
    var ul = $('chkOut'); ul.textContent = '';
    var chk = [
      [s.rMint, 'Mint authority revocata', 'Nessun nuovo token potrà essere creato.', 'Mint non revocata: chi la tiene può creare altri token.'],
      [s.rFrz, 'Freeze authority revocata', 'Nessuno potrà bloccare i conti.', 'Freeze non revocata: chi la tiene può bloccare i conti.'],
      [s.lock, 'Liquidità bloccata', 'La liquidità iniziale non si può ritirare.', 'Liquidità non bloccata: può essere ritirata.'],
      [!!s.name && !!s.sym && !!s.img && imgOk, 'Metadati completi', 'Nome, simbolo e immagine presenti.', 'Manca un\'immagine valida: è consigliata per wallet e aggregatori.'],
      [s.pct === 100, 'Tutta la supply nel pool', 'Nessuna quota resta a un solo wallet.', 'Una parte resta a te: i controlli di concentrazione lo segnaleranno.']
    ];
    var all = true;
    chk.forEach(function (r) {
      all = all && r[0];
      var li = el('li', r[0] ? 'ok' : 'no'); li.appendChild(el('i', null, r[0] ? '✓' : '!'));
      var d = el('div'); d.appendChild(document.createTextNode(r[1])); d.appendChild(el('small', null, r[0] ? r[2] : r[3])); li.appendChild(d); ul.appendChild(li);
    });
    var std = s.rMint && s.rFrz && s.lock;
    var bd = $('pvBadge'); bd.className = 'zl-badge ' + (std ? 'ok' : 'no'); bd.textContent = std ? 'Standard ZDOS' : 'Non standard: attenzione';
    // costi
    var tb = $('feeOut'); tb.textContent = '';
    function grp(t) { var tr = el('tr', 'grp'); var td = el('td', null, t); td.colSpan = 2; tr.appendChild(td); tb.appendChild(tr); }
    function row(l, v, sm, cls) { var tr = el('tr', cls); var a = el('td', null, l); if (sm) a.appendChild(el('small', null, sm)); tr.appendChild(a); tr.appendChild(el('td', 'n', v)); tb.appendChild(tr); }
    grp('Commissione ZDOS');
    row('Commissione di lancio', solN(c.zd), solN(c.party) + ' al party pool · ' + solN(c.serv) + ' al servizio');
    row('Commissione sugli scambi', '0', 'ZDOS non prende nulla sugli scambi');
    grp('Rete Solana (al costo)');
    row('Conto mint', solN(c.m.mint), s.std === 't22' ? 'compresi i metadati nel mint' : null);
    row('Il tuo conto token', solN(c.ata));
    if (s.std !== 't22') row('Metadati', solN(c.m.meta + c.m.fee), solN(c.m.meta) + ' deposito + ' + solN(c.m.fee) + ' commissione del programma metadati');
    row('Pool di liquidità', solN(P.poolRent));
    row('Posizione di liquidità', solN(P.posRent), s.lock ? 'con il blocco LP resta nel pool per sempre' : 'recuperabile se la chiudi');
    row('Firme e priorità (margine)', solN(P.netMargin));
    row('Totale stimato', solN(c.total), 'più i ' + (s.seed ? solN(s.seed) : '—') + ' SOL di liquidità, che restano tuoi', 'sum');
    // transazioni
    var ol = $('stepsOut'); ol.textContent = '';
    steps(s, c).forEach(function (r) { var li = el('li'); li.appendChild(el('b', null, r[0])); li.appendChild(document.createTextNode(' — ' + r[1])); ol.appendChild(li); });
    // spec
    var t = specText(s); $('specOut').textContent = t; current.spec = t; current.cost = c;
    sha256(t).then(function (h) { current.hash = h; $('bandHash').textContent = h.slice(0, 16) + '…'; });
    $('btnSim').disabled = !ok;
  }
  Object.keys(F).forEach(function (k) {
    var ev = (F[k].type === 'checkbox' || F[k].tagName === 'SELECT') ? 'change' : 'input';
    F[k].addEventListener(ev, function () { if (k === 'img') loadImg(); render(); });
  });
  function loadImg() {
    clearTimeout(imgTimer); var pv = $('pvImg'), v = F.img.value.trim();
    imgOk = true;
    if (!v) { pv.src = '/launcher/assets/token-placeholder.svg'; return; }
    imgTimer = setTimeout(function () {
      try { if (new URL(v).protocol !== 'https:') return; } catch (e) { return; }
      pv.onerror = function () { imgOk = false; pv.onerror = null; pv.src = '/launcher/assets/token-placeholder.svg'; render(); };
      pv.onload = function () { imgOk = true; };
      pv.src = v;
    }, 450);
  }
  $('frm').addEventListener('submit', function (e) { e.preventDefault(); });
  $('btnCopy').addEventListener('click', function () {
    var b = this, t = $('specOut').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copiata'; }, function () { b.textContent = 'Seleziona e copia a mano'; });
    setTimeout(function () { b.textContent = 'Copia la specifica'; }, 1800);
  });
  $('btnSim').addEventListener('click', function () {
    var s = read(); if (Object.keys(s.errors).length) { render(); return; }
    var c = costs(s), n = (store('zl_launches') || 0) + 1; store('zl_launches', n); updLocal();
    sha256(specText(s)).then(function (h) {
      var std = s.rMint && s.rFrz && s.lock;
      say($('simRes'), std ? '' : 'warn', 'Lancio simulato · nessuna transazione firmata o inviata', [
        { t: 'Token: ' + s.name + ' ($' + s.sym + ') · supply ' + itNum(Number(s.supply)) + ' · ' + (std ? 'profilo standard ZDOS' : 'profilo NON standard') },
        { t: 'In un lancio reale firmeresti ' + (s.std === 't22' ? '2' : '3') + ' transazioni con il tuo wallet. Costo stimato: ' + solN(c.total) + ' SOL, più i ' + solN(s.seed) + ' SOL di liquidità.' },
        { t: 'Party pool: +' + solN(c.party) + ' SOL (simulato). L\'indirizzo del mint viene generato solo in un lancio reale.' },
        { t: 'Ricevuta ZLang (sha256 della specifica):' }, { t: h, mono: true }
      ]);
    });
  });

  /* ---------- Phantom (facoltativo, solo connessione) ---------- */
  var prov = (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null);
  var bc = $('btnConnect'), note = $('connNote'), addr = null;
  bc.addEventListener('click', function () {
    if (!prov) { note.textContent = 'Phantom non trovato: la demo funziona lo stesso, senza wallet.'; return; }
    if (addr) { try { prov.disconnect(); } catch (e) { } addr = null; bc.textContent = 'Collega Phantom'; note.textContent = 'Scollegato. Phantom è facoltativo e la demo non chiede firme.'; return; }
    prov.connect().then(function (r) {
      addr = (r && r.publicKey ? r.publicKey : prov.publicKey).toString();
      bc.textContent = short(addr); note.textContent = 'Collegato: la demo legge solo il tuo indirizzo e non chiede firme.';
      $('faAddr').value = addr;
    }, function () { note.textContent = 'Collegamento annullato. Nessun problema: la demo funziona senza wallet.'; });
  });

  /* ---------- faucet (simulato) ---------- */
  (function () {
    var ul = $('faRules');
    [
      ['Importo piccolo e fisso', P.faucetAmount + ' L$D a richiesta (esempio)'],
      ['Una richiesta per wallet', 'ogni ' + P.faucetDays + ' giorni'],
      ['Età del wallet', 'almeno ' + P.faucetMinAge + ' giorni (letta dalla chain)'],
      ['Firma di un messaggio', 'prova di possesso del wallet: non è una transazione'],
      ['Limiti di frequenza', 'per indirizzo, per IP e budget giornaliero totale'],
      ['Pausa immediata', 'il faucet si ferma in qualsiasi momento']
    ].forEach(function (r) { var li = el('li', 'ok'); li.appendChild(el('i', null, '•')); var d = el('div', null, r[0]); d.appendChild(el('small', null, r[1])); li.appendChild(d); ul.appendChild(li); });
    var inp = $('faAddr'), box = $('faRes');
    $('btnFa').addEventListener('click', function () {
      var a = inp.value.trim(), err = $('eFa'); err.textContent = '';
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) { inp.setAttribute('aria-invalid', 'true'); err.textContent = 'Indirizzo Solana non valido (32–44 caratteri).'; return; }
      inp.removeAttribute('aria-invalid');
      var age = parseInt($('faAge').value, 10), last = (store('zl_fa') || {})[a], now = Date.now(), win = P.faucetDays * 864e5;
      var nonce = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      var lines = [
        { t: '✓ Messaggio da firmare (simulato, nessuna firma richiesta): zlang-faucet|' + nonce, mono: true },
        { t: (age >= P.faucetMinAge ? '✓' : '✗') + ' Età del wallet: ' + age + ' giorni (minimo ' + P.faucetMinAge + ')' }
      ];
      if (age < P.faucetMinAge) { lines.push('Richiesta non idonea: il wallet è troppo recente. Riprova quando avrà almeno ' + P.faucetMinAge + ' giorni.'); say(box, 'bad', 'Non idoneo', lines); return; }
      if (last && now - last < win) {
        var nx = new Date(last + win);
        lines.push('✗ Una richiesta per periodo: già fatta in questa prova. Prossima possibile dal ' + nx.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) + '.');
        say(box, 'warn', 'Già richiesto in questo periodo', lines); return;
      }
      var o = store('zl_fa') || {}; o[a] = now; store('zl_fa', o);
      lines.push('✓ Una richiesta per periodo: prima richiesta di ' + short(a) + '.');
      lines.push('In produzione riceveresti ' + P.faucetAmount + ' L$D (importo di esempio). Qui non è stato inviato nulla.');
      say(box, '', 'Richiesta simulata superata', lines);
    });
    $('btnFaReset').addEventListener('click', function () { store('zl_fa', {}); box.className = 'zl-res'; box.textContent = ''; });
  })();

  /* ---------- airdrop: prova di Merkle reale su elenco di esempio ---------- */
  (function () {
    var ENT = [['esempio-creator-01', 120], ['esempio-merito-02', 80], ['esempio-merito-03', 60], ['esempio-creator-04', 40], ['esempio-uso-05', 25], ['esempio-uso-06', 10]];
    var leaves = [], levels = [], root = '';
    function leaf(e) { return sha256('zlang-demo-leaf|' + e[0] + '|' + e[1]); }
    function node(a, b) { return sha256(a + b); }
    var sel = $('adSel'), idIn = $('adId'), box = $('adRes'), claimBtn = $('btnAdClaim'), proofOk = null;
    ENT.forEach(function (e, i) { var o = el('option', null, e[0] + ' · ' + e[1] + ' L$D (esempio)'); o.value = e[0]; sel.appendChild(o); });
    idIn.value = ENT[0][0];
    sel.addEventListener('change', function () { idIn.value = sel.value; claimBtn.disabled = true; });
    idIn.addEventListener('input', function () { claimBtn.disabled = true; });
    function build() {
      return Promise.all(ENT.map(leaf)).then(function (L) {
        leaves = L; levels = [L];
        function up(cur) {
          if (cur.length === 1) return Promise.resolve();
          var pairs = []; for (var i = 0; i < cur.length; i += 2) pairs.push([cur[i], cur[i + 1] || cur[i]]);
          return Promise.all(pairs.map(function (p) { return node(p[0], p[1]); })).then(function (n) { levels.push(n); return up(n); });
        }
        return up(L);
      }).then(function () { root = levels[levels.length - 1][0]; $('adRoot').textContent = root; });
    }
    function proofFor(i) { var p = []; for (var l = 0; l < levels.length - 1; l++) { var sib = i % 2 ? i - 1 : i + 1; if (sib >= levels[l].length) sib = i; p.push({ h: levels[l][sib], right: i % 2 === 0 }); i = Math.floor(i / 2); } return p; }
    function verify(l, proof) { var cur = Promise.resolve(l); proof.forEach(function (p) { cur = cur.then(function (c) { return p.right ? node(c, p.h) : node(p.h, c); }); }); return cur; }
    $('btnAd').addEventListener('click', function () {
      var id = idIn.value.trim(), i = ENT.findIndex(function (e) { return e[0] === id; });
      claimBtn.disabled = true;
      if (i < 0) { say(box, 'warn', 'Non presente nell\'elenco', [id ? 'L\'identificativo «' + id + '» non ha una prova: in un round reale non potresti fare claim.' : 'Scrivi o scegli un identificativo.']); return; }
      var pr = proofFor(i);
      verify(leaves[i], pr).then(function (r) {
        var ok = r === root;
        say(box, ok ? '' : 'bad', ok ? 'Prova valida' : 'Prova non valida', [
          { t: 'Foglia (sha256 di identificativo e importo): ' + leaves[i].slice(0, 16) + '…', mono: true },
          { t: 'Passi della prova: ' + pr.length + ' · radice ricalcolata = radice pubblicata: ' + (ok ? 'sì' : 'no') },
          'Importo di esempio: ' + ENT[i][1] + ' L$D. Nessun importo è reale.'
        ]);
        claimBtn.disabled = !ok; proofOk = ENT[i][0];
      });
    });
    claimBtn.addEventListener('click', function () {
      var c = store('zl_ad') || {};
      if (c[proofOk]) { say(box, 'warn', 'Claim già usato (simulato)', ['Ogni prova si usa una sola volta: il programma segna il claim come fatto.']); return; }
      c[proofOk] = 1; store('zl_ad', c);
      say(box, '', 'Claim simulato', ['Nessun token inviato. In produzione il programma verificherebbe la prova e segnerebbe questo claim come usato. Riprova: la seconda volta verrà rifiutato.']);
    });
    build();
  })();

  /* ---------- party pool ---------- */
  var ppN = $('ppN');
  function pp() {
    var n = parseInt(ppN.value, 10), a = Math.floor(P.zdosFee * P.partyBps / 10000);
    $('ppNv').textContent = n; $('ppOut').textContent = solN(n * a) + ' SOL';
    $('ppSub').textContent = n + ' lanci × ' + solN(a) + ' SOL al party pool. Simulazione aritmetica, non una previsione.';
  }
  function updLocal() { var n = store('zl_launches') || 0; var b = $('ppLocal'); b.textContent = n + ' '; b.appendChild(el('small', null, n === 1 ? 'lancio simulato' : 'lanci simulati')); }
  ppN.addEventListener('input', pp);
  $('btnPpReset').addEventListener('click', function () { store('zl_launches', 0); updLocal(); });
  pp(); updLocal(); render();
})();
