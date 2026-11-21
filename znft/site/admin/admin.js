(function () { 'use strict';
  const $ = s => document.querySelector(s); const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => { const t = $('#ztoast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 5000); };
  async function api(p, body) { const r = await fetch('/znft/api/admin' + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status); return j; }
  async function load() {
    const d = await api('/queue');
    $('#a').innerHTML = `<h2 class="zh">Revisione zNFT</h2><div class="zstats"><div class="zstat"><b>${d.revisione.length}</b><span>in revisione</span></div><div class="zstat"><b>${d.segnalazioni.length}</b><span>segnalazioni aperte</span></div><div class="zstat"><b>${d.saldo_sol.toFixed(4)}</b><span>SOL devnet piattaforma</span></div><div class="zstat"><b>${esc(d.vpay_tesoreria)}</b><span>VPAY tesoreria</span></div></div>
    <h2 class="zh">Opere da approvare</h2>${d.revisione.map(w => `<div class="zbox"><div class="zwork"><div>${w.preview_admin ? `<div class="zimg blur" data-r><img alt="" src="${esc(w.preview_admin)}"><div class="zveil">tocca per vedere</div></div>` : '<p class="zmuted">Nessuna anteprima</p>'}</div><div><h3>${esc(w.title)}</h3>
      <dl class="zkv"><dt>Artista</dt><dd>${esc(w.artist)}</dd><dt>SHA-256</dt><dd class="zhash">${esc(w.sha256)}</dd><dt>Persone</dt><dd>${w.people}</dd><dt>Consensi</dt><dd>${w.certificate.consensi.length}</dd><dt>Provenienza</dt><dd>${esc(w.certificate.provenienza)}</dd><dt>Regole Zlang</dt><dd>${esc(w.certificate.regole.esito)}</dd></dl>
      <p class="zsmall">${esc(w.description)}</p><p class="zsmall zwarn">Controlla: nessuna persona che sembri minorenne, consenso coerente, opera non di terzi, anteprima entro le regole.</p>
      <button class="zbtn p" data-ok="${w.id}">Approva e crea il certificato (devnet)</button> <button class="zbtn" data-no="${w.id}">Rifiuta</button></div></div></div>`).join('') || '<p class="zmuted">Niente da approvare.</p>'}
    <h2 class="zh">Segnalazioni</h2>${d.segnalazioni.map(r => `<div class="zbox"><b>${esc(r.title)}</b> <span class="zchip w">${esc(r.reason)}</span> <span class="zchip">${esc(r.work_status)}</span><p class="zsmall">${esc(r.detail)}</p><button class="zbtn s" data-arch="${r.id}">Archivia (ripristina)</button> <button class="zbtn s" data-rm="${r.id}">Rimuovi l'opera</button></div>`).join('') || '<p class="zmuted">Nessuna segnalazione aperta.</p>'}
    <h2 class="zh">Consegne in attesa</h2>${d.consegne.map(l => `<div class="zbox">Annuncio ${l.id} · acquirente ${esc(l.buyer)} <button class="zbtn s" data-del="${l.id}">Completa la consegna</button></div>`).join('') || '<p class="zmuted">Nessuna.</p>'}`;
    document.querySelectorAll('[data-r]').forEach(x => x.onclick = () => { x.classList.remove('blur'); x.querySelector('.zveil')?.remove(); });
    const act = (sel, fn) => document.querySelectorAll(sel).forEach(b => b.onclick = async () => { b.disabled = true; try { const r = await fn(b); toast(r && r.explorer ? 'Certificato creato: ' + r.asset : 'Fatto'); load(); } catch (e) { toast(e.message); b.disabled = false; } });
    act('[data-ok]', b => api(`/works/${b.dataset.ok}/approva`, {}));
    act('[data-no]', b => api(`/works/${b.dataset.no}/rifiuta`, { motivo: prompt('Motivo del rifiuto') || '' }));
    act('[data-arch]', b => api(`/reports/${b.dataset.arch}/archivia`, {}));
    act('[data-rm]', b => confirm('Rimuovere l\'opera dalla galleria?') ? api(`/reports/${b.dataset.rm}/rimuovi`, {}) : Promise.reject(new Error('annullato')));
    act('[data-del]', b => api(`/listings/${b.dataset.del}/consegna`, {}));
  }
  load().catch(e => { $('#a').innerHTML = `<div class="zbox"><p class="zbad">${esc(e.message)}</p></div>`; });
})();
