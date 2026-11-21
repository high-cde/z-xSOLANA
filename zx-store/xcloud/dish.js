/*! xCLOUD · Starlink Dish HUD (sola lettura). Progetto personale, non affiliato a SpaceX/Starlink. */
(function(){
'use strict';
const $ = s => document.querySelector(s); const { esc } = window.XC;
const hist = []; let timer = null;
const mbps = b => b==null ? '—' : (b/1e6).toFixed(1)+' Mbps';
const pct = (v,max) => Math.max(0, Math.min(100, v/max*100))+'%';
const upt = s => { if (s==null) return '—'; const d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60); return `${d}g ${h}h ${m}m`; };
function draw(){
  const c=$('#dChart'), g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); g.fillStyle='#ffffff10'; for(let x=0;x<c.width;x+=25) g.fillRect(x,0,1,c.height);
  const max = Math.max(50e6, ...hist.map(h=>h.down||0)); const bw = c.width/60;
  hist.slice(-60).forEach((h,i)=>{ const hh=(h.down||0)/max*(c.height-20); g.fillStyle='#9945FF'; g.fillRect(i*bw, c.height-hh, bw-2, hh);
    const lh=Math.min(1,(h.lat||0)/120)*(c.height-20); g.fillStyle='#14F195'; g.fillRect(i*bw+bw/3, c.height-lh-2, bw/3, 4); });
  g.fillStyle='#ece8ff'; g.font='10px "Press Start 2P", monospace'; g.fillText('⬇ DOWNLINK (viola) · LATENZA (verde) · ultimi campioni', 10, 16);
}
async function tick(){
  if ($('#v-dish').classList.contains('hidden')) return;
  try { const d = await (await fetch('/api/starlink')).json(); const live = d.source==='live';
    $('#dSrc').className = 'srcbadge '+(live?'live':'mock'); $('#dSrc').textContent = live ? '● LIVE · LA TUA ANTENNA' : '◆ DATI MOCK · ANTENNA NON RAGGIUNGIBILE';
    $('#dReason').textContent = live ? 'gRPC '+(d.target||'') : (d.reason||'');
    $('#dDown').textContent = mbps(d.down_bps); $('#mDown').style.width = pct(d.down_bps||0, 300e6);
    $('#dUp').textContent = mbps(d.up_bps); $('#mUp').style.width = pct(d.up_bps||0, 40e6);
    $('#dLat').textContent = d.latency_ms==null?'—':d.latency_ms.toFixed(0)+' ms'; $('#mLat').style.width = pct(d.latency_ms||0, 120);
    const ob = (d.fraction_obstructed||0)*100; $('#dObs').textContent = ob.toFixed(1)+'%'+(d.currently_obstructed?' ⛔':''); $('#mObs').style.width = pct(ob, 10);
    $('#dUptime').textContent = upt(d.uptime_s); $('#dState').textContent = 'stato: '+(d.state||'—')+(d.gps_sats!=null?' · GPS sat: '+d.gps_sats:'');
    $('#dAlerts').innerHTML = (d.alerts&&d.alerts.length) ? d.alerts.map(a=>`<span>${esc(a.replace(/_/g,' '))}</span>`).join('') : '<span class="none">nessun alert</span>';
    $('#dMeta').textContent = `HW ${d.hardware||'—'} · SW ${d.software||'—'} · ID ${d.id||'—'} · drop ${((d.drop_rate||0)*100).toFixed(2)}%`;
    hist.push({ down:d.down_bps, lat:d.latency_ms }); if (hist.length>120) hist.shift(); draw();
  } catch(e){ $('#dSrc').className='srcbadge mock'; $('#dSrc').textContent='◆ BACKEND NON DISPONIBILE'; $('#dReason').textContent='Avvia server/dev-server.mjs per il proxy /api/starlink'; }
}
function start(){ if (!timer){ tick(); timer = setInterval(tick, 3000); } }
addEventListener('hashchange', ()=>{ if (location.hash==='#dish') start(); }); if (location.hash==='#dish') start();
})();
