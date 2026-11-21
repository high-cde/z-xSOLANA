// Moduli ES: pdf.js (vista PDF) e libarchive.js (estrazione ZIP/RAR/7Z). pdf-lib e JSZip sono caricati come script classici.
import * as pdfjsLib from './vendor/pdf.min.mjs';
import { Archive } from './vendor/libarchive.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
Archive.init({ workerUrl: new URL('./vendor/worker-bundle.js', import.meta.url).href });
const { $, esc, toast, download } = window.XC;
let pdfs = []; let active = 0; // [{name, bytes}]
function renderList(){ $('#pList').innerHTML = pdfs.map((p,i)=>`<span class="pill ${i===active?'on':''}" data-i="${i}">📄 ${esc(p.name)} · ${p.pages||'?'} pag.</span>`).join(''); document.querySelectorAll('#pList .pill').forEach(el=>el.onclick=()=>{ active=+el.dataset.i; view(); }); }
async function view(){
  renderList(); const p = pdfs[active]; if (!p) return; const doc = await pdfjsLib.getDocument({ data: p.bytes.slice() }).promise; p.pages = doc.numPages; renderList();
  const out = $('#pView'); out.innerHTML = '';
  for (let n=1; n<=Math.min(doc.numPages, 8); n++){ const page = await doc.getPage(n); const vp = page.getViewport({ scale: .45 }); const c = document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; const fig=document.createElement('figure'); fig.append(c); fig.insertAdjacentHTML('beforeend', `<figcaption>pagina ${n}</figcaption>`); out.append(fig); }
}
async function add(name, bytes){ const d = await PDFLib.PDFDocument.load(bytes); pdfs.push({ name, bytes: new Uint8Array(bytes), pages: d.getPageCount() }); active = pdfs.length-1; await view(); }
$('#pFile').onchange = async e => { for (const f of e.target.files) await add(f.name, await f.arrayBuffer()); };
$('#pDemo').onclick = async () => {
  for (const [name, title, n] of [['itinerario.pdf','Itinerario Lisbona',2], ['ricevute.pdf','Ricevute (demo)',1]]){
    const d = await PDFLib.PDFDocument.create(); const font = await d.embedFont(PDFLib.StandardFonts.HelveticaBold);
    for (let i=1;i<=n;i++){ const pg = d.addPage([420, 595]); pg.drawRectangle({ x:0, y:535, width:420, height:60, color: PDFLib.rgb(0.6,0.27,1) }); pg.drawText('xCLOUD by ZDOS', { x:20, y:558, size:16, font, color: PDFLib.rgb(1,1,1) });
      pg.drawText(`${title} — pagina ${i}/${n}`, { x:20, y:480, size:18, font, color: PDFLib.rgb(0.08,0.06,0.15) }); pg.drawText('Documento demo generato nel browser con pdf-lib.', { x:20, y:450, size:11, font, color: PDFLib.rgb(0.3,0.3,0.4) }); }
    await add(name, await d.save()); }
};
$('#pMerge').onclick = async () => { if (pdfs.length<2) return toast('Servono almeno 2 PDF'); const out = await PDFLib.PDFDocument.create();
  for (const p of pdfs){ const src = await PDFLib.PDFDocument.load(p.bytes); (await out.copyPages(src, src.getPageIndices())).forEach(pg=>out.addPage(pg)); }
  const bytes = await out.save(); download(new Blob([bytes],{type:'application/pdf'}), 'unito.pdf'); await add('unito.pdf', bytes); toast('PDF unito: '+out.getPageCount()+' pagine'); };
$('#pSplit').onclick = async () => { const p = pdfs[active]; if (!p) return toast('Apri un PDF'); const src = await PDFLib.PDFDocument.load(p.bytes); const max = src.getPageCount();
  const idx = []; ($('#pRange').value||'1').split(',').forEach(part=>{ const [a,b]=part.split('-').map(x=>parseInt(x,10)); if (!a) return; for (let i=a;i<=(b||a);i++) if (i>=1&&i<=max) idx.push(i-1); });
  if (!idx.length) return toast('Intervallo non valido'); const out = await PDFLib.PDFDocument.create(); (await out.copyPages(src, idx)).forEach(pg=>out.addPage(pg));
  const bytes = await out.save(); download(new Blob([bytes],{type:'application/pdf'}), 'estratto.pdf'); await add('estratto.pdf', bytes); };
$('#xIn').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#xOut').innerHTML = '<li class="muted">Estraggo…</li>';
  try { const arc = await Archive.open(f); const enc = await arc.hasEncryptedData(); const list = [];
    const tree = await arc.extractFiles();
    (function walk(o, pre){ for (const [k,v] of Object.entries(o||{})) { if (v instanceof File || v instanceof Blob) list.push({ path: pre, file: v instanceof File ? v : new File([v], k) }); else walk(v, pre+k+'/'); } })(tree, '');
    $('#xOut').innerHTML = (enc?'<li class="warn">Archivio cifrato: serve la password (roadmap)</li>':'') + list.map((en,i)=>`<li>📄 ${esc(en.path+en.file.name)} <span class="muted">${(en.file.size/1024).toFixed(1)} KB</span> <a href="#" data-i="${i}">scarica</a></li>`).join('');
    document.querySelectorAll('#xOut a[data-i]').forEach(a=>a.onclick=(ev)=>{ ev.preventDefault(); const en=list[+a.dataset.i]; download(en.file, en.file.name); });
  } catch(err){ $('#xOut').innerHTML = `<li class="err">Errore: ${esc(err.message||err)}</li>`; } };
window.XC.pdfDemo = () => $('#pDemo').click();
