/*! ZComm · prototipo E2EE di xCLOUD (ZDOS). NON verificato da audit: non usarlo per segreti reali.
 * Schema: identità ECDH P-256 (WebCrypto, privata NON estraibile) → ECDH con la pubblica del contatto → HKDF-SHA-256
 * (salt = SHA-256 delle due pubbliche ordinate, info "ZComm v0 AES-GCM") → chiave AES-GCM 256 per coppia.
 * Ogni messaggio: nonce casuale 96 bit, AAD = mittente|destinatario|contatore, contatore monotono anti-replay.
 * Safety number = SHA-256(pubA‖pubB ordinate) → 12 gruppi da 5 cifre, da confrontare a voce o di persona.
 * Limiti onesti: niente forward secrecy (chiavi statiche per sessione), nessuna protezione dei metadati, trasporto demo
 * BroadcastChannel tra schede dello stesso browser. Produzione: Signal protocol (libsignal) o MLS (OpenMLS) + relay che vede solo ciphertext. */
(function(){
'use strict';
const $ = s => document.querySelector(s); const { esc, toast } = window.XC;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const subtle = crypto.subtle;
let me = null, chan = null; const peers = new Map(); // id -> {name, pubRaw, key, sn, verified, sendN, recvN}

async function safetyNumber(a, b){ const [x,y] = [b64(a), b64(b)].sort(); const h = new Uint8Array(await subtle.digest('SHA-256', enc.encode(x+'|'+y)));
  const groups=[]; for (let i=0;i<12;i++){ const v = ((h[i*2]<<16)|(h[i*2+1]<<8)|h[(i*2+2)%32]) % 100000; groups.push(String(v).padStart(5,'0')); } return groups.join(' '); }
async function deriveKey(peerRaw){
  const peerPub = await subtle.importKey('raw', peerRaw, { name:'ECDH', namedCurve:'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name:'ECDH', public: peerPub }, me.keys.privateKey, 256);
  const [x,y] = [b64(me.pubRaw), b64(peerRaw)].sort(); const salt = await subtle.digest('SHA-256', enc.encode(x+y));
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt, info: enc.encode('ZComm v0 AES-GCM') }, hk, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
function sniff(obj){ const el=$('#cSniff'); el.textContent += JSON.stringify(obj) + '\n\n'; el.scrollTop = el.scrollHeight; }
function post(obj){ sniff(obj); chan.postMessage(obj); }
function renderPeers(){
  if (!peers.size){ $('#cPeers').innerHTML = 'In attesa di un contatto: apri questa pagina in un\'altra scheda (#zcomm) ed entra con un altro nome.'; return; }
  $('#cPeers').innerHTML = [...peers.entries()].map(([id,p]) => `<div class="peer"><div><b>${esc(p.name)}</b> ${p.verified?'<span class="ok">✔ verificato</span>':'<span class="warn">non verificato</span>'}<div class="sn">🔢 ${p.sn}</div></div><button class="btn ghost" data-verify="${id}">${p.verified?'Annulla':'Verifica'}</button></div>`).join('') + '<div class="small muted">Confronta il numero di sicurezza con il contatto su un altro canale (di persona o in chiamata): se coincide, nessuno sta facendo man-in-the-middle.</div>';
  document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{ const p=peers.get(b.dataset.verify); p.verified=!p.verified; renderPeers(); });
  $('#cTo').innerHTML = [...peers.entries()].map(([id,p])=>`<option value="${id}">→ ${esc(p.name)}</option>`).join('');
  $('#cMsg').disabled = $('#cSend').disabled = false;
}
function line(cls, who, text, meta){ $('#cChat').insertAdjacentHTML('beforeend', `<div class="msg ${cls}"><b>${esc(who)}:</b> ${esc(text)}<span class="lock">🔒 ${esc(meta)}</span></div>`); $('#cChat').scrollTop = 1e9; }
async function onMsg(m){
  if (!me || m.from === me.id) return;
  if (m.type === 'hello' && !peers.has(m.from)){
    const raw = unb64(m.pub); const key = await deriveKey(raw);
    peers.set(m.from, { name: String(m.name).slice(0,24), pubRaw: raw, key, sn: await safetyNumber(me.pubRaw, raw), verified:false, sendN:0, recvN:0 });
    renderPeers(); post({ type:'hello', from: me.id, name: me.name, pub: b64(me.pubRaw) }); line('bot','ZComm', `${m.name} è entrato: chiave condivisa derivata localmente.`, 'ECDH P-256 + HKDF');
  }
  if (m.type === 'msg' && m.to === me.id){
    const p = peers.get(m.from); if (!p) return;
    if (m.n <= p.recvN){ line('bot','ZComm','Messaggio scartato: possibile replay.', 'contatore '+m.n); return; }
    try { const pt = await subtle.decrypt({ name:'AES-GCM', iv: unb64(m.iv), additionalData: enc.encode(m.from+'|'+m.to+'|'+m.n) }, p.key, unb64(m.ct));
      p.recvN = m.n; line('bot', p.name, dec.decode(pt), `AES-GCM · nonce ${m.iv.slice(0,8)}… · #${m.n}`); }
    catch { line('bot','ZComm','Messaggio alterato o chiave errata: rifiutato.', 'autenticazione GCM fallita'); }
  }
}
$('#cJoin').onclick = async () => {
  if (me) return;
  const keys = await subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, false, ['deriveBits']); // privata non estraibile
  const pubRaw = new Uint8Array(await subtle.exportKey('raw', keys.publicKey));
  me = { id: crypto.randomUUID(), name: $('#cName').value.trim().slice(0,24) || 'anonimo', keys, pubRaw };
  const fp = new Uint8Array(await subtle.digest('SHA-256', pubRaw));
  $('#cMe').innerHTML = `Sei <b>${esc(me.name)}</b> · impronta chiave pubblica <span class="sn">${[...fp.slice(0,8)].map(x=>x.toString(16).padStart(2,'0')).join(':')}</span><br><span class="muted">La chiave privata è un CryptoKey non estraibile: nemmeno il codice della pagina può esportarla.</span>`;
  chan = new BroadcastChannel('zcomm-demo-room'); chan.onmessage = e => onMsg(e.data);
  post({ type:'hello', from: me.id, name: me.name, pub: b64(pubRaw) }); $('#cJoin').disabled = true; renderPeers();
};
$('#cForm').onsubmit = async e => { e.preventDefault(); const to=$('#cTo').value, text=$('#cMsg').value.trim(); const p=peers.get(to); if (!p||!text) return;
  if (!p.verified) toast('Contatto non verificato: confronta il numero di sicurezza');
  p.sendN++; const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name:'AES-GCM', iv, additionalData: enc.encode(me.id+'|'+to+'|'+p.sendN) }, p.key, enc.encode(text));
  post({ type:'msg', from: me.id, to, n: p.sendN, iv: b64(iv), ct: b64(ct) }); line('me', 'Tu → '+p.name, text, `cifrato AES-GCM · #${p.sendN}`); $('#cMsg').value=''; };
window.ZComm = { join: () => $('#cJoin').click() };
})();
