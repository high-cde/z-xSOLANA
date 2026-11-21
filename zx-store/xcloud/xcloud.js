/*! xCLOUD by ZDOS · beta. Tasking + fogli + documenti + archivi ZIP. Tutto locale. */
(function(){
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = m => { const t=$('#toast'); t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),2400); };
const download = (blob, name) => { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
window.XC = { $, esc, toast, download };

// ---------- router ----------
function route(){ const v=(location.hash||'#tasks').slice(1); $$('.view').forEach(s=>s.classList.toggle('hidden', s.id!=='v-'+v)); $$('#xnav a').forEach(a=>a.classList.toggle('on', a.dataset.v===v)); }
addEventListener('hashchange', route); route();

// ---------- TASKING ----------
const TK='xc_tasks'; let tasks = JSON.parse(localStorage.getItem(TK)||'null'); let filter=null;
if (!tasks) tasks = [
  { id:1, t:'Iscrizione programmi affiliazione (Booking, Travelpayouts)', p:'alta', due:'2026-11-30', tags:['agenzia','legale'], s:'todo' },
  { id:2, t:'Ricaricare wallet agente: ~0,2 SOL per fee airdrop', p:'alta', due:'2026-12-14', tags:['airdrop','VELVET'], s:'todo' },
  { id:3, t:'Verificare con il commercialista ATECO e regime P.IVA', p:'media', due:'2026-12-05', tags:['legale'], s:'doing' },
  { id:4, t:'Chiave xAI sul server (solo env) per l\'assistente viaggio', p:'media', due:'', tags:['grok','backend'], s:'todo' },
  { id:5, t:'Audit di sicurezza ZComm prima dell\'uso reale', p:'alta', due:'2027-01-31', tags:['zcomm','sicurezza'], s:'todo' },
  { id:6, t:'Prototipo Z-X SOLANA con screenshot', p:'bassa', due:'2026-11-15', tags:['agenzia'], s:'done' },
];
const save = () => localStorage.setItem(TK, JSON.stringify(tasks));
const today = new Date().toISOString().slice(0,10);
function renderTasks(){
  const allTags=[...new Set(tasks.flatMap(t=>t.tags))].sort();
  $('#tFilters').innerHTML = allTags.map(g=>`<span class="chip ${filter===g?'on':''}" data-tag="${esc(g)}">#${esc(g)}</span>`).join(' ');
  $$('#tFilters .chip').forEach(c=>c.onclick=()=>{ filter = filter===c.dataset.tag?null:c.dataset.tag; renderTasks(); });
  const order={alta:0,media:1,bassa:2};
  $$('#kanban .col').forEach(col=>{ const list=tasks.filter(t=>t.s===col.dataset.s && (!filter||t.tags.includes(filter))).sort((a,b)=>order[a.p]-order[b.p]||(a.due||'9').localeCompare(b.due||'9'));
    col.querySelector('h3').dataset.n = list.length;
    col.querySelector('.drop').innerHTML = list.map(t=>{ const od = t.due && t.due<today && t.s!=='done';
      return `<div class="task ${t.p} ${od?'overdue':''}" draggable="true" data-id="${t.id}"><button class="x" title="Elimina" data-del="${t.id}">✕</button>${esc(t.t)}
      <div class="meta">${t.due?`<span class="due">📅 ${t.due.split('-').reverse().join('/')}${od?' · scaduta':''}</span>`:''}${t.tags.map(g=>`<span class="chip">#${esc(g)}</span>`).join('')}</div></div>`; }).join('') || '<div class="small muted">—</div>'; });
  const done=tasks.filter(t=>t.s==='done').length; $('#tStats').textContent = ` · ${done}/${tasks.length} completate · ${tasks.filter(t=>t.due&&t.due<today&&t.s!=='done').length} scadute`;
  $$('.task').forEach(el=>el.addEventListener('dragstart', e=>e.dataTransfer.setData('text/plain', el.dataset.id)));
  $$('[data-del]').forEach(b=>b.onclick=()=>{ tasks=tasks.filter(t=>t.id!=b.dataset.del); save(); renderTasks(); });
}
$$('#kanban .col').forEach(col=>{
  col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('over'); });
  col.addEventListener('dragleave', ()=>col.classList.remove('over'));
  col.addEventListener('drop', e=>{ e.preventDefault(); col.classList.remove('over'); const id=+e.dataTransfer.getData('text/plain'); const t=tasks.find(x=>x.id===id); if(t){ t.s=col.dataset.s; save(); renderTasks(); } });
});
$('#tForm').onsubmit = e => { e.preventDefault(); tasks.push({ id:Date.now(), t:$('#tTitle').value.trim(), p:$('#tPrio').value, due:$('#tDue').value, tags:$('#tTags').value.split(',').map(s=>s.trim()).filter(Boolean), s:'todo' }); save(); e.target.reset(); $('#tPrio').value='media'; renderTasks(); };
$('#tExport').onclick = () => download(new Blob([JSON.stringify(tasks,null,2)],{type:'application/json'}), 'xcloud-tasks.json');
renderTasks();

// ---------- FOGLI (SheetJS) ----------
let wb=null, sheetName=null;
function newBook(){ wb = XLSX.utils.book_new(); const aoa=[['Voce','Categoria','Importo €','Note'],['Volo Roma-Lisbona','viaggio',0,'prezzo da Google Flights'],['Hotel 7 notti','viaggio',0,'prezzo da Booking'],['eSIM Portogallo','connettività',0,'prezzo da Airalo'],['Fee airdrop (0,2 SOL)','crypto',0,'']]; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Budget'); sheetName='Budget'; renderSheet(); }
function renderSheet(){
  $('#sSheets').innerHTML = wb.SheetNames.map(n=>`<option ${n===sheetName?'selected':''}>${esc(n)}</option>`).join('');
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:'' });
  const cols = Math.max(4, ...aoa.map(r=>r.length)); const rows = Math.max(aoa.length, 8);
  const colName = i => XLSX.utils.encode_col(i);
  let h = '<tr><th></th>'+[...Array(cols)].map((_,i)=>`<th>${colName(i)}</th>`).join('')+'</tr>';
  for (let r=0;r<rows;r++){ h += `<tr><td>${r+1}</td>`+[...Array(cols)].map((_,c)=>`<td contenteditable="true" data-r="${r}" data-c="${c}">${esc((aoa[r]||[])[c] ?? '')}</td>`).join('')+'</tr>'; }
  $('#sTable').innerHTML = h; sumUp();
}
function readTable(){ const aoa=[]; $$('#sTable td[data-r]').forEach(td=>{ const r=+td.dataset.r,c=+td.dataset.c; let v=td.textContent; if (v!=='' && !isNaN(v.replace(',','.'))) v=Number(v.replace(',','.')); (aoa[r]=aoa[r]||[])[c]=v; }); 
  while (aoa.length && (aoa[aoa.length-1]||[]).every(v=>v===''||v==null)) aoa.pop(); return aoa.map(r=>r||[]); }
function commit(){ wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(readTable()); }
function sumUp(){ const aoa=readTable(); const sums=[]; aoa.slice(1).forEach(r=>r.forEach((v,i)=>{ if (typeof v==='number') sums[i]=(sums[i]||0)+v; }));
  $('#sSum').innerHTML = sums.map((s,i)=>s==null?'':`Σ ${XLSX.utils.encode_col(i)}: <b>${s.toLocaleString('it-IT')}</b>`).filter(Boolean).join(' · ') || '<span class="muted">Nessuna colonna numerica.</span>'; }
$('#sTable').addEventListener('input', ()=>{ commit(); sumUp(); });
$('#sSheets').onchange = e => { commit(); sheetName=e.target.value; renderSheet(); };
$('#sNew').onclick = newBook;
$('#sRow').onclick = () => { commit(); const a=readTable(); a.push([]); a.length=Math.max(a.length,9); wb.Sheets[sheetName]=XLSX.utils.aoa_to_sheet(a.map(r=>r||[])); renderSheet(); };
$('#sCol').onclick = () => { commit(); const a=readTable(); const w=Math.max(4,...a.map(r=>r.length)); if(a[0]) a[0][w]=XLSX.utils.encode_col(w); else a[0]=Array(w+1).fill(''); wb.Sheets[sheetName]=XLSX.utils.aoa_to_sheet(a); renderSheet(); };
$('#sFile').onchange = async e => { const f=e.target.files[0]; if(!f) return; wb = XLSX.read(await f.arrayBuffer(), { type:'array' }); sheetName=wb.SheetNames[0]; renderSheet(); $('#sInfo').textContent = `Aperto ${f.name} · ${wb.SheetNames.length} fogli`; };
$('#sXlsx').onclick = () => { commit(); XLSX.writeFile(wb, 'xcloud-foglio.xlsx'); };
$('#sCsv').onclick = () => { commit(); download(new Blob([XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])],{type:'text/csv'}), sheetName+'.csv'); };
newBook();

// ---------- DOCUMENTI (Quill + mammoth + docx) ----------
const quill = new Quill('#editor', { theme:'snow', modules:{ toolbar:[[{header:[1,2,3,false]}],['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['link','clean']] } });
const DK='xc_doc';
const saved = localStorage.getItem(DK);
if (saved) quill.setContents(JSON.parse(saved)); else quill.clipboard.dangerouslyPasteHTML('<h1>Preventivo viaggio — Lisbona</h1><p>Cliente: <b>…</b> · Date: <i>20–27/12/2026</i> · 2 adulti</p><h2>Servizi</h2><ul><li>Volo A/R (prezzo dal sito partner al momento della prenotazione)</li><li>Alloggio 7 notti</li><li>eSIM Portogallo</li></ul><p><u>Prezzi e condizioni sono quelli dei siti partner.</u> Mai pagamenti fuori piattaforma.</p>');
quill.on('text-change', ()=>localStorage.setItem(DK, JSON.stringify(quill.getContents())));
$('#dFile').onchange = async e => { const f=e.target.files[0]; if(!f) return; const r = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }); quill.setContents([]); quill.clipboard.dangerouslyPasteHTML(r.value); $('#dInfo').textContent = `Importato ${f.name}`+(r.messages.length?` · ${r.messages.length} avvisi di conversione`:''); };
$('#dClear').onclick = () => { quill.setContents([]); };
$('#dHtml').onclick = () => download(new Blob(['<!doctype html><meta charset="utf-8">'+quill.root.innerHTML],{type:'text/html'}), 'documento.html');
$('#dDocx').onclick = async () => {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
  const lines = []; let cur = [];
  quill.getContents().ops.forEach(op => { const parts = String(op.insert).split('\n');
    parts.forEach((txt, i) => { if (txt) cur.push(new TextRun({ text: txt, bold: !!op.attributes?.bold && !op.attributes?.header, italics: !!op.attributes?.italic, underline: op.attributes?.underline ? {} : undefined, strike: !!op.attributes?.strike }));
      if (i < parts.length-1){ const a = op.attributes||{}; const H = { 1:HeadingLevel.HEADING_1, 2:HeadingLevel.HEADING_2, 3:HeadingLevel.HEADING_3 }[a.header];
        lines.push(new Paragraph({ children: cur, heading: H, bullet: a.list==='bullet' ? { level:0 } : undefined, numbering: undefined })); cur=[]; } }); });
  if (cur.length) lines.push(new Paragraph({ children: cur }));
  const blob = await Packer.toBlob(new Document({ creator:'xCLOUD by ZDOS', sections:[{ children: lines }] }));
  download(blob, 'documento.docx'); toast('DOCX creato');
};

// ---------- ZIP (JSZip) ----------
let zFiles = [];
const zList = () => $('#zSel').innerHTML = zFiles.map(f=>`<li>📄 ${esc(f.name)} <span class="muted">${(f.size/1024).toFixed(1)} KB</span></li>`).join('');
$('#zIn').onchange = e => { zFiles = [...zFiles, ...e.target.files]; zList(); };
$('#zDemo').onclick = () => { zFiles = [ new File(['Lista valigia\n- passaporto\n- caricabatterie\n'], 'valigia.txt'), new File([JSON.stringify(tasks,null,1)], 'tasks.json'), new File(['Voce;Importo\nHotel;0\n'], 'budget.csv') ]; zList(); };
$('#zMake').onclick = async () => { if (!zFiles.length) return toast('Scegli prima dei file'); const z = new JSZip(); zFiles.forEach(f=>z.file(f.name, f)); const blob = await z.generateAsync({ type:'blob', compression:'DEFLATE' }); download(blob, 'xcloud-archivio.zip'); toast(`ZIP creato: ${(blob.size/1024).toFixed(1)} KB`); window.XC.lastZip = blob; };
})();
