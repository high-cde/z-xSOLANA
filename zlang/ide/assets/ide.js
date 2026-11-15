/* Zlang IDE — ZDOS1.3. Licenza proprietaria ZSEL, tutti i diritti riservati. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qNRdyF5mVn9bzsiTDrx4b2nTZr';
  const FS_KEY = 'zide.fs.v1';

  /* ---------- modelli (dai sorgenti reali del repo dove possibile) ---------- */
  const TEMPLATES = {
    'hello.zlang': '# Esempio da zlang/examples/hello.zlang\nemit Ciao dal programma Zlang nativo\nemit Il kernel ZDOS ha eseguito questo bytecode\n',
    'vault.zlang': '# Saldo e trasferimento: gira sulla VM Rust (LOAD, SUB, STORE)\nemit Vault ZLang su z-xSOLANA\nlet balance = 1000\nlet transfer = 250\nlet balance = balance - transfer\nemit Trasferimento calcolato in locale, nessun fondo spostato\n',
    'flusso-zlb2.zlang': '# Tutte le istruzioni di zlangc v2.5 (bytecode ZLB2)\nemit Avvio nodo\nlet tentativi = 3\nloop:\nstorage.read "config/nodo.json"\nwait\nif tentativi == 0 jump fine\nlet tentativi = tentativi - 1\nfine:\nemit Fine\n',
    'test.zlang': '# Da zlang/test.zl\n# Prova locale del compilatore Zlang.\n# Le operazioni esterne non sono simulate né dichiarate attive.\nemit Inizializzazione sequenza di test locale...\nemit Compilazione e output locale completati.\n',
  };

  /* ---------- file system locale ---------- */
  let fs = load();
  function load() {
    try { const v = JSON.parse(localStorage.getItem(FS_KEY)); if (v && v.files && Object.keys(v.files).length) return v; } catch (_) {}
    return { files: { 'hello.zlang': TEMPLATES['hello.zlang'], 'vault.zlang': TEMPLATES['vault.zlang'] }, open: ['hello.zlang', 'vault.zlang'], active: 'vault.zlang' };
  }
  function save() { try { localStorage.setItem(FS_KEY, JSON.stringify(fs)); } catch (_) { log('Spazio del browser esaurito: file non salvato.', 'err'); } }

  /* ---------- console ---------- */
  function log(msg, cls) {
    const d = document.createElement('div');
    const t = new Date().toLocaleTimeString('it-IT', { hour12: false });
    d.innerHTML = '<span class="t">[' + t + ']</span> ';
    const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = msg; d.appendChild(s);
    const c = $('#clog'); c.appendChild(d); c.scrollTop = c.scrollHeight;
  }
  function logNode(node) { const c = $('#clog'); const d = document.createElement('div'); d.appendChild(node); c.appendChild(d); c.scrollTop = c.scrollHeight; }

  function isMobile() { return matchMedia('(max-width:820px)').matches; }
  /* ---------- editor ---------- */
  const cm = CodeMirror.fromTextArea($('#editor'), { mode: 'zlang', lineNumbers: true, indentUnit: 2, tabSize: 2, lineWrapping: true, autofocus: false, extraKeys: { 'Ctrl-S': () => doCompile(true), 'Cmd-S': () => doCompile(true), 'Ctrl-Enter': () => doRun(), 'Cmd-Enter': () => doRun() } });
  let marks = [];
  cm.on('change', () => { if (!fs.active) return; fs.files[fs.active] = cm.getValue(); save(); scheduleAuto(); });
  let autoT = null;
  function scheduleAuto() { clearTimeout(autoT); autoT = setTimeout(() => { runLint(); if ($('#autoCompile').checked) doCompile(false); }, 450); }

  function renderTree() {
    const t = $('#tree'); t.innerHTML = '';
    Object.keys(fs.files).sort().forEach((n) => { const li = document.createElement('li'); li.textContent = n; if (n === fs.active) li.className = 'on'; li.onclick = () => openFile(n); t.appendChild(li); });
    const tabs = $('#tabs'); tabs.innerHTML = '';
    fs.open = fs.open.filter((n) => n in fs.files);
    fs.open.forEach((n) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = n; if (n === fs.active) b.className = 'on'; b.onclick = () => openFile(n); tabs.appendChild(b); });
    const tools = document.createElement('div'); tools.className = 'tools';
    const c = document.createElement('button'); c.type = 'button'; c.className = 'btn xs'; c.textContent = '⚙ Compila'; c.onclick = () => { doCompile(true); if (isMobile()) setView('console'); };
    const r = document.createElement('button'); r.type = 'button'; r.className = 'btn xs primary'; r.textContent = '▶ Esegui'; r.onclick = () => { doRun(); if (isMobile()) setView('console'); };
    tools.append(c, r); tabs.appendChild(tools);
  }
  function openFile(n) {
    if (!(n in fs.files)) return;
    fs.active = n; if (!fs.open.includes(n)) fs.open.push(n); save();
    cm.setValue(fs.files[n]); cm.clearHistory(); renderTree(); runLint(); doCompile(false);
    if (isMobile()) setView('editor');
  }
  function validName(n) { return /^[\w\-. ]{1,60}$/.test(n) && !n.startsWith('.'); }
  function withExt(n) { return /\.(zl|zlang)$/.test(n) ? n : n + '.zlang'; }
  $('#fNew').onclick = () => { const n = prompt('Nome del nuovo file', 'nuovo.zlang'); if (!n) return; const f = withExt(n.trim()); if (!validName(f)) return log('Nome non valido.', 'err'); if (f in fs.files) return log('Esiste già: ' + f, 'warn'); fs.files[f] = '# ' + f + '\nemit Ciao\n'; openFile(f); log('Creato ' + f, 'ok'); };
  $('#fRename').onclick = () => { const o = fs.active; if (!o) return; const n = prompt('Nuovo nome', o); if (!n || n === o) return; const f = withExt(n.trim()); if (!validName(f) || f in fs.files) return log('Nome non valido o già usato.', 'err'); fs.files[f] = fs.files[o]; delete fs.files[o]; fs.open = fs.open.map((x) => (x === o ? f : x)); fs.active = f; save(); renderTree(); log('Rinominato in ' + f, 'ok'); };
  $('#fDelete').onclick = async () => { const n = fs.active; if (!n) return; if (!(await confirmModal('Eliminare ' + n + '?', 'Il file viene tolto da questo browser. Non si può recuperare.'))) return; delete fs.files[n]; if (!Object.keys(fs.files).length) fs.files['nuovo.zlang'] = '# nuovo file\nemit Ciao\n'; fs.active = Object.keys(fs.files)[0]; save(); openFile(fs.active); log('Eliminato ' + n, 'warn'); };
  $('#fUpload').onchange = (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 200000) return log('File troppo grande (max 200 KB).', 'err'); file.text().then((txt) => { let f = withExt(file.name.replace(/[^\w\-. ]/g, '_')); while (f in fs.files) f = f.replace(/(\.\w+)$/, '-1$1'); fs.files[f] = txt; openFile(f); log('Caricato ' + f, 'ok'); }); e.target.value = ''; };
  $('#fDownload').onclick = () => download(fs.active, new Blob([cm.getValue()], { type: 'text/plain' }));
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  (function renderTemplates() { const ul = $('#templates'); Object.keys(TEMPLATES).forEach((n) => { const li = document.createElement('li'); li.textContent = n; li.onclick = () => { let f = n; while (f in fs.files) f = f.replace(/(\.\w+)$/, '-1$1'); fs.files[f] = TEMPLATES[n]; openFile(f); log('Modello aggiunto: ' + f, 'info'); }; ul.appendChild(li); }); })();

  /* ---------- pannelli / viste ---------- */
  function setPanel(p) { $$('.rail button').forEach((b) => b.classList.toggle('on', b.dataset.panel === p)); $$('.panel').forEach((s) => s.classList.toggle('on', s.dataset.p === p)); if (isMobile()) setView('panel'); }
  $$('.rail button').forEach((b) => (b.onclick = () => setPanel(b.dataset.panel)));
  function setView(v) { $('#app').dataset.view = v; $$('.mbar button').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); if (v === 'editor') setTimeout(() => cm.refresh(), 30); }
  $$('.mbar button').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $('#cClear').onclick = () => ($('#clog').innerHTML = '');
  $('#cToggle').onclick = () => { $('.main').classList.toggle('cmin'); setTimeout(() => cm.refresh(), 30); };

  function confirmModal(title, html) {
    return new Promise((res) => {
      $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').classList.remove('hidden');
      const done = (v) => { $('#modal').classList.add('hidden'); $('#mYes').onclick = $('#mNo').onclick = null; res(v); };
      $('#mYes').onclick = () => { const need = $('#mBody input[type=checkbox][data-required]'); if (need && !need.checked) { need.parentElement.style.color = 'var(--red)'; return; } done(true); };
      $('#mNo').onclick = () => done(false);
    });
  }

  /* ---------- compilazione ---------- */
  const TC_NOTE = {
    zlangc: 'Port JS di zlang/tools/zlangc.py: stesso bytecode ZLB2 byte per byte. Supporta emit, let, if, etichette, wait, storage.read.',
    rust: 'Il vero Compiler e la ZVirtualMachine di zlang/src compilati in WASM. Gestisce emit e let (interi e a - b); le altre righe diventano UNKNOWN_OPCODE.',
  };
  $('#toolchain').onchange = () => { $('#tcNote').textContent = TC_NOTE[$('#toolchain').value]; doCompile(true); };
  $('#tcNote').textContent = TC_NOTE.zlangc;
  let last = null; // ultimo risultato zlangc ok

  async function sha256hex(bytes) { const h = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join(''); }
  function hexdump(bin) { let s = ''; for (let i = 0; i < bin.length; i += 16) { const row = Array.from(bin.slice(i, i + 16), (b) => b.toString(16).padStart(2, '0')).join(' '); s += i.toString(16).padStart(4, '0') + '  ' + row + '\n'; } return s; }

  async function doCompile(verbose) {
    const src = cm.getValue(); const out = $('#compileOut'); out.innerHTML = '';
    marks.forEach((m) => m.clear()); marks = [];
    const r = ZLangC.compile(src);
    if (!r.ok) {
      last = null;
      out.innerHTML = '<div class="err"></div>'; out.firstChild.textContent = 'Riga ' + r.line + ': ' + r.error;
      if (r.line) marks.push(cm.markText({ line: r.line - 1, ch: 0 }, { line: r.line - 1, ch: 9999 }, { className: 'cm-lint-error' }));
      if (verbose) log('zlangc: errore alla riga ' + r.line + ' — ' + r.error, 'err');
      updateAnchorPreview(); return null;
    }
    const hash = await sha256hex(r.bytecode);
    last = { ...r, hash, file: fs.active };
    if ($('#toolchain').value === 'zlangc') {
      const head = document.createElement('div'); head.className = 'ok'; head.textContent = '✓ ' + r.bytecode.length + ' byte · ' + r.instructions + ' istruzioni · ZLB2 v2.5';
      const h = document.createElement('div'); h.className = 'kv'; h.textContent = 'sha256 ' + hash;
      const dis = document.createElement('pre'); dis.className = 'hex'; dis.textContent = ZLangC.disassemble(r.bytecode).map((x) => x.offset.toString(16).padStart(4, '0') + '  ' + x.name.padEnd(12) + ' ' + x.payload).join('\n');
      const hx = document.createElement('pre'); hx.className = 'hex'; hx.textContent = hexdump(r.bytecode);
      const row = document.createElement('div'); row.className = 'row wrap';
      const b1 = document.createElement('button'); b1.className = 'btn sm'; b1.type = 'button'; b1.textContent = 'Scarica .zbin'; b1.onclick = () => download(fs.active.replace(/\.\w+$/, '') + '.zbin', new Blob([r.bytecode]));
      const b2 = document.createElement('button'); b2.className = 'btn sm'; b2.type = 'button'; b2.textContent = 'Scarica header .h'; b2.onclick = () => download(fs.active.replace(/\.\w+$/, '') + '.h', new Blob([r.header], { type: 'text/plain' }));
      row.append(b1, b2); out.append(head, h, dis, hx, row);
      if (verbose) log('zlangc: compilato ' + fs.active + ' (' + r.bytecode.length + ' byte, ' + r.instructions + ' istruzioni)', 'ok');
    } else {
      const w = await ZLangWasm.compile(src);
      if (!w.ok) { out.innerHTML = '<div class="err"></div>'; out.firstChild.textContent = w.error; if (verbose) log(w.error, 'err'); }
      else {
        const lines = w.text.split('\n').filter(Boolean); const unk = lines.filter((l) => l.startsWith('UNKNOWN_OPCODE')).length;
        const head = document.createElement('div'); head.className = unk ? 'err' : 'ok'; head.textContent = (unk ? '⚠ ' : '✓ ') + lines.length + ' istruzioni' + (unk ? ' · ' + unk + ' non riconosciute dalla VM' : '');
        const pre = document.createElement('pre'); pre.className = 'hex'; pre.textContent = w.text;
        out.append(head, pre);
        if (verbose) log('Compiler Rust (WASM): ' + lines.length + ' istruzioni' + (unk ? ', ' + unk + ' UNKNOWN_OPCODE' : ''), unk ? 'warn' : 'ok');
      }
    }
    updateAnchorPreview(); return last;
  }
  async function doRun() {
    log('VM ZLang (Rust → WASM): esecuzione di ' + fs.active, 'info');
    const r = await ZLangWasm.run(cm.getValue());
    if (!r.ok) return log(r.error, 'err');
    r.text.split('\n').filter(Boolean).forEach((l) => log(l, /Errore|UNKNOWN/.test(l) ? 'err' : /HALT|completata/.test(l) ? 'ok' : ''));
  }
  $('#bCompile').onclick = () => doCompile(true);
  $('#bRun').onclick = doRun; $('#dRun').onclick = doRun;

  /* ---------- K.I.R.A. ---------- */
  function runLint() {
    const ul = $('#lintOut'); ul.innerHTML = '';
    const items = Kira.lint(cm.getValue());
    if (!items.length) { const li = document.createElement('li'); li.className = 'info'; li.textContent = 'Nessuna segnalazione.'; ul.appendChild(li); return; }
    items.forEach((x) => { const li = document.createElement('li'); li.className = x.level; li.textContent = 'r.' + x.line + ' · ' + x.msg; li.onclick = () => { cm.setCursor({ line: x.line - 1, ch: 0 }); cm.focus(); if (isMobile()) setView('editor'); }; ul.appendChild(li); });
  }
  $('#kBtn').onclick = async () => {
    const mint = $('#kMint').value.trim(); const cl = $('#kCluster').value; const out = $('#kOut');
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) { out.innerHTML = '<div class="err">Indirizzo non valido.</div>'; return; }
    out.textContent = 'Controllo in corso…';
    try {
      const r = await Kira.tokenChecks(cl, mint);
      out.innerHTML = ''; const v = document.createElement('div'); v.className = r.fails ? 'err' : 'ok'; v.textContent = 'Esito: ' + r.verdict; out.appendChild(v);
      const ul = document.createElement('ul'); ul.className = 'chk-list';
      r.checks.forEach((c) => { const li = document.createElement('li'); li.innerHTML = '<b class="s-' + c.status + '">' + { ok: '✓', fail: '✗', warn: '!', nd: '–' }[c.status] + '</b><span></span>'; li.lastChild.textContent = c.label + ': ' + c.detail; ul.appendChild(li); });
      out.appendChild(ul);
      if (mint === '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4') { const p = document.createElement('p'); p.className = 'tiny muted'; p.textContent = '$DSN ufficiale su Solana (Token-2022, 6 decimali). Su Polygon: 0xfc90516a1f736FaC557e09D8853dB80dA192c296.'; out.appendChild(p); }
      log('K.I.R.A.: ' + mint.slice(0, 6) + '… su ' + cl + ' → ' + r.verdict, r.fails ? 'warn' : 'ok');
    } catch (e) { out.innerHTML = '<div class="err"></div>'; out.firstChild.textContent = 'RPC non raggiungibile: ' + e.message; log('K.I.R.A.: ' + e.message, 'err'); }
  };

  /* ---------- rete / wallet ---------- */
  let cluster = 'devnet';
  let mainnetOk = false;
  function provider() { const p = (window.phantom && window.phantom.solana) || window.solana; return p && p.isPhantom ? p : null; }
  let pubkey = null;
  function setCluster(c) {
    cluster = c; $('#cluster').value = c;
    const pill = $('#netPill'); pill.textContent = ZComm.CLUSTERS[c].label; pill.classList.toggle('main', c === 'mainnet-beta');
    $('#mainnetWarn').classList.toggle('hidden', c !== 'mainnet-beta');
    $('#dFaucet').classList.toggle('hidden', c === 'mainnet-beta');
    $('#dAnchor').textContent = 'Firma e ancora su ' + ZComm.CLUSTERS[c].label;
    $('#zRpc').value = ZComm.customRpc(c); $('#zEp').textContent = ZComm.endpoint(c);
    refreshBal();
  }
  $('#cluster').onchange = async (e) => {
    const c = e.target.value;
    if (c === 'mainnet-beta' && !mainnetOk) {
      const ok = await confirmModal('Passare a Mainnet?', '<p>Su mainnet ogni transazione usa <b>SOL reali</b> per la commissione e resta pubblica per sempre. L’IDE non sposta fondi, ma la firma resta una tua decisione.</p><label class="row chk"><input type="checkbox" data-required> Ho capito, voglio usare mainnet in questa sessione</label>');
      if (!ok) { e.target.value = cluster; return; }
      mainnetOk = true; log('Rete Mainnet attivata su tua conferma.', 'warn');
    }
    setCluster(c);
  };
  async function connect() {
    const p = provider();
    if (!p) {
      const url = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin);
      const a = document.createElement('a'); a.href = url; a.textContent = 'Apri questa pagina nel browser di Phantom'; a.target = '_blank'; a.rel = 'noopener';
      log('Phantom non trovato. Su desktop installa l’estensione; su telefono:', 'warn'); logNode(a); return null;
    }
    try { const r = await p.connect(); pubkey = r.publicKey.toString(); onWallet(); return pubkey; }
    catch (e) { log('Connessione rifiutata: ' + (e.message || e), 'warn'); return null; }
  }
  function onWallet() {
    const short = pubkey.slice(0, 4) + '…' + pubkey.slice(-4);
    $('#dAddr').textContent = pubkey; $('#topConnect').textContent = short; $('#dConnect').textContent = 'Disconnetti';
    log('Phantom collegato: ' + short + ' (solo indirizzo pubblico)', 'ok'); refreshBal();
  }
  async function disconnect() { try { await provider().disconnect(); } catch (_) {} pubkey = null; $('#dAddr').textContent = 'non collegato'; $('#dBal').textContent = '—'; $('#topConnect').textContent = 'Collega Phantom'; $('#dConnect').textContent = 'Collega Phantom'; log('Wallet scollegato.', 'info'); }
  $('#topConnect').onclick = () => (pubkey ? setPanel('deploy') : connect());
  $('#dConnect').onclick = () => (pubkey ? disconnect() : connect());
  async function refreshBal() {
    if (!pubkey) return;
    try { const r = await ZComm.rpc(cluster, 'getBalance', [pubkey, { commitment: 'confirmed' }]); $('#dBal').textContent = (r.value / 1e9).toLocaleString('it-IT', { maximumFractionDigits: 6 }) + ' SOL (' + ZComm.CLUSTERS[cluster].label + ')'; }
    catch (e) { $('#dBal').textContent = 'n/d'; log('Saldo non disponibile: ' + e.message, 'err'); }
  }
  $('#dRefresh').onclick = refreshBal;
  function memoText(r) { return 'zlang-ide:v1 zlb2:2.5 sha256:' + r.hash + ' bytes:' + r.bytecode.length; }
  function updateAnchorPreview() { $('#anchorPreview').textContent = last ? 'Memo pubblico: ' + memoText(last) : 'Compila senza errori con zlangc per preparare il memo.'; $('#dAnchor').disabled = !last; }

  async function waitConfirm(sig) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await ZComm.rpc(cluster, 'getSignatureStatuses', [[sig]]);
      const s = st && st.value && st.value[0];
      if (s && s.err) throw new Error('transazione fallita: ' + JSON.stringify(s.err));
      if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return s;
    }
    throw new Error('conferma non arrivata entro 45 s (controlla sull’explorer)');
  }

  $('#dAnchor').onclick = async () => {
    const r = await doCompile(false);
    if (!r) return log('Prima correggi gli errori di compilazione.', 'err');
    if (!pubkey && !(await connect())) return;
    const memo = memoText(r);
    const net = ZComm.CLUSTERS[cluster].label;
    const ok = await confirmModal('Ancorare su ' + net + '?', '<p class="tiny">Phantom ti chiederà di firmare una transazione Memo. Nessun trasferimento di token o SOL, solo la commissione di rete' + (cluster === 'mainnet-beta' ? ' <b>in SOL reali</b>' : ' (SOL di test)') + '.</p><p class="kv"></p>' + (cluster !== 'mainnet-beta' ? '<p class="tiny muted">In Phantom attiva “Modalità testnet” e scegli ' + net + ', altrimenti l’anteprima della firma può mostrare un avviso.</p>' : '<label class="row chk"><input type="checkbox" data-required> Confermo: commissione in SOL reali su mainnet</label>'));
    if (!ok) return log('Ancoraggio annullato.', 'info');
    try {
      const { Transaction, TransactionInstruction, PublicKey } = window.solanaWeb3;
      const bh = await ZComm.rpc(cluster, 'getLatestBlockhash', [{ commitment: 'finalized' }]);
      const payer = new PublicKey(pubkey);
      const tx = new Transaction({ feePayer: payer, recentBlockhash: bh.value.blockhash });
      tx.add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: new TextEncoder().encode(memo) }));
      log('Richiesta firma a Phantom…', 'info');
      const signed = await provider().signTransaction(tx);
      const raw = signed.serialize();
      const b64 = btoa(String.fromCharCode.apply(null, Array.from(raw)));
      const sig = await ZComm.rpc(cluster, 'sendTransaction', [b64, { encoding: 'base64', preflightCommitment: 'confirmed' }]);
      log('Inviata: ' + sig, 'ok');
      await waitConfirm(sig);
      const a = document.createElement('a'); a.href = ZComm.explorerTx(cluster, sig); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ancorato su ' + net + ' ↗ ' + sig.slice(0, 16) + '…';
      logNode(a);
      addHist({ sig, cluster, hash: r.hash, file: r.file, at: new Date().toISOString() });
      refreshBal();
    } catch (e) { const m = String(e.message || e); log('Ancoraggio non riuscito: ' + m, 'err'); if (/pay transaction fees|insufficient|no record of a prior credit/i.test(m)) log('Il wallet non ha SOL su ' + net + ' per la commissione.' + (cluster !== 'mainnet-beta' ? ' SOL di test gratuiti: faucet.solana.com' : ''), 'warn'); }
  };
  function hist() { try { return JSON.parse(localStorage.getItem('zide.anchors') || '[]'); } catch (_) { return []; } }
  function addHist(x) { const h = hist(); h.unshift(x); localStorage.setItem('zide.anchors', JSON.stringify(h.slice(0, 30))); renderHist(); }
  function renderHist() { const ul = $('#anchorHist'); ul.innerHTML = ''; hist().forEach((x) => { const li = document.createElement('li'); li.className = 'ok'; const a = document.createElement('a'); a.href = ZComm.explorerTx(x.cluster, x.sig); a.target = '_blank'; a.rel = 'noopener'; a.textContent = x.file + ' · ' + ZComm.CLUSTERS[x.cluster].label + ' · ' + x.sig.slice(0, 10) + '…'; li.appendChild(a); ul.appendChild(li); }); }
  $('#vBtn').onclick = async () => {
    const sig = $('#vSig').value.trim(); if (!sig) return;
    try {
      const tx = await ZComm.rpc(cluster, 'getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
      if (!tx) return log('Transazione non trovata su ' + ZComm.CLUSTERS[cluster].label + '.', 'err');
      const ix = tx.transaction.message.instructions.find((i) => i.programId === MEMO_PROGRAM);
      const memo = ix ? (typeof ix.parsed === 'string' ? ix.parsed : '') : '';
      const m = memo.match(/sha256:([0-9a-f]{64})/);
      if (!m) return log('Nessun memo zlang-ide in questa transazione.', 'warn');
      const cur = last && last.hash;
      log('Memo trovato: ' + memo, 'info');
      log(cur === m[1] ? '✓ Corrisponde al bytecode compilato ora (' + fs.active + ').' : '✗ Non corrisponde al bytecode compilato ora.', cur === m[1] ? 'ok' : 'warn');
    } catch (e) { log('Verifica non riuscita: ' + e.message, 'err'); }
  };

  /* ---------- zcomm ---------- */
  ZComm.onEvent((e) => {
    if (e.status === 'pending') return;
    const ul = $('#zLog'); const li = document.createElement('li'); li.className = e.status;
    li.textContent = JSON.stringify({ sender: e.env.sender, recipient: e.env.recipient, payload: { method: e.env.payload.method }, timestamp: e.env.timestamp }) + ' → ' + e.status + ' ' + e.ms + ' ms' + (e.endpoint ? ' · ' + new URL(e.endpoint).host : '') + (e.error ? ' · ' + e.error : '');
    ul.prepend(li); while (ul.children.length > 40) ul.lastChild.remove();
  });
  $('#zSave').onclick = () => { const v = $('#zRpc').value.trim(); if (v && !/^https:\/\//.test(v)) return log('Serve un endpoint https://', 'err'); ZComm.setCustomRpc(cluster, v); $('#zEp').textContent = ZComm.endpoint(cluster); log('Endpoint ' + ZComm.CLUSTERS[cluster].label + ': ' + ZComm.endpoint(cluster), 'ok'); };
  $('#zPing').onclick = async () => {
    try { const v = await ZComm.rpc(cluster, 'getVersion'); const s = await ZComm.rpc(cluster, 'getSlot'); log('zcomm → ' + ZComm.CLUSTERS[cluster].label + ': solana-core ' + v['solana-core'] + ', slot ' + s.toLocaleString('it-IT'), 'ok'); }
    catch (e) { log('zcomm: endpoint non raggiungibile — ' + e.message, 'err'); }
  };

  /* ---------- avvio ---------- */
  renderTree(); renderHist(); setCluster('devnet');
  openFile(fs.active in fs.files ? fs.active : Object.keys(fs.files)[0]);
  ZLangWasm.version().then((v) => { const p = $('#wasmPill'); if (v.ok) { p.textContent = 'WASM ✓'; p.title = v.text; log('Compilatore pronto: ' + v.text, 'ok'); } else { p.textContent = 'WASM ✗'; log('WASM non disponibile: ' + v.error, 'err'); } }).catch((e) => { $('#wasmPill').textContent = 'WASM ✗'; log('WASM non disponibile: ' + e.message, 'err'); });
  log('Zlang IDE pronto. Rete predefinita: Devnet. Le firme le fa solo Phantom.', 'info');
  const p = provider(); if (p) p.connect({ onlyIfTrusted: true }).then((r) => { pubkey = r.publicKey.toString(); onWallet(); }).catch(() => {});
})();
