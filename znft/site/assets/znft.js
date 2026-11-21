/*! zNFT · galleria e marketplace di OurVelvet (DEVNET) · ZDOS1.3. Nessuna chiave nel browser: firma solo Phantom. */
(function () {
  'use strict';
  const API = '/znft/api';
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#zapp');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (w) => w ? w.slice(0, 4) + '…' + w.slice(-4) : '';
  const ex = (kind, a) => `https://explorer.solana.com/${kind}/${a}?cluster=devnet`;
  const st = { wallet: null, token: null };
  try { const s = JSON.parse(sessionStorage.getItem('znft') || 'null'); if (s && s.exp > Date.now()) Object.assign(st, s); } catch (e) {}
  function toast(m, ms) { const t = $('#ztoast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, ms || 4200); }
  async function api(p, opt) {
    opt = opt || {}; const h = { 'content-type': 'application/json' }; if (st.token) h.authorization = 'Bearer ' + st.token;
    const r = await fetch(API + p, { method: opt.method || (opt.body ? 'POST' : 'GET'), headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (r.status === 401) { st.token = null; save(); }
    if (!r.ok) { const e = new Error(j.error || ('errore ' + r.status)); e.data = j; throw e; }
    return j;
  }
  function save() { sessionStorage.setItem('znft', JSON.stringify({ wallet: st.wallet, token: st.token, exp: Date.now() + 11 * 3600e3 })); paintWallet(); }
  // ---- base58
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58(bytes) { let d = [], s = ''; for (const b of bytes) { let c = b; for (let j = 0; j < d.length; j++) { c += d[j] << 8; d[j] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } }
    for (const b of bytes) { if (b) break; s += '1'; } for (let i = d.length - 1; i >= 0; i--) s += A[d[i]]; return s; }
  // ---- Phantom
  function provider() { const p = (window.phantom && window.phantom.solana) || window.solana; return p && p.isPhantom ? p : null; }
  function phantomLink() { return 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href) + '?ref=' + encodeURIComponent(location.origin); }
  async function connect() {
    const p = provider();
    if (!p) { if (/Android|iPhone|iPad/i.test(navigator.userAgent)) { location.href = phantomLink(); return null; } toast('Phantom non trovato: installa l\'estensione o apri la pagina nel browser di Phantom.', 6000); return null; }
    const r = await p.connect(); st.wallet = r.publicKey.toString(); save(); return st.wallet;
  }
  async function signText(msg) { const p = provider(); const r = await p.signMessage(new TextEncoder().encode(msg), 'utf8'); return b58(r.signature); }
  async function login() {
    if (st.token && st.wallet) return st.wallet;
    const w = st.wallet || await connect(); if (!w) throw new Error('wallet non collegato');
    const n = await api('/auth/nonce', { body: { wallet: w } }); const sig = await signText(n.message);
    const v = await api('/auth/verify', { body: { wallet: w, nonce: n.nonce, signature: sig } }); st.token = v.token; save(); return w;
  }
  async function signSend(message) {
    const p = provider(); if (!p) throw new Error('Phantom non disponibile');
    const r = await p.request({ method: 'signAndSendTransaction', params: { message } }); return r.signature || r;
  }
  function paintWallet() { const b = $('#zwallet'); if (!b) return; b.textContent = st.wallet ? (st.token ? '● ' : '○ ') + short(st.wallet) : 'Collega Phantom'; }
  $('#zwallet').addEventListener('click', async () => { try { if (st.token) { location.hash = '#/miei'; return; } await login(); toast('Accesso fatto con la firma del messaggio. Nessuna transazione.'); route(); } catch (e) { toast(e.message); } });

  // ---- componenti
  function img(w, big) {
    if (!w.preview) return `<div class="zimg"><div class="zph">Anteprima non pubblicata<br>l'opera resta all'artista<br><span class="zhash">${esc((w.sha256 || '').slice(0, 16))}…</span></div></div>`;
    const blur = !w.example; return `<div class="zimg${blur ? ' blur' : ''}" data-reveal><img loading="lazy" alt="${esc(w.title)}" src="${esc(w.preview)}">${blur ? '<div class="zveil">Opera 18+ · tocca per vedere</div>' : ''}</div>`;
  }
  function card(w) {
    return `<a class="zcard" href="#/opera/${esc(w.slug)}">${img(w)}<div class="zcb"><div class="zrow">${w.example ? '<span class="zchip v">opera di esempio</span>' : '<span class="zchip ok">certificata</span>'}</div>
      <h3>${esc(w.title)}</h3><div class="zmeta">di ${esc(w.artist_nick)}${w.collection ? ' · ' + esc(w.collection.name) : ''}</div>
      <div class="zprice">${w.listing ? `<span class="zmuted">Prezzo</span><b>${esc(w.listing.price_fmt)} VPAY</b>` : '<span class="zmuted">Non in vendita</span><span></span>'}</div></div></a>`;
  }
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-reveal].blur'); if (r) { e.preventDefault(); r.classList.remove('blur'); const v = r.querySelector('.zveil'); if (v) v.remove(); } });
  const loading = () => { app.innerHTML = '<p class="zmuted">Caricamento…</p>'; };
  const errBox = (e) => `<div class="zbox"><h3 class="zbad">Errore</h3><p>${esc(e.message)}</p></div>`;
  function need(fn) { return async (...a) => { try { await login(); return await fn(...a); } catch (e) { toast(e.message, 6000); } }; }

  // ---- pagine
  async function home() {
    const [s, ws, cs] = await Promise.all([api('/stats'), api('/works'), api('/collections')]);
    const strip = ws.filter(w => w.preview && w.example).slice(0, 3);
    app.innerHTML = `<section class="zhero"><div><span class="zchip v">DEVNET · test</span>
      <h1>La galleria dove ogni opera 18+ ha un <em>certificato vero</em>.</h1>
      <p>zNFT certifica opere d'arte di nudo caricate dagli artisti: autore, consenso firmato di ogni modello, dichiarazione 18+, hash SHA-256 del file, provenienza e storia dei passaggi. I certificati sono asset Metaplex Core su Solana, le regole sono programmi Zlang, i pagamenti sono in Velvet Pay.</p>
      <div class="zrow"><a class="zbtn p" href="#/crea">Certifica un'opera</a><a class="zbtn" href="#/collezioni">Esplora le collezioni</a><a class="zbtn" href="#/vpay">Velvet Pay di test</a></div></div>
      <div class="zstrip">${strip.map(w => `<a href="#/opera/${esc(w.slug)}"><img alt="${esc(w.title)}" src="${esc(w.preview)}"></a>`).join('')}</div></section>
      <div class="zstats"><div class="zstat"><b>${s.opere_certificate}</b><span>opere certificate da artisti</span></div><div class="zstat"><b>${s.opere_esempio}</b><span>opere di esempio (astratte)</span></div>
      <div class="zstat"><b>${s.annunci_attivi}</b><span>in vendita ora</span></div><div class="zstat"><b>${s.vendite}</b><span>vendite completate</span></div><div class="zstat"><b>${s.collezioni}</b><span>collezioni</span></div></div>
      <h2 class="zh">Collezioni</h2><div class="zgrid">${cs.map(c => `<a class="zcard" href="#/collezione/${esc(c.slug)}"><div class="zimg">${c.cover ? `<img alt="" src="${esc(c.cover)}">` : '<div class="zph">collezione</div>'}</div><div class="zcb">${c.example ? '<span class="zchip v">esempio</span>' : ''}<h3>${esc(c.name)}</h3><div class="zmeta">di ${esc(c.artist_nick)} · ${c.opere} opere</div></div></a>`).join('')}</div>
      <h2 class="zh">Opere</h2><div class="zfilters"><input id="fq" type="text" placeholder="Cerca titolo, artista, tecnica" aria-label="Cerca"><select id="fs" aria-label="Ordina"><option value="recenti">Più recenti</option><option value="prezzo_su">Prezzo crescente</option><option value="prezzo_giu">Prezzo decrescente</option></select><label class="zcheck" style="margin:0"><input id="fl" type="checkbox"> solo in vendita</label></div>
      <div class="zgrid" id="fw">${ws.map(card).join('')}</div>
      <h2 class="zh">Come funziona</h2><div class="zsteps"><div><b>1 · L'artista firma</b>Collega Phantom, calcola l'hash del file nel browser (il file non viene caricato) e firma la dichiarazione 18+ e sui diritti.</div><div><b>2 · I modelli firmano</b>Ogni persona ritratta apre il link di consenso e firma con il proprio wallet. Senza tutte le firme non si va avanti.</div><div><b>3 · Regole Zlang e staff</b>Il programma <code>znft_regole.zlang</code> controlla i requisiti; poi una persona dello staff rivede l'opera.</div><div><b>4 · Certificato on-chain</b>Il certificato diventa un asset Metaplex Core su devnet. Si vende in VPAY; la consegna avviene solo dopo il pagamento verificato.</div></div>
      <p class="zsmall zmuted" style="margin-top:16px">Le opere di esempio sono astratte e generate per mostrare la galleria: nessuna immagine di nudo è creata dalla piattaforma. Codice delle regole: <a href="#/regole">Regole Zlang</a> · <a href="/ide/">IDE Zlang</a> · <a href="https://x-zdos.it/dev/">Portale dev</a>.</p>`;
    const fw = $('#fw'); let t;
    const reload = async () => { const q = $('#fq').value, o = $('#fs').value, l = $('#fl').checked ? '1' : '0'; const r = await api(`/works?q=${encodeURIComponent(q)}&ordine=${o}&in_vendita=${l}`); fw.innerHTML = r.length ? r.map(card).join('') : '<p class="zmuted">Nessuna opera con questi filtri.</p>'; };
    $('#fq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(reload, 250); }); $('#fs').addEventListener('change', reload); $('#fl').addEventListener('change', reload);
  }
  async function collections() {
    const cs = await api('/collections');
    app.innerHTML = `<h2 class="zh">Collezioni</h2><div class="zgrid">${cs.map(c => `<a class="zcard" href="#/collezione/${esc(c.slug)}"><div class="zimg">${c.cover ? `<img alt="" src="${esc(c.cover)}">` : '<div class="zph">collezione</div>'}</div><div class="zcb">${c.example ? '<span class="zchip v">esempio</span>' : ''}<h3>${esc(c.name)}</h3><div class="zmeta">di ${esc(c.artist_nick)} · ${c.opere} opere</div></div></a>`).join('')}</div>`;
  }
  async function collection(slug) {
    const c = await api('/collections/' + encodeURIComponent(slug)); const cover = c.works.find(w => w.preview);
    app.innerHTML = `<div class="zcollhead">${cover ? `<img alt="" src="${esc(cover.preview)}">` : ''}<div><h2 class="zh" style="margin:0">${esc(c.name)}</h2><div class="zmuted">di <a href="#/artista/${esc(c.artist)}">${esc(c.artist_nick)}</a> ${c.example ? '<span class="zchip v">esempio</span>' : ''}</div><p class="zsmall">${esc(c.description || '')}</p></div></div>
      <div class="zstats"><div class="zstat"><b>${c.works.length}</b><span>opere</span></div><div class="zstat"><b>${c.owners}</b><span>proprietari</span></div><div class="zstat"><b>${c.floor ? esc(c.floor) + ' VPAY' : '—'}</b><span>prezzo più basso</span></div></div>
      <div class="zgrid">${c.works.map(card).join('')}</div>`;
  }
  async function artist(wallet) {
    const a = await api('/artists/' + encodeURIComponent(wallet));
    app.innerHTML = `<h2 class="zh">${esc(a.nick)}</h2><p class="zmuted zsmall">Wallet <a href="${ex('address', a.wallet)}" target="_blank" rel="noopener">${esc(short(a.wallet))}</a></p><p>${esc(a.bio || '')}</p>
      <h2 class="zh">Creazioni</h2>${a.creazioni.length ? `<div class="zgrid">${a.creazioni.map(card).join('')}</div>` : '<p class="zmuted">Ancora nessuna opera certificata.</p>'}
      <h2 class="zh">Possedute</h2>${a.possedute.length ? `<div class="zgrid">${a.possedute.map(card).join('')}</div>` : '<p class="zmuted">Nessuna opera posseduta.</p>'}`;
  }
  async function work(slug) {
    const w = await api('/works/' + encodeURIComponent(slug)); const c = w.certificate; const mine = st.wallet && w.owner === st.wallet;
    const KIND = { mint: 'certificato creato', annuncio: 'messo in vendita', vendita: 'venduto', consenso: 'consenso firmato', bozza: 'bozza', upgrade: 'upgrade da NFT esistente', revisione: 'in revisione', certificata: 'approvato', annullato: 'annuncio ritirato', pagato: 'pagato', rifiutata: 'rifiutato', rimossa: 'rimosso' };
    app.innerHTML = `<div class="zwork"><div>${img(w, true)}<p class="zsmall zmuted">${w.example ? 'Opera astratta di esempio, generata per la demo.' : 'L\'anteprima è caricata dall\'artista. Il file originale resta all\'artista: on-chain c\'è solo il suo hash.'}</p></div>
      <div><div class="zrow">${w.example ? '<span class="zchip v">opera di esempio</span>' : '<span class="zchip ok">certificata</span>'}<span class="zchip w">DEVNET</span>${w.collection ? `<a class="zchip" href="#/collezione/${esc(w.collection.slug)}">${esc(w.collection.name)}</a>` : ''}</div>
      <h1 style="font-family:Georgia,serif;margin:10px 0 4px;color:#fff">${esc(w.title)}</h1>
      <p class="zmuted">di <a href="#/artista/${esc(w.artist)}">${esc(w.artist_nick)}</a> · proprietario <a href="#/artista/${esc(w.owner)}">${esc(w.owner_nick || short(w.owner))}</a></p>
      <p>${esc(w.description || '')}</p>
      <div class="zbox" id="buybox">${w.listing ? `<div class="zprice" style="font-size:15px"><span class="zmuted">Prezzo</span><b>${esc(w.listing.price_fmt)} VPAY</b></div>
        ${mine ? `<button class="zbtn s" id="bcancel" type="button">Ritira dall'annuncio</button>` : `<button class="zbtn p" id="bbuy" type="button" style="width:100%;margin-top:10px">Compra con Velvet Pay</button><p class="zsmall zmuted">Firmi in Phantom un pagamento VPAY al venditore. Dopo la verifica on-chain la piattaforma consegna il certificato al tuo wallet. Solo devnet.</p>`}`
        : mine ? `<h3>Metti in vendita</h3><div class="zrow"><input id="lprice" type="number" min="1" max="10000000" step="1" placeholder="Prezzo in VPAY" aria-label="Prezzo in VPAY"><button class="zbtn p" id="blist" type="button">Pubblica annuncio</button></div><p class="zsmall zmuted">Le regole <code>znft_vendita.zlang</code> controllano possesso on-chain e prezzo.</p>` : '<p class="zmuted" style="margin:0">Non in vendita.</p>'}</div>
      <div class="zbox"><h3>Certificato</h3><dl class="zkv">
        <dt>Autore</dt><dd><a href="${ex('address', c.autore)}" target="_blank" rel="noopener">${esc(c.autore)}</a></dd>
        <dt>Firma autore</dt><dd class="zhash">${c.autore_firma ? 'sha256 ' + esc(c.autore_firma) : '—'}</dd>
        <dt>Persone ritratte</dt><dd>${c.persone_ritratte}</dd>
        <dt>Consensi firmati</dt><dd>${c.consensi.length ? c.consensi.map(x => `${esc(x.model)} · ${esc(x.firmato.slice(0, 10))}`).join('<br>') : (c.persone_ritratte ? '<span class="zbad">mancanti</span>' : 'non necessari')}</dd>
        <dt>Età 18+</dt><dd>${esc(c.eta)}</dd>
        <dt>SHA-256 file</dt><dd class="zhash">${esc(c.sha256)}</dd>
        <dt>Provenienza</dt><dd>${esc(c.provenienza)}</dd>
        <dt>Asset Core</dt><dd>${w.asset ? `<a href="${ex('address', w.asset)}" target="_blank" rel="noopener">${esc(w.asset)}</a>` : '—'}</dd>
        <dt>Royalty</dt><dd>${(w.royalty_bps / 100).toLocaleString('it-IT')}%</dd></dl>
        <div class="zrow" style="margin-top:12px"><button class="zbtn s" id="brules" type="button">Esegui le regole Zlang nel browser</button><label class="zbtn s" style="margin:0">Verifica un file<input id="vfile" type="file" hidden></label></div><div id="rulesout"></div></div>
      <div class="zbox"><h3>Storia</h3><table class="zt"><tr><th>Quando</th><th>Evento</th><th>Da → a</th><th>Tx</th></tr>${w.history.map(h => `<tr><td>${esc(h.at.slice(0, 16).replace('T', ' '))}</td><td>${esc(KIND[h.kind] || h.kind)}${h.detail ? '<br><span class="zmuted">' + esc(h.detail.slice(0, 90)) + '</span>' : ''}</td><td>${esc(short(h.from_w))}${h.to_w ? ' → ' + esc(short(h.to_w)) : ''}</td><td>${h.sig ? `<a href="${ex('tx', h.sig)}" target="_blank" rel="noopener">${esc(h.sig.slice(0, 8))}…</a>` : ''}</td></tr>`).join('')}</table></div>
      <details class="zbox"><summary>Segnala questa opera</summary><label for="rreason">Motivo</label><select id="rreason"><option value="minore">Possibile persona minorenne</option><option value="consenso">Consenso mancante o revocato</option><option value="furto">Opera non dell'autore</option><option value="esplicito">Contenuto fuori dalle regole</option><option value="altro">Altro</option></select>
        <label for="rdet">Dettagli (facoltativi)</label><textarea id="rdet" maxlength="600"></textarea><button class="zbtn s" id="brep" type="button" style="margin-top:8px">Invia segnalazione</button><p class="zsmall zmuted">Con i motivi “minorenne” o “consenso” l'opera viene sospesa subito, in attesa dello staff.</p></details>
      </div></div>`;
    $('#brules').onclick = async () => {
      const out = $('#rulesout'); try {
        const bc = new Uint8Array(await (await fetch('/znft/zlang/znft_regole.zlb', { cache: 'no-store' })).arrayBuffer()); const sha = await ZRules.sha256hex(bc); const r = ZRules.run(bc, c.regole.input);
        out.innerHTML = `<p class="${r.ok ? 'zok' : 'zbad'}">Esito: ${esc(r.esito)}</p><p class="zsmall">Bytecode ZLB2 ${bc.length} byte · sha256 ${esc(sha)} ${sha === c.regole.bytecode_sha256 ? '<span class="zok">uguale a quello del server</span>' : '<span class="zbad">diverso dal server</span>'}</p><div class="zcode">${esc(r.trace.join('\n'))}</div>`;
      } catch (e) { out.innerHTML = `<p class="zbad">${esc(e.message)}</p>`; }
    };
    $('#vfile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const h = await ZRules.sha256hex(await f.arrayBuffer()); $('#rulesout').innerHTML = h === c.sha256 ? `<p class="zok">Il file corrisponde al certificato (sha256 ${esc(h)}).</p>` : `<p class="zbad">Il file NON corrisponde: sha256 ${esc(h)}.</p>`; };
    $('#brep').onclick = async () => { try { const r = await api('/reports', { body: { work_id: w.id, reason: $('#rreason').value, detail: $('#rdet').value } }); toast(r.messaggio || 'Segnalazione inviata.', 6000); if (r.sospesa) location.hash = '#/'; } catch (e) { toast(e.message); } };
    const bb = $('#bbuy'); if (bb) bb.onclick = need(async () => { bb.disabled = true; try { await buy(w); } finally { bb.disabled = false; } });
    const bl = $('#blist'); if (bl) bl.onclick = need(async () => { await list(w, $('#lprice').value); });
    const bc2 = $('#bcancel'); if (bc2) bc2.onclick = need(async () => { await api(`/listings/${w.listing.id}/cancel`, { body: {} }); toast('Annuncio ritirato.'); route(); });
  }
  async function buy(w) {
    if (!provider()) throw new Error('Serve Phantom (in modalità Devnet).');
    const r = await api(`/buy/${w.listing.id}`, { body: {} }); toast(`Firma in Phantom il pagamento di ${r.prezzo} VPAY (devnet).`, 7000);
    const sig = await signSend(r.message); toast('Pagamento inviato, verifico on-chain…', 9000);
    const c = await api(`/buy/${w.listing.id}/confirm`, { body: { purchase: r.purchase, signature: sig } });
    toast(c.ok ? 'Fatto: il certificato è nel tuo wallet.' : c.errore, 8000); route();
  }
  async function list(w, price) {
    const p = parseInt(price, 10); if (!(p >= 1)) throw new Error('Prezzo non valido');
    let r = await api('/listings', { body: { work_id: w.id, price: p } });
    if (r.need_approve) { toast(r.spiegazione, 8000); await signSend(r.message); await new Promise(x => setTimeout(x, 2500)); r = await api('/listings', { body: { work_id: w.id, price: p } }); }
    toast('Annuncio pubblicato.'); route();
  }
  async function create() {
    const pre = new URLSearchParams((location.hash.split('?')[1]) || ''); const origin = pre.get('origine') || '';
    app.innerHTML = `<h2 class="zh">Certifica un'opera</h2><div class="zwork"><div class="zbox zform">
      ${origin ? `<p class="zok zsmall">Upgrade dell'NFT ${esc(origin)}: possesso verificato.</p>` : ''}
      <label for="cfile">File originale dell'opera (resta sul tuo dispositivo: calcoliamo solo l'hash)</label><input id="cfile" type="file"><div id="chash" class="zhash"></div>
      <label for="ctitle">Titolo</label><input id="ctitle" type="text" maxlength="80">
      <label for="ccol">Collezione (nuova o esistente)</label><input id="ccol" type="text" maxlength="60" placeholder="Es. Studi in rosso">
      <div class="zrow"><div style="flex:1"><label for="ctech">Tecnica</label><input id="ctech" type="text" maxlength="60" placeholder="Fotografia, olio, digitale…"></div><div style="width:110px"><label for="cyear">Anno</label><input id="cyear" type="text" maxlength="10"></div></div>
      <label for="cdesc">Descrizione</label><textarea id="cdesc" maxlength="1200"></textarea>
      <div class="zrow"><div style="flex:1"><label for="cpeople">Persone ritratte</label><input id="cpeople" type="number" min="0" max="10" value="1"></div><div style="flex:1"><label for="croy">Royalty sulle rivendite (%)</label><input id="croy" type="number" min="0" max="10" step="0.5" value="5"></div></div>
      <label for="cprev">Anteprima pubblica (facoltativa, PNG/JPEG/WebP, max 2 MB; i dati EXIF dei JPEG vengono rimossi)</label><input id="cprev" type="file" accept="image/png,image/jpeg,image/webp">
      <label class="zcheck"><input id="c18" type="checkbox"> Ho almeno 18 anni e ogni persona ritratta è maggiorenne.</label>
      <label class="zcheck"><input id="cdir" type="checkbox"> Sono autore/autrice dell'opera e ne detengo i diritti.</label>
      <label class="zcheck"><input id="ccons" type="checkbox"> Ogni persona ritratta firmerà il consenso con il proprio wallet.</label>
      <button class="zbtn p" id="cgo" type="button" style="margin-top:10px">Firma e crea la bozza</button><div id="cout"></div></div>
      <div><div class="zbox"><h3>Cosa succede</h3><ol class="zsmall"><li>Firmi in Phantom una dichiarazione con l'hash del file. Non è una transazione.</li><li>Ricevi un link di consenso da mandare a ogni persona ritratta.</li><li>Con tutte le firme, invii l'opera: girano le regole <a href="#/regole">znft_regole.zlang</a>.</li><li>Lo staff rivede e il certificato viene creato su devnet nel tuo wallet.</li></ol>
      <p class="zsmall zmuted">Regole: niente minori né persone che sembrano minorenni, niente opere senza consenso, niente immagini di terzi. La verifica documentale dell'età non è ancora attiva: per ora vale la dichiarazione firmata.</p></div></div></div>`;
    let sha = '', prev = null;
    $('#cfile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; $('#chash').textContent = 'calcolo…'; sha = await ZRules.sha256hex(await f.arrayBuffer()); $('#chash').textContent = 'SHA-256 ' + sha; if (!$('#ctitle').value) $('#ctitle').value = f.name.replace(/\.[^.]+$/, '').slice(0, 80); };
    $('#cprev').onchange = (e) => { const f = e.target.files[0]; if (!f) { prev = null; return; } if (f.size > 2 * 1024 * 1024) { toast('Anteprima oltre 2 MB'); e.target.value = ''; return; } const r = new FileReader(); r.onload = () => { prev = r.result; }; r.readAsDataURL(f); };
    $('#cgo').onclick = need(async () => {
      if (!sha) throw new Error('Scegli il file dell\'opera'); if (!$('#c18').checked || !$('#cdir').checked || !$('#ccons').checked) throw new Error('Servono le tre dichiarazioni');
      const title = $('#ctitle').value.trim(); const d = await api('/works/declaration', { body: { sha256: sha, title } }); const sig = await signText(d.message);
      const r = await api('/works', { body: { sha256: sha, title, nonce: d.nonce, signature: sig, collection: $('#ccol').value, technique: $('#ctech').value, year: $('#cyear').value, description: $('#cdesc').value,
        people: $('#cpeople').value, royalty_bps: Math.round(parseFloat($('#croy').value || '0') * 100), preview: prev, origin_nft: origin || undefined } });
      $('#cout').innerHTML = `<div class="zbox" style="margin-top:12px"><p class="zok">Bozza creata.</p>${r.persone ? `<p>Manda questo link a ognuna delle ${r.persone} persone ritratte:</p><div class="zcode">${esc(r.consent_link)}</div>` : ''}<p><a class="zbtn s" href="#/miei">Vai ai miei zNFT</a></p></div>`;
    });
  }
  async function consent(id) {
    const c = await api('/consent/' + id);
    app.innerHTML = `<h2 class="zh">Consenso alla certificazione</h2><div class="zbox"><dl class="zkv"><dt>Opera</dt><dd>${esc(c.title)}</dd><dt>Artista</dt><dd>${esc(c.artist_nick)} (${esc(short(c.artist))})</dd><dt>SHA-256</dt><dd class="zhash">${esc(c.sha256)}</dd><dt>Firme</dt><dd>${c.firmati} su ${c.persone}</dd></dl>
      <p class="zsmall">Firmando dichiari di avere almeno 18 anni, di essere ritratto/a in questa opera e di acconsentire alla certificazione e alla vendita come zNFT. È una firma di messaggio, non una transazione. Puoi revocare il consenso scrivendo allo staff.</p>
      <label class="zcheck"><input id="k18" type="checkbox"> Confermo: ho almeno 18 anni e sono una delle persone ritratte.</label><button class="zbtn p" id="kgo" type="button">Firma il consenso</button><div id="kout"></div></div>`;
    $('#kgo').onclick = need(async () => { if (!$('#k18').checked) throw new Error('Serve la conferma'); const n = await api(`/consent/${id}/nonce`, { body: {} }); const sig = await signText(n.message); const r = await api(`/consent/${id}`, { body: { nonce: n.nonce, signature: sig } }); $('#kout').innerHTML = `<p class="zok">Consenso firmato: ${r.firmati} su ${r.persone}.</p>`; });
  }
  async function upgrade() {
    app.innerHTML = `<h2 class="zh">Upgrade di un NFT esistente</h2><div class="zbox zform"><p class="zsmall">Trasforma un NFT che possiedi in un certificato zNFT. Verifichiamo on-chain, in sola lettura, che sia nel wallet con cui hai fatto l'accesso. Servono comunque il file originale, il consenso delle persone ritratte e le dichiarazioni: un NFT senza consenso verificabile non diventa zNFT. Il vecchio NFT non viene toccato.</p>
      <label for="unft">Indirizzo dell'NFT (mint Token Metadata o asset Core)</label><input id="unft" type="text" maxlength="44"><label for="unet">Rete</label><select id="unet"><option value="devnet">Devnet</option><option value="mainnet">Mainnet (solo lettura)</option></select>
      <button class="zbtn p" id="ugo" type="button" style="margin-top:10px">Verifica il possesso</button><div id="uout"></div></div>`;
    $('#ugo').onclick = need(async () => { const nft = $('#unft').value.trim(); const r = await api('/upgrade', { body: { nft, rete: $('#unet').value } });
      $('#uout').innerHTML = r.ok ? `<p class="zok">Possesso verificato (${esc(r.kind)} su ${esc(r.rete)}).</p><a class="zbtn s" href="#/crea?origine=${encodeURIComponent(nft)}">Continua con la certificazione</a>` : `<p class="zbad">Non risulta nel tuo wallet${r.reason ? ': ' + esc(r.reason) : ''}.</p>`; });
  }
  async function vpay() {
    const v = await api('/vpay'); let me = null; if (st.token) { try { me = await api('/me'); } catch (e) {} }
    app.innerHTML = `<h2 class="zh">Velvet Pay (VPAY) · moneta di test</h2><div class="zwork"><div class="zbox"><img src="/znft/assets/vpay.svg" alt="Velvet Pay" width="120" height="120" style="float:right;margin-left:12px">
      <dl class="zkv"><dt>Rete</dt><dd>Solana devnet</dd><dt>Standard</dt><dd>Token-2022, 6 decimali, metadata on-chain</dd><dt>Mint</dt><dd><a href="${esc(v.explorer)}" target="_blank" rel="noopener">${esc(v.mint)}</a></dd><dt>Collezione zNFT</dt><dd><a href="${esc(v.collection_explorer)}" target="_blank" rel="noopener">${esc(v.collection)}</a></dd>${me ? `<dt>Il tuo saldo</dt><dd>${esc(me.vpay)} VPAY · ${me.sol.toLocaleString('it-IT', { maximumFractionDigits: 4 })} SOL devnet</dd>` : ''}</dl>
      <p class="zsmall">VPAY serve solo a provare gli acquisti nella galleria. Non ha valore, non si compra e non promette rendimenti. Formato compatibile con VELVET ($OV) e $DSN su Solana (Token-2022, 6 decimali).</p>
      <button class="zbtn p" id="vf" type="button">Ricevi 1.000 VPAY di test</button><p class="zsmall zmuted">Una volta al giorno per wallet. Per firmare gli acquisti ti servono anche pochi SOL devnet da faucet.solana.com.</p><div id="vout"></div></div>
      <div class="zbox"><h3>Versione Polygon</h3><p class="zsmall">C'è un contratto ERC-20 con 18 decimali, lo stesso formato di $DSN NETkali, pronto per la testnet Amoy. Non è ancora pubblicato: servono POL di test. Un ponte tra Solana e Polygon non esiste ancora ed è indicato solo come lavoro futuro nella pagina <a href="https://x-zdos.it/rete/">Rete zDOS</a>.</p></div></div>`;
    $('#vf').onclick = need(async () => { const r = await api('/faucet', { body: {} }); $('#vout').innerHTML = `<p class="zok">Inviati 1.000 VPAY. <a href="${esc(r.explorer)}" target="_blank" rel="noopener">Vedi la transazione</a></p>`; });
  }
  async function rules() {
    const r = await api('/regole'); const D = { znft_regole: 'Certificazione: hash, dichiarazioni, consensi, segnalazioni', znft_vendita: 'Messa in vendita: possesso on-chain e prezzo', znft_acquisto: 'Acquisto: pagamento VPAY verificato prima della consegna' };
    app.innerHTML = `<h2 class="zh">Regole scritte in Zlang</h2><p class="zsmall">Tre programmi Zlang compilati con <code>zlangc</code> v2.5 in bytecode ZLB2. Il server esegue lo stesso bytecode prima di ogni passaggio, e qualsiasi pagina d'opera lo può rieseguire nel browser. I valori arrivano dal namespace <code>znft/</code> in sola lettura. Zlang oggi non produce programmi Solana: le regole girano fuori dalla chain, l'esecuzione on-chain è di Metaplex Core e Token-2022.</p>
      <div class="zrow" style="margin-bottom:14px"><a class="zbtn s" href="/ide/">Apri l'IDE Zlang</a><a class="zbtn s" href="https://x-zdos.it/dev/linguaggio/">Linguaggio Zlang (portale dev)</a></div>
      ${Object.entries(r).map(([k, v]) => `<div class="zbox"><h3>${esc(k)}.zlang</h3><p class="zsmall zmuted">${esc(D[k] || '')} · ${v.byte} byte · sha256 <span class="zhash">${esc(v.sha256)}</span> · <a href="/znft/zlang/${esc(k)}.zlang" download>sorgente</a> · <a href="/znft/zlang/${esc(k)}.zlb" download>bytecode</a></p><div class="zcode">${esc(v.sorgente)}</div></div>`).join('')}`;
  }
  async function mine() {
    if (!st.token) { app.innerHTML = `<div class="zbox"><h3>I miei zNFT</h3><p>Collega Phantom e firma il messaggio di accesso (nessuna transazione).</p><button class="zbtn p" id="mgo" type="button">Collega Phantom</button></div>`; $('#mgo').onclick = need(async () => route()); return; }
    const me = await api('/me'); const S = { bozza: 'bozza: servono i consensi', in_revisione: 'in revisione dello staff', certificata: 'certificata', esempio: 'esempio', rifiutata: 'rifiutata', sospesa: 'sospesa', rimossa: 'rimossa' };
    app.innerHTML = `<h2 class="zh">I miei zNFT</h2><div class="zbox zform"><div class="zrow"><span class="zchip v">${esc(short(me.wallet))}</span><span class="zchip">${esc(me.vpay)} VPAY</span><span class="zchip">${me.sol.toLocaleString('it-IT', { maximumFractionDigits: 4 })} SOL devnet</span></div>
      <div class="zrow"><div style="flex:1"><label for="mnick">Nome d'arte</label><input id="mnick" type="text" maxlength="32" value="${esc(me.nick || '')}"></div></div><label for="mbio">Bio</label><textarea id="mbio" maxlength="400">${esc(me.bio || '')}</textarea><button class="zbtn s" id="msave" type="button">Salva profilo</button> <a class="zbtn s" href="#/artista/${esc(me.wallet)}">Profilo pubblico</a> <button class="zbtn s" id="mout" type="button">Esci</button></div>
      <div class="zbox"><h3>Opere</h3>${me.opere.length ? `<table class="zt"><tr><th>Opera</th><th>Stato</th><th>Consensi</th><th></th></tr>${me.opere.map(o => `<tr><td><a href="#/opera/${esc(o.slug)}">${esc(o.title)}</a></td><td>${esc(S[o.status] || o.status)}${o.rules && o.rules.motivo ? '<br><span class="zbad">' + esc(o.rules.motivo) + '</span>' : ''}</td><td>${o.consensi}/${o.persone}</td><td>${o.status === 'bozza' && o.artist === me.wallet ? `<button class="zbtn s" data-sub="${o.id}" type="button">Invia in revisione</button><br><span class="zsmall zmuted">link consenso: /znft/#/consenso/${o.id}</span>` : ''}</td></tr>`).join('')}</table>` : '<p class="zmuted">Nessuna opera. <a href="#/crea">Certificane una</a>.</p>'}</div>
      <div class="zbox"><h3>Annunci</h3>${me.annunci.length ? `<table class="zt"><tr><th>Opera</th><th>Prezzo</th><th>Stato</th></tr>${me.annunci.map(l => `<tr><td><a href="#/opera/${esc(l.slug)}">${esc(l.title)}</a></td><td>${esc(l.price_fmt)} VPAY</td><td>${esc(l.status)}</td></tr>`).join('')}</table>` : '<p class="zmuted">Nessun annuncio.</p>'}</div>`;
    $('#msave').onclick = need(async () => { await api('/me', { body: { nick: $('#mnick').value, bio: $('#mbio').value } }); toast('Profilo salvato.'); });
    $('#mout').onclick = () => { st.token = null; st.wallet = null; sessionStorage.removeItem('znft'); paintWallet(); route(); };
    app.querySelectorAll('[data-sub]').forEach(b => b.onclick = need(async () => { const r = await api(`/works/${b.dataset.sub}/submit`, { body: {} }); toast(r.ok ? 'Regole superate: opera in revisione.' : 'Bloccata dalle regole: ' + r.motivo, 7000); route(); }));
  }
  const ROUTES = [[/^#?\/?$/, home], [/^#\/collezioni$/, collections], [/^#\/collezione\/([a-z0-9-]+)$/, collection], [/^#\/opera\/([a-z0-9-]+)$/, work], [/^#\/artista\/([1-9A-HJ-NP-Za-km-z]{32,44})$/, artist],
    [/^#\/crea(\?.*)?$/, create], [/^#\/consenso\/(\d+)$/, consent], [/^#\/upgrade$/, upgrade], [/^#\/vpay$/, vpay], [/^#\/regole$/, rules], [/^#\/miei$/, mine]];
  async function route() {
    const h = location.hash || '#/'; paintWallet();
    document.querySelectorAll('#znav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === h.split('?')[0]));
    for (const [re, fn] of ROUTES) { const m = h.match(re); if (m) { loading(); try { await fn(m[1]); } catch (e) { app.innerHTML = errBox(e); } window.scrollTo(0, 0); return; } }
    app.innerHTML = errBox(new Error('pagina non trovata'));
  }
  window.addEventListener('hashchange', route); route();
})();
