/* xCLOUD by ZDOS — Gestionale MVP (demo). ZDOS1.3 · licenza proprietaria ZSEL.
   Tutto gira nel browser: dati in localStorage, foto in IndexedDB. Nessuna chiamata a server propri. */
'use strict';
(function(){
const KEY='xcloud.demo.v1';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const eur=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n||0);
const today=()=>new Date().toISOString().slice(0,10);
const fmtT=iso=>new Date(iso).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
const fmtD=iso=>new Date(iso).toLocaleDateString('it-IT');
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;

const SECTORS=['Pulizie e sanificazione','Edilizia e cantieri','Metalmeccanica e acciaierie','Logistica e trasporti','Ristorazione e ospitalità','Commercio al dettaglio','Manifattura','Agricoltura','Sanità e assistenza','Servizi professionali','IT e digitale','Media e creator (non adult)'];
const JOBTYPES=['Tempo indeterminato','Tempo determinato','Part-time','Apprendistato','Tirocinio','Lavoro su turni','Collaborazione / P.IVA'];
const CITIES={'Milano':[45.4642,9.19],'Monza':[45.5845,9.2744],'Bergamo':[45.6983,9.6773],'Brescia':[45.5416,10.2118],'Torino':[45.0703,7.6869],'Genova':[44.4056,8.9463],'Verona':[45.4384,10.9916],'Bologna':[44.4949,11.3426],'Firenze':[43.7696,11.2558],'Terni':[42.5636,12.6427],'Roma':[41.9028,12.4964],'Napoli':[40.8518,14.2681],'Bari':[41.1171,16.8719],'Taranto':[40.4644,17.247],'Palermo':[38.1157,13.3615]};
const ROLES={titolare:'Titolare',amm:'Amministrazione',capo:'Capo cantiere / reparto',dip:'Dipendente'};
const PERMS={
  titolare:['dash','aziende','dip','timb','timb_all','annunci','annunci_new','gal','fatt','comm','pag','creator','legal','dati','audit'],
  amm:['dash','dip','timb','timb_all','annunci','annunci_new','fatt','comm','pag','legal','dati','audit'],
  capo:['dash','dip_view','timb','timb_all','annunci','gal','comm','legal'],
  dip:['timb','annunci','comm','legal','gal_view']
};
const MODS=[
 ['dashboard','◈','Dashboard','dash'],['aziende','▦','Aziende','aziende'],['dipendenti','☺','Dipendenti',['dip','dip_view']],['timbrature','◷','Timbrature','timb'],
 ['annunci','◎','Annunci lavoro','annunci'],['galleria','▣','Galleria cantiere',['gal','gal_view']],['fatture','€','Fatture','fatt'],['comunicazioni','✉','Comunicazioni','comm'],
 ['sep','','Piattaforma'],['pagamenti','⇄','Pagamenti','pag'],['creator','18','Area creator','creator'],['legale','§','Legale','legal'],['dati','⛁','Dati e registro',['dati','audit']]
];
const BOTTOM=['dashboard','timbrature','annunci','fatture','comunicazioni'];

/* ---------- stato ---------- */
function demo(){
  const c1='c_'+uid(),c2='c_'+uid(),c3='c_'+uid();
  const e=(cid,n,m,ct)=>({id:'e_'+uid(),cid,name:n,mansione:m,contratto:ct,role:'dip',demo:true});
  const companies=[
    {id:c1,name:'Pulizie Aurora Srl (DEMO)',piva:'00000000000',sector:'Pulizie e sanificazione',city:'Milano',addr:'Via di Esempio 1',cap:'20100',prov:'MI',sede:CITIES.Milano,geoTimbra:false,demo:true},
    {id:c2,name:'Cantieri Delta Spa (DEMO)',piva:'00000000000',sector:'Edilizia e cantieri',city:'Bergamo',addr:'Via di Esempio 2',cap:'24100',prov:'BG',sede:CITIES.Bergamo,geoTimbra:false,demo:true},
    {id:c3,name:'Acciai Sigma Srl (DEMO)',piva:'00000000000',sector:'Metalmeccanica e acciaierie',city:'Terni',addr:'Via di Esempio 3',cap:'05100',prov:'TR',sede:CITIES.Terni,geoTimbra:false,demo:true}
  ];
  const employees=[e(c1,'Operatore A (demo)','Addetto pulizie','Part-time'),e(c1,'Operatrice B (demo)','Capo squadra','Tempo indeterminato'),
    e(c2,'Muratore C (demo)','Muratore','Tempo indeterminato'),e(c2,'Geometra D (demo)','Capo cantiere','Tempo indeterminato'),e(c2,'Apprendista E (demo)','Manovale','Apprendistato'),
    e(c3,'Operatore F (demo)','Addetto forno','Lavoro su turni'),e(c3,'Tecnico G (demo)','Manutentore','Tempo indeterminato')];
  const jobs=[
    ['Addetto/a pulizie uffici',c1,'Pulizie e sanificazione','Part-time','Milano','Pulizie uffici in fascia mattutina. Formazione iniziale inclusa.'],
    ['Muratore qualificato',c2,'Edilizia e cantieri','Tempo indeterminato','Bergamo','Cantieri residenziali in provincia. Richiesta esperienza in opere murarie.'],
    ['Gruista con patentino',c2,'Edilizia e cantieri','Tempo determinato','Brescia','Conduzione gru a torre. Patentino gru obbligatorio per legge.'],
    ['Addetto/a forno fusorio',c3,'Metalmeccanica e acciaierie','Lavoro su turni','Terni','Lavoro su tre turni con DPI forniti. Formazione sicurezza a carico azienda.'],
    ['Manutentore elettromeccanico',c3,'Metalmeccanica e acciaierie','Tempo indeterminato','Terni','Manutenzione impianti di laminazione.'],
    ['Magazziniere',null,'Logistica e trasporti','Tempo determinato','Monza','Gestione carico/scarico e inventario. Patentino muletto gradito.'],
    ['Aiuto cuoco/a',null,'Ristorazione e ospitalità','Part-time','Roma','Servizio serale e weekend.'],
    ['Saldatore/trice TIG',null,'Metalmeccanica e acciaierie','Tempo indeterminato','Taranto','Saldatura TIG su acciaio inox.']
  ].map(j=>({id:'j_'+uid(),title:j[0],cid:j[1],employer:j[1]?companies.find(c=>c.id===j[1]).name:'Azienda di esempio (DEMO)',sector:j[2],type:j[3],city:j[4],ll:CITIES[j[4]],desc:j[5],date:today(),demo:true}));
  return {v:1,created:new Date().toISOString(),tenant:c1,role:'titolare',companies,employees,punches:[],jobs,invoices:[],messages:[
    {id:uid(),cid:c2,ch:'cantiere',who:'Capo cantiere (demo)',text:'Domani consegna ponteggi alle 8:00. Messaggio di esempio.',at:new Date().toISOString(),demo:true}],
    audit:[{at:new Date().toISOString(),role:'sistema',what:'Creati dati DEMO di esempio'}]};
}
let S;
function load(){try{S=JSON.parse(localStorage.getItem(KEY));}catch(e){S=null}if(!S||S.v!==1){S=demo();save();}}
function save(){localStorage.setItem(KEY,JSON.stringify(S));}
function audit(what){S.audit.unshift({at:new Date().toISOString(),role:ROLES[S.role],what});S.audit=S.audit.slice(0,300);save();}
const can=p=>(PERMS[S.role]||[]).includes(p);
const canAny=p=>Array.isArray(p)?p.some(can):can(p);
const T=()=>S.companies.find(c=>c.id===S.tenant)||S.companies[0];
const emps=()=>S.employees.filter(e=>e.cid===T().id);

/* ---------- UI di base ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.add('hidden'),2600);}
function modal(html,onMount){const m=$('#modal');$('#modalCard').innerHTML=html;m.classList.remove('hidden');m.onclick=e=>{if(e.target===m)closeModal();};$$('[data-close]',m).forEach(b=>b.onclick=closeModal);onMount&&onMount($('#modalCard'));}
function closeModal(){$('#modal').classList.add('hidden');}
function nav(){
  const cur=(location.hash.match(/^#\/(\w+)/)||[])[1]||'dashboard';
  $('#nav').innerHTML=MODS.map(m=>m[0]==='sep'?`<div class="sep">${m[2]}</div>`:`<a href="#/${m[0]}" class="${cur===m[0]?'on':''} ${canAny(m[3])?'':'locked'}"><span class="ic">${m[1]}</span>${m[2]}</a>`).join('');
  $('#bottom').innerHTML=BOTTOM.map(id=>{const m=MODS.find(x=>x[0]===id);return `<a href="#/${id}" class="${cur===id?'on':''}"><span class="ic">${m[1]}</span>${m[2].split(' ')[0]}</a>`}).join('');
  $('#tenantSel').innerHTML=S.companies.map(c=>`<option value="${c.id}" ${c.id===S.tenant?'selected':''}>${esc(c.name)}</option>`).join('');
  $('#roleSel').innerHTML=Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k===S.role?'selected':''}>${v}</option>`).join('');
  return cur;
}
function denied(){V._denied=true;return `<div class="card"><h2>Accesso non consentito</h2><p class="muted">Il ruolo <b>${ROLES[S.role]}</b> non ha il permesso per questo modulo. Cambia ruolo in basso nel menu (simulazione RBAC).</p></div>`;}
function head(t,sub){return `<h1>${t}</h1><p class="lead">${sub}</p>`;}

/* ---------- moduli ---------- */
const V={};
V.dashboard=()=>{
  const t=T(),es=emps(),pd=S.punches.filter(p=>p.cid===t.id&&p.at.slice(0,10)===today());
  const inNow=es.filter(e=>{const l=S.punches.filter(p=>p.eid===e.id).slice(-1)[0];return l&&l.type==='in'&&l.at.slice(0,10)===today();}).length;
  const inv=S.invoices.filter(i=>i.cid===t.id);
  const tot=inv.reduce((a,i)=>a+calcInv(i).tot,0);
  return head('Dashboard',`Panoramica di <b>${esc(t.name)}</b> · settore ${esc(t.sector)}. Tutti i numeri vengono dai dati salvati in questo browser.`)+
  `<div class="grid g4">
    <div class="card kpi"><div class="v">${S.companies.length}</div><div class="l">Aziende (tenant)</div></div>
    <div class="card kpi"><div class="v">${es.length}</div><div class="l">Dipendenti in anagrafica</div></div>
    <div class="card kpi"><div class="v">${inNow}</div><div class="l">Presenti ora (ultima timbratura = entrata)</div></div>
    <div class="card kpi"><div class="v">${pd.length}</div><div class="l">Timbrature di oggi</div></div>
    <div class="card kpi"><div class="v">${inv.length}</div><div class="l">Bozze fattura</div></div>
    <div class="card kpi"><div class="v" style="font-size:20px">${eur(tot)}</div><div class="l">Totale bozze (non inviate a SDI)</div></div>
    <div class="card kpi"><div class="v">${S.jobs.length}</div><div class="l">Annunci di lavoro</div></div>
    <div class="card kpi"><div class="v">${S.messages.filter(m=>m.cid===t.id).length}</div><div class="l">Messaggi in bacheca</div></div>
  </div>
  <div class="grid g2">
   <div class="card"><h2>Moduli</h2><div class="row">${MODS.filter(m=>m[0]!=='sep'&&m[0]!=='dashboard').map(m=>`<a class="btn sm" href="#/${m[0]}">${m[1]} ${m[2]}</a>`).join('')}</div></div>
   <div class="card"><h2>Stato reale della demo</h2>
    <p class="tiny"><span class="tag g">funziona</span> aziende, dipendenti, ruoli, timbrature, annunci con filtro km, galleria locale, bozze fattura con XML/PDF di prova, bacheca, registro attività, uso offline.</p>
    <p class="tiny"><span class="tag w">non attivo</span> invio SDI, conservazione, paghe/LUL, pagamenti PayPal/X Money/crypto, cifratura zcomm, area creator.</p>
   </div>
  </div>
  <div class="card"><h2>Ultime attività</h2><div class="tbl"><table><tbody>${S.audit.slice(0,6).map(a=>`<tr><td class="mono tiny">${fmtD(a.at)} ${fmtT(a.at)}</td><td>${esc(a.role)}</td><td>${esc(a.what)}</td></tr>`).join('')}</tbody></table></div></div>`;
};

function pivaOk(p){p=String(p).replace(/\s/g,'');if(!/^\d{11}$/.test(p))return false;let s=0;for(let i=0;i<10;i++){let d=+p[i];if(i%2===1){d*=2;if(d>9)d-=9;}s+=d;}return (10-s%10)%10===+p[10];}
V.aziende=()=>{
  if(!can('aziende'))return denied();
  return head('Aziende','Ogni azienda è un tenant separato: dipendenti, timbrature, fatture e bacheca restano divisi. Qui sono tutte demo.')+
  `<div class="card"><div class="tbl"><table><thead><tr><th>Azienda</th><th>Settore</th><th>Sede</th><th class="hide-m">P.IVA</th><th>Dip.</th><th></th></tr></thead><tbody>
  ${S.companies.map(c=>`<tr><td><b>${esc(c.name)}</b>${c.demo?' <span class="tag w">DEMO</span>':''}</td><td>${esc(c.sector)}</td><td>${esc(c.city)}</td><td class="mono hide-m">${esc(c.piva)}</td><td>${S.employees.filter(e=>e.cid===c.id).length}</td>
  <td class="row"><button class="btn sm" data-use="${c.id}">Apri</button><button class="btn sm dng" data-del="${c.id}">Elimina</button></td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="card"><h2>Nuova azienda</h2>
   <div class="grid g2"><div><label class="lbl">Ragione sociale</label><input id="cName" maxlength="80" placeholder="Es. Azienda di prova Srl"></div>
   <div><label class="lbl">Settore</label><select id="cSec">${SECTORS.map(s=>`<option>${s}</option>`).join('')}</select></div>
   <div><label class="lbl">Partita IVA (controllo formale del codice di controllo)</label><input id="cPiva" inputmode="numeric" maxlength="11" placeholder="11 cifre"><p class="tiny muted" id="pivaHint">Usa dati di prova: in questa demo non servono dati reali.</p></div>
   <div><label class="lbl">Città sede</label><select id="cCity">${Object.keys(CITIES).map(c=>`<option>${c}</option>`).join('')}</select></div></div>
   <div class="row end" style="margin-top:12px"><button class="btn pri" id="cAdd">Crea azienda</button></div></div>`;
};
V.aziende.mount=()=>{
  $$('[data-use]').forEach(b=>b.onclick=()=>{S.tenant=b.dataset.use;save();toast('Azienda attiva cambiata');render();});
  $$('[data-del]').forEach(b=>b.onclick=()=>{if(S.companies.length<2)return toast('Serve almeno un\'azienda');const c=S.companies.find(x=>x.id===b.dataset.del);if(!confirm('Eliminare '+c.name+' e tutti i suoi dati locali?'))return;
    S.companies=S.companies.filter(x=>x.id!==c.id);['employees','punches','invoices','messages'].forEach(k=>S[k]=S[k].filter(x=>x.cid!==c.id));if(S.tenant===c.id)S.tenant=S.companies[0].id;audit('Eliminata azienda '+c.name);render();});
  $('#cPiva').oninput=e=>{const v=e.target.value;$('#pivaHint').textContent=v.length<11?'Usa dati di prova: in questa demo non servono dati reali.':(pivaOk(v)?'Formato e cifra di controllo corretti (non verifica che la P.IVA esista).':'Cifra di controllo non valida.');};
  $('#cAdd').onclick=()=>{const n=$('#cName').value.trim(),p=$('#cPiva').value.trim();if(!n)return toast('Inserisci la ragione sociale');if(p&&!pivaOk(p))return toast('P.IVA non valida');
    const city=$('#cCity').value;const c={id:'c_'+uid(),name:n,piva:p||'00000000000',sector:$('#cSec').value,city,addr:'',cap:'',prov:'',sede:CITIES[city],geoTimbra:false};S.companies.push(c);S.tenant=c.id;audit('Creata azienda '+n);toast('Azienda creata');render();};
};

V.dipendenti=()=>{
  if(!canAny(['dip','dip_view']))return denied();
  const es=emps(),ed=can('dip');
  return head('Dipendenti',`Anagrafica di <b>${esc(T().name)}</b>. Solo i dati necessari alla gestione: niente dati sanitari, sindacali o di opinione (art. 9 GDPR, art. 8 Statuto dei Lavoratori).`)+
  `<div class="card"><div class="tbl"><table><thead><tr><th>Nome</th><th>Mansione</th><th>Contratto</th><th>Ruolo app</th>${ed?'<th></th>':''}</tr></thead><tbody>
  ${es.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.mansione)}</td><td>${esc(e.contratto)}</td><td><span class="tag p">${ROLES[e.role]}</span></td>${ed?`<td><button class="btn sm dng" data-del="${e.id}">Rimuovi</button></td>`:''}</tr>`).join('')||'<tr><td colspan="5" class="muted">Nessun dipendente.</td></tr>'}
  </tbody></table></div></div>`+(ed?`<div class="card"><h2>Aggiungi dipendente</h2><div class="grid g2">
   <div><label class="lbl">Nome (usa nomi di prova)</label><input id="eName" maxlength="60"></div><div><label class="lbl">Mansione</label><input id="eMan" maxlength="60"></div>
   <div><label class="lbl">Contratto</label><select id="eCt">${JOBTYPES.map(j=>`<option>${j}</option>`).join('')}</select></div>
   <div><label class="lbl">Ruolo nell'app</label><select id="eRole">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==='dip'?'selected':''}>${v}</option>`).join('')}</select></div></div>
   <div class="row end" style="margin-top:12px"><button class="btn pri" id="eAdd">Aggiungi</button></div>
   <p class="tiny muted">Paghe, cedolini e Libro Unico del Lavoro non sono in questa app: li tiene il datore o un professionista abilitato (L. 12/1979). L'app potrà esportare le presenze verso il consulente.</p></div>`:'<p class="tiny muted">Sola lettura per il tuo ruolo.</p>');
};
V.dipendenti.mount=()=>{
  $$('[data-del]').forEach(b=>b.onclick=()=>{const e=S.employees.find(x=>x.id===b.dataset.del);if(!confirm('Rimuovere '+e.name+'?'))return;S.employees=S.employees.filter(x=>x.id!==e.id);audit('Rimosso dipendente '+e.name);render();});
  const a=$('#eAdd');a&&(a.onclick=()=>{const n=$('#eName').value.trim();if(!n)return toast('Inserisci il nome');S.employees.push({id:'e_'+uid(),cid:T().id,name:n,mansione:$('#eMan').value.trim()||'—',contratto:$('#eCt').value,role:$('#eRole').value});audit('Aggiunto dipendente '+n);render();});
};

/* timbrature */
function hav(a,b){const R=6371,t=x=>x*Math.PI/180,dl=t(b[0]-a[0]),dn=t(b[1]-a[1]);const h=Math.sin(dl/2)**2+Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function hoursFor(eid,day){const ps=S.punches.filter(p=>p.eid===eid&&p.at.slice(0,10)===day).sort((a,b)=>a.at<b.at?-1:1);let ms=0,open=null;ps.forEach(p=>{if(p.type==='in')open=p;else if(open){ms+=new Date(p.at)-new Date(open.at);open=null;}});return {h:ms/3600000,open:!!open};}
V.timbrature=()=>{
  if(!can('timb'))return denied();
  const t=T(),es=emps(),all=can('timb_all');
  const ps=S.punches.filter(p=>p.cid===t.id).slice(-40).reverse();
  return head('Timbrature','Entrata e uscita con orario del dispositivo. La geolocalizzazione è <b>spenta</b> di default.')+
  `<div class="grid g2"><div class="card"><div class="big-clock" id="clk">--:--:--</div><p class="tiny muted">${new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</p>
   <label class="lbl">Dipendente</label><select id="pEmp">${es.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select>
   <div class="row" style="margin-top:12px"><button class="btn ok" id="pIn">▶ Entrata</button><button class="btn" id="pOut">■ Uscita</button></div>
   <p class="tiny" id="geoState">${t.geoTimbra?'<span class="pill-on">📍 Verifica sede attiva</span> · si salva solo "in sede sì/no", non la posizione.':'<span class="pill-off">Geolocalizzazione spenta</span>'}</p></div>
  <div class="card"><h2>Impostazioni azienda</h2>
   <label class="row"><input type="checkbox" id="geoT" ${t.geoTimbra?'checked':''} ${can('aziende')||S.role==='amm'?'':'disabled'}> Verifica sede alla timbratura (geolocalizzazione)</label>
   <p class="tiny muted">Quando è attiva, al momento della timbratura il browser chiede la posizione, la confronta con la sede (raggio 300 m) e la scarta subito: resta solo l'esito, come prescritto dal Garante privacy (doc. web 5497522). Nessun tracciamento continuo.</p>
   <div class="row"><button class="btn sm" id="csv">⇩ Esporta presenze CSV per il consulente</button></div></div></div>
  <div class="card"><h2>Ore di oggi</h2><div class="tbl"><table><thead><tr><th>Dipendente</th><th>Ore lavorate</th><th>Stato</th></tr></thead><tbody>
   ${es.map(e=>{const h=hoursFor(e.id,today());return `<tr><td>${esc(e.name)}</td><td class="mono">${h.h.toFixed(2)} h</td><td>${h.open?'<span class="tag g">in servizio</span>':'<span class="tag">fuori</span>'}</td></tr>`}).join('')}
  </tbody></table></div></div>
  ${all?`<div class="card"><h2>Ultime timbrature</h2><div class="tbl"><table><thead><tr><th>Data</th><th>Ora</th><th>Dipendente</th><th>Tipo</th><th>Sede</th></tr></thead><tbody>
   ${ps.map(p=>`<tr><td class="mono">${fmtD(p.at)}</td><td class="mono">${fmtT(p.at)}</td><td>${esc((S.employees.find(e=>e.id===p.eid)||{}).name||'—')}</td><td>${p.type==='in'?'Entrata':'Uscita'}</td><td>${p.geo==null?'<span class="muted">non rilevata</span>':p.geo?'<span class="tag g">in sede</span>':'<span class="tag w">fuori raggio</span>'}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">Nessuna timbratura.</td></tr>'}
  </tbody></table></div></div>`:''}`;
};
V.timbrature.mount=()=>{
  const tick=()=>{const c=$('#clk');if(!c)return clearInterval(V._clk);c.textContent=new Date().toLocaleTimeString('it-IT');};clearInterval(V._clk);V._clk=setInterval(tick,1000);tick();
  const punch=type=>{const eid=$('#pEmp').value;if(!eid)return toast('Nessun dipendente');const t=T();
    const done=geo=>{S.punches.push({id:uid(),cid:t.id,eid,type,at:new Date().toISOString(),geo});audit(`Timbratura ${type==='in'?'entrata':'uscita'}: ${(S.employees.find(e=>e.id===eid)||{}).name}`);toast(type==='in'?'Entrata registrata':'Uscita registrata');render();};
    if(!t.geoTimbra)return done(null);
    if(!navigator.geolocation)return done(null);
    $('#geoState').innerHTML='<span class="pill-on">📍 Lettura posizione in corso…</span>';
    navigator.geolocation.getCurrentPosition(p=>{const d=hav([p.coords.latitude,p.coords.longitude],t.sede);done(d<=0.3);},()=>{toast('Posizione negata: timbratura salvata senza verifica');done(null);},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  };
  $('#pIn').onclick=()=>punch('in');$('#pOut').onclick=()=>punch('out');
  $('#geoT').onchange=e=>{const t=T();if(!e.target.checked){t.geoTimbra=false;audit('Geolocalizzazione timbrature disattivata');return render();}
    e.target.checked=false;
    modal(`<h2>Attivare la verifica della sede?</h2>
    <div class="note r">Uno strumento che localizza i lavoratori può configurare un controllo a distanza: in Italia vale l'<b>art. 4 dello Statuto dei Lavoratori</b> (L. 300/1970) e il GDPR.</div>
    <p>Prima di attivarla, l'azienda deve avere:</p>
    <ul><li>informativa ai lavoratori (art. 13 GDPR e art. 4 c. 3 Statuto);</li><li>valutazione d'impatto privacy (DPIA, art. 35 GDPR);</li><li>accordo sindacale o autorizzazione dell'Ispettorato del Lavoro, se lo strumento va oltre la sola rilevazione delle presenze (valuta con un consulente);</li><li>un'alternativa per chi non usa lo smartphone personale.</li></ul>
    <p class="tiny muted">Il consenso del dipendente non basta come base giuridica nel rapporto di lavoro. L'app non traccia in continuo: legge la posizione solo al momento della timbratura e salva solo l'esito "in sede sì/no".</p>
    <label class="row"><input type="checkbox" id="mOk"> Confermo che l'azienda ha gli adempimenti sopra (in questa demo è una simulazione)</label>
    <div class="row end" style="margin-top:12px"><button class="btn" data-close>Annulla</button><button class="btn pri" id="mGo" disabled>Attiva</button></div>`,c=>{
      $('#mOk',c).onchange=x=>$('#mGo',c).disabled=!x.target.checked;
      $('#mGo',c).onclick=()=>{t.geoTimbra=true;audit('Geolocalizzazione timbrature attivata con conferma adempimenti');closeModal();render();};});
  };
  $('#csv').onclick=()=>{const t=T();const rows=[['data','ora','dipendente','tipo','verifica_sede']].concat(S.punches.filter(p=>p.cid===t.id).map(p=>[p.at.slice(0,10),fmtT(p.at),(S.employees.find(e=>e.id===p.eid)||{}).name||'',p.type==='in'?'entrata':'uscita',p.geo==null?'':p.geo?'in_sede':'fuori_raggio']));
    dl('presenze-'+today()+'-DEMO.csv',rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\n'),'text/csv');audit('Export CSV presenze');};
};

/* annunci */
const BAD=[[/\b(età|eta)\s*(massima|max|non superiore)/i,'limite di età'],[/\b(under|over)\s*\d{2}\b/i,'fascia di età'],[/\bmax\.?\s*\d{2}\s*anni\b/i,'limite di età'],[/\bsolo\s+(uomini|donne|maschi|femmine|italian[io])\b/i,'esclusione per sesso o nazionalità'],[/\bbella presenza\b/i,'aspetto fisico'],[/\b(automunit[oa]).{0,20}obbligatori/i,'requisito da motivare'],[/\b(non|no)\s+(sposat|incint|gravid)/i,'stato civile o gravidanza'],[/\b(madrelingua italiana)\b/i,'requisito linguistico da motivare'],[/\b(religione|sindacat|orientamento sessuale|razza)\b/i,'dato vietato in selezione']];
function lintAd(s){return BAD.filter(([r])=>r.test(s)).map(([,m])=>m);}
V.annunci=()=>{
  const pos=V._pos;
  return head('Annunci di lavoro','Filtra per distanza, settore e tipo di contratto. La tua posizione resta nel browser: la distanza si calcola qui, non viene inviata a nessuno.')+
  `<div class="card"><div class="grid g4">
   <div><label class="lbl">Da dove</label><select id="aFrom"><option value="">— scegli città —</option><option value="__gps" ${pos&&pos.gps?'selected':''}>📍 La mia posizione (chiede consenso)</option>${Object.keys(CITIES).map(c=>`<option ${pos&&pos.city===c?'selected':''}>${c}</option>`).join('')}</select></div>
   <div><label class="lbl">Raggio: <b id="kmV">${V._km||50}</b> km</label><input type="range" id="aKm" min="5" max="500" step="5" value="${V._km||50}"></div>
   <div><label class="lbl">Settore</label><select id="aSec"><option value="">Tutti</option>${SECTORS.map(s=>`<option ${V._sec===s?'selected':''}>${s}</option>`).join('')}</select></div>
   <div><label class="lbl">Tipo</label><select id="aType"><option value="">Tutti</option>${JOBTYPES.map(s=>`<option ${V._type===s?'selected':''}>${s}</option>`).join('')}</select></div>
  </div><p class="tiny muted" id="aInfo"></p></div>
  <div class="list" id="aList"></div>
  ${can('annunci_new')?`<div class="card"><h2>Pubblica annuncio (demo, resta nel browser)</h2><div class="grid g2">
   <div><label class="lbl">Titolo</label><input id="nT" maxlength="80"></div><div><label class="lbl">Città</label><select id="nC">${Object.keys(CITIES).map(c=>`<option ${c===T().city?'selected':''}>${c}</option>`).join('')}</select></div>
   <div><label class="lbl">Settore</label><select id="nS">${SECTORS.map(s=>`<option ${s===T().sector?'selected':''}>${s}</option>`).join('')}</select></div><div><label class="lbl">Tipo</label><select id="nY">${JOBTYPES.map(s=>`<option>${s}</option>`).join('')}</select></div></div>
   <label class="lbl">Descrizione</label><textarea id="nD" rows="3" maxlength="600"></textarea>
   <p class="tiny muted">Datore indicato: <b>${esc(T().name)}</b>. Gli annunci anonimi non sono ammessi (art. 9 D.Lgs. 276/2003). Il testo viene controllato contro requisiti discriminatori (art. 10).</p>
   <div id="nLint"></div><div class="row end"><button class="btn pri" id="nAdd">Pubblica</button></div></div>`:''}`;
};
V.annunci.mount=()=>{
  const list=()=>{const p=V._pos,km=V._km||50;let js=S.jobs.slice();if(V._sec)js=js.filter(j=>j.sector===V._sec);if(V._type)js=js.filter(j=>j.type===V._type);
    if(p){js=js.map(j=>({...j,d:hav(p.ll,j.ll)})).filter(j=>j.d<=km).sort((a,b)=>a.d-b.d);}
    $('#aInfo').textContent=p?`${js.length} annunci entro ${km} km da ${p.gps?'la tua posizione (approssimata, non salvata)':p.city}.`:`${js.length} annunci. Scegli un punto di partenza per filtrare per km.`;
    $('#aList').innerHTML=js.map(j=>`<div class="card job"><div class="row"><h3 class="sp">${esc(j.title)}</h3>${j.d!=null?`<span class="km">${j.d.toFixed(0)} km</span>`:''}</div>
     <div><span class="tag c">${esc(j.city)}</span><span class="tag p">${esc(j.sector)}</span><span class="tag g">${esc(j.type)}</span>${j.demo?'<span class="tag w">DEMO</span>':''}</div>
     <p class="tiny" style="margin:6px 0">${esc(j.desc)}</p><p class="tiny muted">Datore: ${esc(j.employer)} · ${fmtD(j.date)}</p></div>`).join('')||'<div class="card muted">Nessun annuncio con questi filtri.</div>';};
  $('#aFrom').onchange=e=>{const v=e.target.value;if(!v){V._pos=null;return list();}
    if(v==='__gps'){if(!navigator.geolocation){toast('Geolocalizzazione non disponibile');return;}
      if(!confirm('Il browser chiederà la tua posizione. Serve solo a calcolare le distanze qui sul telefono: non viene salvata né inviata. Continuare?')){e.target.value='';return;}
      navigator.geolocation.getCurrentPosition(p=>{V._pos={gps:true,ll:[p.coords.latitude,p.coords.longitude]};list();},()=>{toast('Posizione non concessa');e.target.value='';V._pos=null;list();},{timeout:10000,maximumAge:600000});return;}
    V._pos={city:v,ll:CITIES[v]};list();};
  $('#aKm').oninput=e=>{V._km=+e.target.value;$('#kmV').textContent=V._km;list();};
  $('#aSec').onchange=e=>{V._sec=e.target.value;list();};$('#aType').onchange=e=>{V._type=e.target.value;list();};
  const n=$('#nAdd');if(n){const chk=()=>{const w=lintAd($('#nT').value+' '+$('#nD').value);$('#nLint').innerHTML=w.length?`<div class="note r">Possibili requisiti discriminatori: ${[...new Set(w)].join(', ')}. Ammessi solo se requisito essenziale e determinante per il lavoro (art. 10 D.Lgs. 276/2003; D.Lgs. 198/2006).</div>`:'';return w;};
    $('#nT').oninput=chk;$('#nD').oninput=chk;
    n.onclick=()=>{const t=$('#nT').value.trim();if(!t)return toast('Titolo obbligatorio');const w=chk();if(w.length&&!confirm('Il testo contiene possibili requisiti discriminatori. Pubblicare comunque nella demo?'))return;
      const c=$('#nC').value;S.jobs.unshift({id:'j_'+uid(),title:t,cid:T().id,employer:T().name,sector:$('#nS').value,type:$('#nY').value,city:c,ll:CITIES[c],desc:$('#nD').value.trim(),date:today()});audit('Pubblicato annuncio '+t);toast('Annuncio pubblicato (solo in questo browser)');render();};}
  list();
};

/* galleria (IndexedDB) */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('xcloud-demo',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function pAll(){const db=await idb();return new Promise(r=>{const q=db.transaction('photos').objectStore('photos').getAll();q.onsuccess=()=>r(q.result||[]);});}
async function pPut(o){const db=await idb();return new Promise(r=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(o);tx.oncomplete=r;});}
async function pDel(id){const db=await idb();return new Promise(r=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=r;});}
function reencode(file){return new Promise((res,rej)=>{const img=new Image();const u=URL.createObjectURL(file);img.onload=()=>{const m=1600,s=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82));};img.onerror=rej;img.src=u;});}
V.galleria=()=>{
  if(!canAny(['gal','gal_view']))return denied();
  return head('Galleria cantiere','Foto di lavoro per cantiere o commessa. Restano in questo browser (IndexedDB). Prima di salvarle l\'app le ricodifica: i metadati EXIF, compresa l\'eventuale posizione GPS, vengono eliminati.')+
  (can('gal')?`<div class="card"><div class="grid g3"><div><label class="lbl">Cantiere / commessa</label><input id="gSite" maxlength="60" value="Cantiere demo 1"></div><div><label class="lbl">Nota</label><input id="gNote" maxlength="120" placeholder="Es. getto solaio"></div>
   <div><label class="lbl">Foto</label><input type="file" id="gFile" accept="image/*" multiple></div></div>
   <p class="tiny muted">Non fotografare persone riconoscibili senza informativa. Per i cantieri vale anche il D.Lgs. 81/2008 sulla sicurezza.</p></div>`:'<p class="tiny muted">Sola visualizzazione per il tuo ruolo.</p>')+
  `<div class="card"><div class="row"><h2 class="sp">Foto di ${esc(T().name)}</h2><select id="gFilter" style="width:auto"></select></div><div class="gal" id="gGrid"><p class="muted">Caricamento…</p></div></div>`;
};
V.galleria.mount=async()=>{
  const draw=async()=>{const all=(await pAll()).filter(p=>p.cid===T().id).sort((a,b)=>a.at<b.at?1:-1);const sites=[...new Set(all.map(p=>p.site))];const f=$('#gFilter');const cur=f.value;
    f.innerHTML='<option value="">Tutti i cantieri</option>'+sites.map(s=>`<option ${s===cur?'selected':''}>${esc(s)}</option>`).join('');
    const sh=all.filter(p=>!f.value||p.site===f.value);
    $('#gGrid').innerHTML=sh.map(p=>`<figure><img src="${p.data}" alt="${esc(p.note||p.site)}"><figcaption><b>${esc(p.site)}</b><br>${esc(p.note||'')} · ${fmtD(p.at)}${can('gal')?` <button class="btn sm dng" data-pdel="${p.id}" style="float:right">✕</button>`:''}</figcaption></figure>`).join('')||'<p class="muted">Nessuna foto. Carica le prime dal telefono.</p>';
    $$('[data-pdel]').forEach(b=>b.onclick=async()=>{await pDel(b.dataset.pdel);audit('Eliminata foto cantiere');draw();});};
  $('#gFilter').onchange=draw;
  const fi=$('#gFile');fi&&(fi.onchange=async()=>{const fs=[...fi.files].slice(0,12);for(const f of fs){try{const data=await reencode(f);await pPut({id:uid(),cid:T().id,site:$('#gSite').value.trim()||'Senza nome',note:$('#gNote').value.trim(),at:new Date().toISOString(),data});}catch(e){toast('Immagine non leggibile');}}
    audit(`Caricate ${fs.length} foto cantiere`);toast(fs.length+' foto salvate nel browser (EXIF rimossi)');fi.value='';draw();});
  draw();
};

/* fatture */
const ALIQ=[22,10,5,4,0];const NAT={'N2.2':'Non soggette – altri casi','N4':'Esenti'};
function calcInv(i){const by={};let imp=0;(i.lines||[]).forEach(l=>{const t=r2((+l.q||0)*(+l.p||0));imp+=t;const k=l.a+'|'+(l.a==0?(l.n||'N2.2'):'');by[k]=by[k]||{a:+l.a,n:l.a==0?(l.n||'N2.2'):'',imp:0};by[k].imp+=t;});
  const rie=Object.values(by).map(x=>({...x,imp:r2(x.imp),iva:r2(x.imp*x.a/100)}));const iva=rie.reduce((a,x)=>a+x.iva,0);return {imp:r2(imp),iva:r2(iva),tot:r2(imp+iva),rie};}
V.fatture=()=>{
  if(!can('fatt'))return denied();
  const t=T(),inv=S.invoices.filter(i=>i.cid===t.id).sort((a,b)=>a.num<b.num?1:-1);
  return head('Fatture','Bozze di fattura con calcolo IVA, export XML nel tracciato FatturaPA (FPR12) e PDF di cortesia. <b>Nessun invio al Sistema di Interscambio</b>: i file sono marcati come prova.')+
  `<div class="note">Una fattura è emessa solo quando passa dallo SdI. In produzione serve un canale accreditato o un intermediario e la conservazione a norma (vedi sezione Legale).</div>
  <div class="card"><div class="row"><h2 class="sp">Bozze di ${esc(t.name)}</h2><button class="btn pri" id="iNew">+ Nuova bozza</button></div><div class="tbl"><table><thead><tr><th>N.</th><th>Data</th><th>Cliente</th><th>Totale</th><th></th></tr></thead><tbody>
  ${inv.map(i=>`<tr><td class="mono">${esc(i.num)}</td><td class="mono">${fmtD(i.date)}</td><td>${esc(i.client.name)}</td><td class="mono">${eur(calcInv(i).tot)}</td><td class="row"><button class="btn sm" data-ed="${i.id}">Apri</button><button class="btn sm" data-xml="${i.id}">XML</button><button class="btn sm" data-pdf="${i.id}">PDF</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">Nessuna bozza.</td></tr>'}
  </tbody></table></div></div><div id="iEd"></div>`;
};
function invEditor(i){
  const c=calcInv(i);
  return `<div class="card"><h2>Bozza n. ${esc(i.num)} <span class="tag w">NON inviata a SDI</span></h2>
  <div class="grid g3"><div><label class="lbl">Data</label><input type="date" id="fDate" value="${i.date}"></div><div><label class="lbl">Numero</label><input id="fNum" value="${esc(i.num)}"></div><div><label class="lbl">Codice destinatario (7 car.)</label><input id="fCd" maxlength="7" value="${esc(i.client.cd||'0000000')}"></div></div>
  <h3 style="margin-top:12px">Cliente</h3><div class="grid g3"><div><label class="lbl">Denominazione</label><input id="fCn" value="${esc(i.client.name)}"></div><div><label class="lbl">P.IVA cliente</label><input id="fCp" maxlength="11" value="${esc(i.client.piva)}"></div><div><label class="lbl">Comune</label><input id="fCc" value="${esc(i.client.city||'')}"></div></div>
  <h3 style="margin-top:12px">Righe</h3><div class="tbl"><table><thead><tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th><th>IVA</th><th>Natura</th><th></th></tr></thead><tbody>
  ${i.lines.map((l,k)=>`<tr><td><input data-l="${k}" data-f="d" value="${esc(l.d)}"></td><td><input data-l="${k}" data-f="q" type="number" step="0.01" value="${l.q}" style="width:80px"></td><td><input data-l="${k}" data-f="p" type="number" step="0.01" value="${l.p}" style="width:110px"></td>
   <td><select data-l="${k}" data-f="a" style="width:80px">${ALIQ.map(a=>`<option value="${a}" ${+l.a===a?'selected':''}>${a}%</option>`).join('')}</select></td>
   <td><select data-l="${k}" data-f="n" style="width:120px" ${+l.a!==0?'disabled':''}>${Object.entries(NAT).map(([k2,v])=>`<option value="${k2}" ${l.n===k2?'selected':''}>${k2} ${v}</option>`).join('')}</select></td><td><button class="btn sm dng" data-rm="${k}">✕</button></td></tr>`).join('')}
  </tbody></table></div><div class="row" style="margin:8px 0"><button class="btn sm" id="fAdd">+ Riga</button></div>
  <div class="row end"><div style="text-align:right"><div class="tiny muted">Imponibile ${eur(c.imp)} · IVA ${eur(c.iva)}</div><div class="inv-tot">Totale ${eur(c.tot)}</div></div></div>
  <div class="row end" style="margin-top:10px"><button class="btn dng" id="fDel">Elimina bozza</button><button class="btn" id="fXml">⇩ XML di prova</button><button class="btn" id="fPdf">⎙ PDF di prova</button><button class="btn pri" id="fSave">Salva</button></div></div>`;
}
V.fatture.mount=()=>{
  const open=id=>{const i=S.invoices.find(x=>x.id===id);const box=$('#iEd');box.innerHTML=invEditor(i);box.scrollIntoView({behavior:'smooth'});
    const pull=()=>{i.date=$('#fDate').value||today();i.num=$('#fNum').value.trim()||i.num;i.client.name=$('#fCn').value.trim();i.client.piva=$('#fCp').value.trim();i.client.city=$('#fCc').value.trim();i.client.cd=($('#fCd').value.trim()||'0000000').toUpperCase();
      $$('[data-l]',box).forEach(el=>{const l=i.lines[+el.dataset.l],f=el.dataset.f;l[f]=f==='d'||f==='n'?el.value:+el.value;});};
    $$('[data-l]',box).forEach(el=>el.onchange=()=>{pull();save();open(id);});
    $$('[data-rm]',box).forEach(b=>b.onclick=()=>{pull();i.lines.splice(+b.dataset.rm,1);save();open(id);});
    $('#fAdd').onclick=()=>{pull();i.lines.push({d:'Servizio',q:1,p:0,a:22,n:'N2.2'});save();open(id);};
    $('#fSave').onclick=()=>{pull();if(i.client.piva&&!pivaOk(i.client.piva))return toast('P.IVA cliente non valida');save();audit('Salvata bozza fattura '+i.num);toast('Bozza salvata');render();setTimeout(()=>open(id),0);};
    $('#fDel').onclick=()=>{if(!confirm('Eliminare la bozza?'))return;S.invoices=S.invoices.filter(x=>x.id!==id);audit('Eliminata bozza '+i.num);render();};
    $('#fXml').onclick=()=>{pull();save();xmlInv(i);};$('#fPdf').onclick=()=>{pull();save();pdfInv(i);};};
  $('#iNew').onclick=()=>{const t=T(),y=new Date().getFullYear(),n=S.invoices.filter(i=>i.cid===t.id&&i.num.startsWith(y+'/')).length+1;
    const i={id:uid(),cid:t.id,num:`${y}/${String(n).padStart(3,'0')}`,date:today(),client:{name:'Cliente di prova Srl (DEMO)',piva:'00000000000',city:'Milano',cd:'0000000'},lines:[{d:'Servizio di esempio',q:1,p:100,a:22,n:'N2.2'}]};
    S.invoices.push(i);audit('Creata bozza fattura '+i.num);render();setTimeout(()=>open(i.id),0);};
  $$('[data-ed]').forEach(b=>b.onclick=()=>open(b.dataset.ed));
  $$('[data-xml]').forEach(b=>b.onclick=()=>xmlInv(S.invoices.find(x=>x.id===b.dataset.xml)));
  $$('[data-pdf]').forEach(b=>b.onclick=()=>pdfInv(S.invoices.find(x=>x.id===b.dataset.pdf)));
};
const xe=s=>esc(s).slice(0,200);
const n2=x=>(+x).toFixed(2);
function xmlInv(i){
  const t=S.companies.find(c=>c.id===i.cid),c=calcInv(i);
  const lines=i.lines.map((l,k)=>`      <DettaglioLinee>
        <NumeroLinea>${k+1}</NumeroLinea>
        <Descrizione>${xe(l.d||'—')}</Descrizione>
        <Quantita>${n2(l.q)}</Quantita>
        <PrezzoUnitario>${n2(l.p)}</PrezzoUnitario>
        <PrezzoTotale>${n2(r2(l.q*l.p))}</PrezzoTotale>
        <AliquotaIVA>${n2(l.a)}</AliquotaIVA>${+l.a===0?`\n        <Natura>${l.n||'N2.2'}</Natura>`:''}
      </DettaglioLinee>`).join('\n');
  const rie=c.rie.map(r=>`      <DatiRiepilogo>
        <AliquotaIVA>${n2(r.a)}</AliquotaIVA>${r.a===0?`\n        <Natura>${r.n}</Natura>`:''}
        <ImponibileImporto>${n2(r.imp)}</ImponibileImporto>
        <Imposta>${n2(r.iva)}</Imposta>${r.a!==0?'\n        <EsigibilitaIVA>I</EsigibilitaIVA>':''}${r.a===0?'\n        <RiferimentoNormativo>DOCUMENTO DI PROVA</RiferimentoNormativo>':''}
      </DatiRiepilogo>`).join('\n');
  const prog=('P'+i.num.replace(/\D/g,'')).slice(0,10);
  const x=`<?xml version="1.0" encoding="UTF-8"?>
<!-- DOCUMENTO DI PROVA generato da xCLOUD by ZDOS (demo). NON inviato a SDI. Non ha valore fiscale. -->
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${xe(t.piva||'00000000000')}</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${prog}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${xe((i.client.cd||'0000000').padEnd(7,'0').slice(0,7))}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${xe(t.piva||'00000000000')}</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>${xe(t.name)}</Denominazione></Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede><Indirizzo>${xe(t.addr||'Indirizzo di prova')}</Indirizzo><CAP>${xe(t.cap||'00000')}</CAP><Comune>${xe(t.city)}</Comune>${t.prov?`<Provincia>${xe(t.prov)}</Provincia>`:''}<Nazione>IT</Nazione></Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${xe(i.client.piva||'00000000000')}</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>${xe(i.client.name||'Cliente di prova')}</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Indirizzo di prova</Indirizzo><CAP>00000</CAP><Comune>${xe(i.client.city||'Comune di prova')}</Comune><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${i.date}</Data>
        <Numero>${xe(i.num)}</Numero>
        <ImportoTotaleDocumento>${n2(c.tot)}</ImportoTotaleDocumento>
        <Causale>DOCUMENTO DI PROVA - NON INVIATO A SDI - NESSUN VALORE FISCALE</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
${lines}
${rie}
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`;
  dl(`PROVA_NON_INVIATA_SDI_IT${t.piva||'00000000000'}_${prog}.xml`,x,'application/xml');audit('Export XML di prova '+i.num);return x;
}
function pdfInv(i){
  const t=S.companies.find(c=>c.id===i.cid),c=calcInv(i);
  $('#print').innerHTML=`<div class="pdoc"><div class="wm">DOCUMENTO DI PROVA — NON INVIATO A SDI — NESSUN VALORE FISCALE</div>
  <table><tr><td><b>${esc(t.name)}</b><br>P.IVA ${esc(t.piva)}<br>${esc(t.addr||'')} ${esc(t.city)}</td><td style="text-align:right"><b>Copia di cortesia</b><br>Fattura n. ${esc(i.num)}<br>del ${fmtD(i.date)}</td></tr></table>
  <p><b>Cliente:</b> ${esc(i.client.name)} · P.IVA ${esc(i.client.piva)} · ${esc(i.client.city||'')} · Cod. dest. ${esc(i.client.cd||'0000000')}</p>
  <table><thead><tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th><th>IVA</th><th>Totale</th></tr></thead><tbody>${i.lines.map(l=>`<tr><td>${esc(l.d)}</td><td>${l.q}</td><td>${eur(l.p)}</td><td>${l.a}%${+l.a===0?' '+(l.n||''):''}</td><td>${eur(r2(l.q*l.p))}</td></tr>`).join('')}</tbody></table>
  <p style="text-align:right">Imponibile ${eur(c.imp)}<br>IVA ${eur(c.iva)}<br><b>Totale ${eur(c.tot)}</b></p>
  <p style="font-size:10px">Generato con xCLOUD by ZDOS (demo). Il documento fiscale è solo quello trasmesso tramite Sistema di Interscambio.</p></div>`;
  audit('PDF di prova '+i.num);setTimeout(()=>window.print(),50);
}

/* comunicazioni */
V.comunicazioni=()=>{
  if(!can('comm'))return denied();
  const t=T(),ch=V._ch||'generale',ms=S.messages.filter(m=>m.cid===t.id&&m.ch===ch);
  return head('Comunicazioni','Bacheca interna per azienda e canale. Funziona anche offline: i messaggi restano sul dispositivo.')+
  `<div class="note c"><b>zcomm</b>: oggi è un gateway in sviluppo e <b>non ha cifratura end-to-end attiva</b>. In questa demo i messaggi non escono dal browser. La sincronizzazione tra dispositivi arriverà con il backend, dopo un audit di sicurezza.</div>
  <div class="card"><div class="row">${['generale','cantiere','turni','amministrazione'].map(c=>`<button class="btn sm ${c===ch?'pri':''}" data-ch="${c}"># ${c}</button>`).join('')}<span class="sp"></span><span class="tiny" id="offTxt"></span></div>
  <div style="margin-top:12px" id="msgs">${ms.map(m=>`<div class="msg"><time>${fmtD(m.at)} ${fmtT(m.at)}</time><b>${esc(m.who)}</b><div>${esc(m.text)}</div></div>`).join('')||'<p class="muted">Nessun messaggio in questo canale.</p>'}</div>
  <div class="row" style="margin-top:10px"><input id="mTxt" class="sp" style="flex:1;min-width:180px" maxlength="500" placeholder="Scrivi un messaggio (resta in questo browser)"><button class="btn pri" id="mSend">Invia</button></div></div>`;
};
V.comunicazioni.mount=()=>{
  $('#offTxt').textContent=navigator.onLine?'online':'offline: salvato in locale';
  $$('[data-ch]').forEach(b=>b.onclick=()=>{V._ch=b.dataset.ch;render();});
  const send=()=>{const v=$('#mTxt').value.trim();if(!v)return;S.messages.push({id:uid(),cid:T().id,ch:V._ch||'generale',who:ROLES[S.role]+' (tu)',text:v,at:new Date().toISOString()});save();render();};
  $('#mSend').onclick=send;$('#mTxt').onkeydown=e=>{if(e.key==='Enter')send();};
};

/* pagamenti */
V.pagamenti=()=>{
  if(!can('pag'))return denied();
  const P=(n,st,cls,txt)=>`<div class="card"><div class="row"><h3 class="sp">${n}</h3><span class="tag ${cls}">${st}</span></div><p class="tiny">${txt}</p><button class="btn sm" disabled>Collega (non attivo)</button></div>`;
  return head('Pagamenti','Segnaposto dichiarati: nessun pagamento è attivo e la piattaforma non custodisce fondi. Gli incassi passeranno da prestatori autorizzati (PSD2) e il denaro andrà direttamente all\'azienda.')+
  `<div class="grid g2">
  ${P('PayPal','da integrare','w','Checkout tramite account PayPal Business dell\'azienda. PayPal è il prestatore di servizi di pagamento: xCLOUD non tocca i fondi. Vietato per contenuti adult digitali secondo le policy PayPal.')}
  ${P('Stripe / carte','da integrare','w','Pagamento con carta tramite pagina ospitata dal PSP: i numeri di carta non passano mai dai server xCLOUD (PCI DSS). Stripe esclude i contenuti adult.')}
  ${P('X Money','non disponibile','r','Al 15/11/2026 non risulta un\'API commerciale pubblica documentata per gli esercenti. Da rivalutare se e quando X la pubblica. Nota: “xMoney” (docs.xmoney.com) è un\'azienda diversa.')}
  ${P('Crypto · Solana Pay','da integrare','w','Pagamento diretto dal wallet del cliente al wallet dell\'azienda, firmato dal cliente con Phantom. Nessuna custodia, nessuna conversione, nessun exchange: così si resta fuori dai servizi riservati ai CASP autorizzati MiCA.')}
  </div>
  <div class="card"><h2>$DSN su z-xSOLANA</h2><p class="tiny">Mint ufficiale su Solana: <code class="mono">35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4</code> (Token-2022, 6 decimali). Oggi non ha una pool di liquidità, quindi non è utilizzabile come mezzo di pagamento con controvalore. Uso previsto: sconti o accesso a funzioni per chi lo detiene, verificato con firma del wallet. Nessun rendimento promesso.</p>
  <a class="btn sm" href="https://solscan.io/token/35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4" target="_blank" rel="noopener">Solscan ↗</a></div>`;
};

/* creator */
V.creator=()=>{
  if(!can('creator'))return denied();
  return head('Area creator','Modulo separato dal gestionale aziendale. In questa demo non è attivo e non contiene contenuti.')+
  `<div class="note r">Per i contenuti per adulti servono, prima di qualsiasi lancio: verifica dell\'età tramite soggetto terzo con “doppio anonimato” (AGCOM, delibera 96/25/CONS), dominio e database separati, controllo del consenso e dell\'età di ogni persona ritratta, procedura di rimozione, e un PSP che accetti esplicitamente l\'adult. PayPal e Stripe non lo accettano.</div>
  <div class="card"><h2>Cosa resterà qui</h2><p class="tiny">Per creator non adult (fotografi, videomaker, influencer di settore): portfolio, contratti di collaborazione, fatture verso i brand tramite il modulo Fatture. Il ramo adult, se si farà, vivrà su un'app separata con regole proprie, come VelvetHub (18+, consenso, safeword ROSSO).</p></div>`;
};

/* legale */
V.legale=()=>head('Legale (sintesi)','Punti da rispettare prima di usare l\'app con dati reali. Non è una consulenza: va validato con professionisti.')+
 `<div class="card"><div class="tbl"><table><thead><tr><th>Area</th><th>Regola</th><th>Fonte</th></tr></thead><tbody>
 <tr><td>Fatture</td><td>Emessa solo se trasmessa via SdI (PEC, portale, SFTP/web service accreditato o intermediario). Conservazione a norma.</td><td><a href="https://www.agenziaentrate.gov.it/portale/aree-tematiche/fatturazione-elettronica/guida-fatturazione-elettronica/come-predisporre-inviare-ricevere-fe/come-inviare-fe-al-cliente" target="_blank" rel="noopener">Agenzia Entrate</a></td></tr>
 <tr><td>Timbrature con posizione</td><td>Art. 4 L. 300/1970, solo esito "in sede", niente tracciamento, alternativa senza app.</td><td><a href="https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/5497522" target="_blank" rel="noopener">Garante 5497522</a></td></tr>
 <tr><td>Paghe e LUL</td><td>Tenuti dal datore o da professionisti abilitati (L. 12/1979).</td><td><a href="https://www.inail.it/portale/assicurazione/it/Datore-di-Lavoro/Impresa-con-dipendenti-industria-artigianato-terziario-altre-attivita/libri-regolamentari-e-comunicazione-rapporti-di-lavoro-impresa-con-dipendenti/libro-unico.html" target="_blank" rel="noopener">INAIL</a></td></tr>
 <tr><td>Annunci</td><td>Niente annunci anonimi (art. 9), niente requisiti discriminatori (art. 10 D.Lgs. 276/2003).</td><td><a href="https://www.parlamento.it/parlam/leggi/deleghe/03276dl.htm" target="_blank" rel="noopener">D.Lgs. 276/2003</a></td></tr>
 <tr><td>Crypto</td><td>Dal 1/7/2026 i servizi su cripto-attività sono riservati ai CASP autorizzati MiCA: niente custodia, niente cambio.</td><td><a href="https://www.consob.it/web/consob/w/cripto-attivit%C3%A0-dal-primo-luglio-scade-il-periodo-transitorio-mica-l-esma-chiarisce-gli-obblighi-per-gli-operatori-e-avvisa-gli-investitori" target="_blank" rel="noopener">Consob</a></td></tr>
 <tr><td>Adult</td><td>Verifica età con terza parte e doppio anonimato.</td><td><a href="https://www.agcom.it/provvedimenti/delibera-96-25-cons" target="_blank" rel="noopener">AGCOM 96/25/CONS</a></td></tr>
 </tbody></table></div></div>`;

/* dati */
V.dati=()=>{
  if(!canAny(['dati','audit']))return denied();
  const kb=Math.round((localStorage.getItem(KEY)||'').length/1024);
  return head('Dati e registro','Tutto è salvato solo in questo browser. Puoi esportarlo, reimpostarlo o cancellarlo.')+
  `<div class="card"><p class="tiny">Spazio usato (esclusa galleria): <b class="mono">${kb} KB</b> · creato il ${fmtD(S.created)}</p>
  <div class="row"><button class="btn" id="dExp">⇩ Esporta JSON</button><button class="btn" id="dReset">↺ Ripristina dati demo</button><button class="btn dng" id="dWipe">Cancella tutto</button></div></div>
  <div class="card"><h2>Registro attività (audit log locale)</h2><div class="tbl"><table><thead><tr><th>Quando</th><th>Ruolo</th><th>Azione</th></tr></thead><tbody>
  ${S.audit.slice(0,100).map(a=>`<tr><td class="mono tiny">${fmtD(a.at)} ${fmtT(a.at)}</td><td>${esc(a.role)}</td><td>${esc(a.what)}</td></tr>`).join('')}</tbody></table></div></div>`;
};
V.dati.mount=()=>{
  $('#dExp').onclick=()=>dl('xcloud-demo-'+today()+'.json',JSON.stringify(S,null,2),'application/json');
  $('#dReset').onclick=()=>{if(!confirm('Sostituire i dati con quelli demo?'))return;S=demo();save();render();toast('Dati demo ripristinati');};
  $('#dWipe').onclick=async()=>{if(!confirm('Cancellare tutti i dati locali, foto comprese?'))return;localStorage.removeItem(KEY);try{indexedDB.deleteDatabase('xcloud-demo');}catch(e){}load();render();toast('Dati cancellati, ricreata la demo');};
};

function dl(name,content,type){const b=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

/* ---------- render ---------- */
function render(){
  const cur=nav();const fn=V[cur]||V.dashboard;
  V._denied=false;$('#view').innerHTML=fn();if(!V._denied&&fn.mount)fn.mount();
  $('#side').classList.remove('open');
}
function net(){const n=$('#net');n.classList.toggle('off',!navigator.onLine);n.title=navigator.onLine?'Online':'Offline: i dati restano sul dispositivo';n.textContent=navigator.onLine?'● online':'● offline';}
function init(){
  load();
  $('#tenantSel').onchange=e=>{S.tenant=e.target.value;save();render();};
  $('#roleSel').onchange=e=>{S.role=e.target.value;audit('Cambiato ruolo demo');render();};
  $('#menuBtn').onclick=()=>$('#side').classList.toggle('open');
  document.addEventListener('click',e=>{const s=$('#side');if(s.classList.contains('open')&&!s.contains(e.target)&&e.target.id!=='menuBtn')s.classList.remove('open');});
  window.addEventListener('hashchange',render);window.addEventListener('online',net);window.addEventListener('offline',net);
  net();render();
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}
window.__xcloud={calcInv,xmlInv:i=>xmlInv(i),pivaOk,hav,lintAd,state:()=>S};
init();
})();
