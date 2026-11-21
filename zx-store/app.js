/*! Z-X SOLANA Store · ZDOS. Solo API pubbliche verificate (15/11/2026, ricontrollate 21/11/2026). Nessuna chiave nel frontend. */
(function(){
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (m) => { const t=$('#toast'); t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),2600); };
const J = KiraShield.fetchJson;
const SITE = 'https://x-zdos.it';
const xIntent = (text, url) => 'https://x.com/intent/post?text='+encodeURIComponent(text)+(url?'&url='+encodeURIComponent(url):'');
const WMO = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};

// ================= MAPPA =================
const map = L.map('map', { zoomControl:true }).setView([41.9, 12.5], 5);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);
let layer = L.layerGroup().addTo(map);
const pin = (color) => L.divIcon({ className:'', html:`<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #07040f;box-shadow:0 0 10px ${color}"></span>`, iconSize:[14,14] });

// ================= GEOCODING =================
async function geocode(q){
  try { const r = await J('https://photon.komoot.io/api/?limit=1&q='+encodeURIComponent(q)+'&osm_tag=place');
    const f = r.features && r.features[0]; if (f) return { lat:f.geometry.coordinates[1], lon:f.geometry.coordinates[0], name:q, osmName:f.properties.name, country:f.properties.country, cc:(f.properties.countrycode||'').toUpperCase(), src:'Photon (OSM)' }; } catch {}
  const n = await J('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=it&q='+encodeURIComponent(q));
  if (!n[0]) throw new Error('città non trovata');
  return { lat:+n[0].lat, lon:+n[0].lon, name:n[0].name, country:n[0].address.country, cc:(n[0].address.country_code||'').toUpperCase(), src:'Nominatim (OSM)' };
}
async function iata(q){ try { const r = await J('https://autocomplete.travelpayouts.com/places2?locale=it&types[]=city&term='+encodeURIComponent(q)); return r[0] && r[0].code; } catch { return null; } }

// ================= RICERCA VIAGGIO =================
let lastTrip = null;
async function searchTrip(e){
  if (e) e.preventDefault();
  const from=$('#fromCity').value.trim(), to=$('#toCity').value.trim(), din=$('#din').value, dout=$('#dout').value, ad=+$('#adults').value||1, kids=+$('#kids').value||0;
  $('#tripStatus').textContent = '⏳ Cerco '+to+'…';
  try {
    const [d, o, cTo, cFrom] = await Promise.all([geocode(to), geocode(from).catch(()=>null), iata(to), iata(from)]);
    lastTrip = { from, to, din, dout, ad, kids, d, o, cTo, cFrom };
    layer.clearLayers(); map.setView([d.lat, d.lon], 13);
    L.marker([d.lat,d.lon], { icon: pin('#ffffff') }).addTo(layer).bindPopup('<b>'+esc(d.name)+'</b>');
    $('#tripStatus').textContent = `✅ ${d.name}, ${d.country} · ${d.lat.toFixed(3)}, ${d.lon.toFixed(3)} · fonte ${d.src}` + (cTo?` · codice città ${cTo}`:'');
    renderDeepLinks(); setFxDest(d.cc);
    $('#shareTrip').href = xIntent(`Sto pianificando ${d.name} 🌍 con Z-X SOLANA by @ZDOS_Core: mappa, meteo e offerte dai siti partner, con Scudo K.I.R.A. anti-truffa.`, SITE);
    Promise.allSettled([weather(d), info(d), hotels(d), pois(d), ev(d), route(o, d)]);
  } catch(err){ $('#tripStatus').innerHTML = '<span class="err">Errore: '+esc(err.message)+'</span>'; }
}
$('#tripForm').addEventListener('submit', searchTrip);

function renderDeepLinks(){
  const t = lastTrip; if (!t) return; const city = t.d.name; const yy = s => s.slice(2).replace(/-/g,'');
  const links = [
    ['🏨 Booking.com', `https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(city)}&checkin=${t.din}&checkout=${t.dout}&group_adults=${t.ad}&group_children=${t.kids}&no_rooms=1`, 'hotel e appartamenti'],
    ['🏠 Airbnb', `https://www.airbnb.it/s/${encodeURIComponent(city)}/homes?checkin=${t.din}&checkout=${t.dout}&adults=${t.ad}&children=${t.kids}`, 'case e stanze'],
    ['🛏️ Hostelworld', 'https://www.hostelworld.com/', 'ostelli (ricerca sul sito)'],
    ['✈️ Google Flights', `https://www.google.com/travel/flights?q=${encodeURIComponent(`Voli da ${t.cFrom||t.from} a ${t.cTo||city} il ${t.din} ritorno ${t.dout}`)}&hl=it`, 'voli A/R'],
    ['🛫 Skyscanner', t.cFrom && t.cTo ? `https://www.skyscanner.it/trasporti/voli/${t.cFrom.toLowerCase()}/${t.cTo.toLowerCase()}/${yy(t.din)}/${yy(t.dout)}/?adults=${t.ad}&children=${t.kids}` : 'https://www.skyscanner.it/', 'voli A/R'],
    ['🎟️ GetYourGuide', `https://www.getyourguide.it/s/?q=${encodeURIComponent(city)}`, 'attività e tour'],
    ['📖 Wikivoyage', `https://it.wikivoyage.org/wiki/${encodeURIComponent(city)}`, 'guida gratuita'],
  ];
  $('#deeplinks').innerHTML = links.map(([n,u,s]) => `<a class="dl" href="${esc(u)}" target="_blank" rel="noopener nofollow"><b>${n}</b><span>${s} ↗</span></a>`).join('');
}

async function weather(d){
  const w = await J(`https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&current=temperature_2m&timezone=auto`);
  const days = w.daily.time.map((t,i)=>`<div>${new Date(t).toLocaleDateString('it-IT',{weekday:'short'})}<b>${WMO[w.daily.weathercode[i]]||'·'}</b>${Math.round(w.daily.temperature_2m_max[i])}°/${Math.round(w.daily.temperature_2m_min[i])}°</div>`).join('');
  $('#weather').innerHTML = `<b>Meteo 7 giorni</b> <span class="small muted">ora ${Math.round(w.current.temperature_2m)}°C · ${esc(w.timezone)}</span><div class="wx">${days}</div><div class="small muted">Open-Meteo</div>`;
  lastTrip.tz = w.timezone; lastTrip.utc = w.utc_offset_seconds;
}
async function info(d){
  const out = [];
  const [wv, aq, hol] = await Promise.allSettled([
    J('https://it.wikivoyage.org/api/rest_v1/page/summary/'+encodeURIComponent(d.name)),
    J(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${d.lat}&longitude=${d.lon}&current=european_aqi,pm2_5`),
    d.cc ? J(`https://date.nager.at/api/v3/PublicHolidays/${($('#din').value||'2026').slice(0,4)}/${d.cc}`) : Promise.reject()
  ]);
  if (wv.status==='fulfilled' && wv.value.extract) out.push(`<p class="small">${esc(wv.value.extract.slice(0,260))}… <a href="${esc(wv.value.content_urls.desktop.page)}" target="_blank" rel="noopener">Wikivoyage</a></p>`);
  $('#destInfo').innerHTML = `<b>${esc(d.name)}, ${esc(d.country)}</b>`+(out[0]||'');
  const ex = [];
  if (aq.status==='fulfilled'){ const a=aq.value.current; const lab = a.european_aqi<=20?'ottima':a.european_aqi<=40?'buona':a.european_aqi<=60?'discreta':a.european_aqi<=80?'scarsa':'pessima'; ex.push(`🌬️ Qualità aria: <b>${lab}</b> (AQI europeo ${a.european_aqi}, PM2.5 ${a.pm2_5} µg/m³)`); }
  setTimeout(()=>{ if (lastTrip && lastTrip.tz) { const now = new Date().toLocaleTimeString('it-IT',{timeZone:lastTrip.tz,hour:'2-digit',minute:'2-digit'}); const el=$('#tzLine'); if(el) el.innerHTML=`🕒 Fuso: <b>${esc(lastTrip.tz)}</b> · ora locale ${now}`; } }, 1500);
  ex.push('<span id="tzLine">🕒 Fuso: …</span>');
  if (hol.status==='fulfilled'){ const din=$('#din').value, dout=$('#dout').value; const inTrip = hol.value.filter(h=>h.date>=din && h.date<=dout);
    ex.push(`🎉 Festività ${esc(d.cc)} durante il viaggio: ${inTrip.length ? inTrip.map(h=>`<b>${esc(h.localName)}</b> (${h.date.slice(8)}/${h.date.slice(5,7)})`).join(', ') : 'nessuna'}`); }
  ex.push('⚠️ Visti e sicurezza: <a href="https://www.viaggiaresicuri.it/" target="_blank" rel="noopener">Viaggiare Sicuri</a>');
  $('#extra').innerHTML = '<b>Info utili</b><div class="small" style="display:grid;gap:6px;margin-top:6px">'+ex.map(x=>'<div>'+x+'</div>').join('')+'</div><div class="small muted">Open-Meteo AQ · Nager.Date</div>';
}
async function photonTag(d, tag, n, radiusKm){ const r = await J(`https://photon.komoot.io/reverse?lat=${d.lat}&lon=${d.lon}&osm_tag=${tag}&limit=${n}&radius=${radiusKm||10}`); return r.features||[]; }
const kmFrom = (d, la, lo) => { const R=6371, dLa=(la-d.lat)*Math.PI/180, dLo=(lo-d.lon)*Math.PI/180; const a=Math.sin(dLa/2)**2+Math.cos(d.lat*Math.PI/180)*Math.cos(la*Math.PI/180)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(a)); };
async function hotels(d){
  const f = (await photonTag(d,'tourism:hotel',15)).filter(x=>x.properties.name && kmFrom(d,x.geometry.coordinates[1],x.geometry.coordinates[0])<25);
  $('#hotelList').innerHTML = f.length ? f.map(x=>{ const [lo,la]=x.geometry.coordinates; const p=x.properties;
    L.marker([la,lo],{icon:pin('#9945FF')}).addTo(layer).bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.street||'')}<br><a target="_blank" rel="noopener" href="https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(p.name+' '+(p.city||d.name))}&checkin=${lastTrip.din}&checkout=${lastTrip.dout}&group_adults=${lastTrip.ad}">Vedi prezzi su Booking ↗</a>`);
    return `<li>🏨 <b>${esc(p.name)}</b> <span class="muted">${esc(p.street||p.district||'')}</span> · <a target="_blank" rel="noopener" href="https://www.booking.com/searchresults.it.html?ss=${encodeURIComponent(p.name+' '+(p.city||d.name))}&checkin=${lastTrip.din}&checkout=${lastTrip.dout}&group_adults=${lastTrip.ad}">prezzi ↗</a></li>`; }).join('') : '<li class="muted">Nessun hotel trovato in OSM qui vicino.</li>';
}
async function pois(d){
  const r = await J(`https://it.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${d.lat}|${d.lon}&gsradius=5000&gslimit=16&format=json&origin=*`);
  const g = r.query.geosearch||[];
  $('#poiList').innerHTML = g.map(p=>{ L.circleMarker([p.lat,p.lon],{radius:6,color:'#22d3ee',fillOpacity:.8}).addTo(layer).bindPopup(`<a target="_blank" rel="noopener" href="https://it.wikipedia.org/?curid=${p.pageid}">${esc(p.title)}</a>`);
    return `<li>📍 <a target="_blank" rel="noopener" href="https://it.wikipedia.org/?curid=${p.pageid}">${esc(p.title)}</a> <span class="muted">${Math.round(p.dist)} m</span></li>`; }).join('');
}
async function ev(d){
  const f = (await photonTag(d,'amenity:charging_station',20)).filter(x=>kmFrom(d,x.geometry.coordinates[1],x.geometry.coordinates[0])<25);
  f.forEach(x=>{ const [lo,la]=x.geometry.coordinates; const p=x.properties; L.marker([la,lo],{icon:pin('#14F195')}).addTo(layer).bindPopup(`⚡ <b>${esc(p.name||'Colonnina di ricarica')}</b><br>${esc(p.street||'')}`); });
  $('#evList').innerHTML = `⚡ <b>${f.length}</b> punti di ricarica vicino a ${esc(d.name)} (OSM via Photon), visibili in verde sulla mappa.<ul class="list">`+f.slice(0,6).map(x=>`<li>${esc(x.properties.name||'Colonnina')} <span class="muted">${esc(x.properties.street||'')}</span></li>`).join('')+'</ul>';
}
async function route(o, d){
  if (!o){ $('#routeOut').textContent='Partenza non trovata.'; return; }
  const r = await J(`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=simplified&geometries=geojson`);
  const rt = r.routes && r.routes[0]; if (!rt){ $('#routeOut').textContent='Nessun percorso in auto.'; return; }
  L.geoJSON(rt.geometry,{style:{color:'#9945FF',weight:3,opacity:.7}}).addTo(layer);
  const h = Math.floor(rt.duration/3600), m = Math.round(rt.duration%3600/60);
  $('#routeOut').innerHTML = `🛣️ <b>${esc(o.name)} → ${esc(d.name)}</b>: ${Math.round(rt.distance/1000).toLocaleString('it-IT')} km · circa ${h} h ${m} min di guida (OSRM, senza traffico). <br><span class="muted">Treni e bus: in roadmap (OpenRouteService/transit con chiave).</span>`;
}

// ================= VALUTA =================
let fxCur = null;
async function initFx(){
  const c = await J('https://api.frankfurter.dev/v1/currencies'); fxCur = c;
  const opts = Object.entries(c).map(([k,v])=>`<option value="${k}">${k} · ${esc(v)}</option>`).join('');
  $('#fxFrom').innerHTML = opts; $('#fxTo').innerHTML = opts; $('#fxFrom').value='EUR'; $('#fxTo').value='USD'; fx();
}
async function fx(){
  const a=+$('#fxAmt').value||0, f=$('#fxFrom').value, t=$('#fxTo').value;
  if (f===t){ $('#fxOut').textContent = a+' '+t; return; }
  try { const r = await J(`https://api.frankfurter.dev/v1/latest?amount=${a}&base=${f}&symbols=${t}`); $('#fxOut').textContent = `${a.toLocaleString('it-IT')} ${f} = ${r.rates[t].toLocaleString('it-IT',{maximumFractionDigits:2})} ${t}`; $('#fxDate').textContent = 'Tasso BCE del '+r.date; }
  catch { $('#fxOut').textContent='—'; }
}
function setFxDest(cc){ const c = ZX_COUNTRIES.find(x=>x[0]===cc); if (!c || !fxCur) return; const cur = c[3]===('EUR') ? 'USD' : c[3]; if (fxCur[cur]) { $('#fxTo').value = cur; fx(); } else { $('#fxDate').textContent = c[3]+' non è tra le valute BCE di Frankfurter'; } }
['#fxAmt','#fxFrom','#fxTo'].forEach(s=>$(s).addEventListener('input', fx));

// ================= eSIM =================
$('#esimCountry').innerHTML = ZX_COUNTRIES.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('');
$('#esimCountry').value = 'PT';
function esim(){
  const c = ZX_COUNTRIES.find(x=>x[0]===$('#esimCountry').value);
  const links = [
    ['📶 Airalo', `https://www.airalo.com/${c[2]}-esim`, 'piani eSIM per '+c[1]],
    ['📶 Holafly', 'https://esim.holafly.com/it/', 'scegli '+c[1]+' sul sito'],
    ['🔎 eSIMDB', 'https://esimdb.com/', 'comparatore indipendente'],
  ];
  $('#esimOut').innerHTML = links.map(([n,u,s]) => `<a class="dl" href="${esc(u)}" target="_blank" rel="noopener nofollow"><b>${n}</b><span>${esc(s)} ↗</span></a>`).join('') +
    `<a class="dl" href="${esc(xIntent('Parto per '+c[1]+' 📶 eSIM e viaggio con Z-X SOLANA by @ZDOS_Core', SITE))}" target="_blank" rel="noopener"><b>𝕏 Condividi</b><span>post precompilato ↗</span></a>`;
}
$('#esimCountry').addEventListener('change', esim); esim();

// ================= STORE / PREZZI =================
const SOL = 'So11111111111111111111111111111111111111112', OV = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump', DSN = '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4';
let solEur = null;
function markDsnUnquoted(extra){
  if (!$('#pDsn')) return;
  $('#pDsn').textContent = 'non quotato';
  $('#pDsnInfo').textContent = 'Nessun pool su Jupiter (TOKEN_NOT_TRADABLE). Non indichiamo un prezzo: il mint esiste on-chain, ma non risulta scambiabile. '+(extra||'');
}
async function prices(){
  markDsnUnquoted();
  try { const p = await J(`https://lite-api.jup.ag/price/v3?ids=${SOL},${OV},${DSN}`);
    const s = p[SOL], o = p[OV], d = p[DSN];
    if (s){ $('#pSol').textContent = '$'+s.usdPrice.toFixed(2); $('#hdrSol').textContent = 'SOL $'+s.usdPrice.toFixed(2); }
    if (o){ $('#pOv').textContent = '$'+o.usdPrice.toPrecision(3); $('#pOvInfo').textContent = 'liquidità ~$'+Math.round(o.liquidity).toLocaleString('it-IT')+' (sottile) · Jupiter price v3'; }
    if (d && d.usdPrice){ $('#pDsn').textContent = '$'+Number(d.usdPrice).toPrecision(3); $('#pDsnInfo').textContent = 'Jupiter price v3'+(d.liquidity!=null?' · liquidità ~$'+Math.round(d.liquidity).toLocaleString('it-IT'):''); }
    else markDsnUnquoted('Fonte: Jupiter price v3, novembre 2026.');
  } catch { // fallback se Jupiter limita (429): DexScreener per VELVET, CoinGecko per SOL
    try { const d = await J('https://api.dexscreener.com/tokens/v1/solana/'+OV); const pr = (d||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
      if (pr){ $('#pOv').textContent = '$'+Number(pr.priceUsd).toPrecision(3); $('#pOvInfo').textContent = 'liquidità ~$'+Math.round(pr.liquidity?.usd||0).toLocaleString('it-IT')+' (sottile) · DexScreener (Jupiter non disponibile)'; } } catch {}
    try { const c = await J('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'); $('#pSol').textContent = '$'+c.solana.usd.toFixed(2); $('#hdrSol').textContent = 'SOL $'+c.solana.usd.toFixed(2); } catch { $('#pSol').textContent='n/d'; }
    try { const ds = await J('https://api.dexscreener.com/tokens/v1/solana/'+DSN); const pr = (ds||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
      if (pr && pr.priceUsd){ $('#pDsn').textContent = '$'+Number(pr.priceUsd).toPrecision(3); $('#pDsnInfo').textContent = 'DexScreener (Jupiter non disponibile)'; }
      else markDsnUnquoted('DexScreener non riporta un pool.'); } catch { markDsnUnquoted(); }
  }
  try { const c = await J('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur'); solEur = c.solana.eur; $('#pSolEur').textContent = '€'+solEur.toFixed(2)+' (CoinGecko)'; pay(); } catch {}
}
function pay(){ const e=+$('#payEur').value||0; $('#payOut').textContent = solEur ? '≈ '+(e/solEur).toLocaleString('it-IT',{maximumFractionDigits:4})+' SOL' : '≈ … SOL'; }
$('#payEur').addEventListener('input', pay);

// ================= PHANTOM (sola lettura, logica da ZSwap Hub) =================
const provider = () => window.phantom?.solana?.isPhantom ? window.phantom.solana : (window.solana?.isPhantom ? window.solana : null);
$('#connect').onclick = async () => {
  const p = provider();
  if (!p){ if (/Android|iPhone|iPad/i.test(navigator.userAgent)) location.href = 'https://phantom.app/ul/browse/'+encodeURIComponent(location.href)+'?ref='+encodeURIComponent(location.origin); else { toast('Phantom non trovato: installa l\'estensione da phantom.app'); } return; }
  try { const r = await p.connect(); const pk = r.publicKey.toString(); $('#connect').textContent = pk.slice(0,4)+'…'+pk.slice(-4);
    const b = await KiraShield.rpc('getBalance',[pk]); $('#wInfo').innerHTML = `<code>${esc(pk)}</code><br>Saldo: <b>${(b.value/1e9).toLocaleString('it-IT',{maximumFractionDigits:4})} SOL</b> · <a href="https://solscan.io/account/${esc(pk)}" target="_blank" rel="noopener">Solscan ↗</a><br><span class="muted">Sola lettura: nessuna firma richiesta.</span>`;
    const mine = JSON.parse(localStorage.getItem('zx_my_addresses')||'[]'); if (!mine.includes(pk)) { mine.push(pk); localStorage.setItem('zx_my_addresses', JSON.stringify(mine)); }
  } catch { toast('Connessione annullata'); }
};

// ================= SCUDO K.I.R.A. UI =================
$$('#shTabs button').forEach(b => b.onclick = () => { $$('#shTabs button').forEach(x=>x.classList.toggle('on', x===b)); $$('.shpane').forEach(p=>p.classList.toggle('hidden', p.dataset.p!==b.dataset.t)); $('#shOut').innerHTML=''; });
const LBL = { green:'🟢 VERDE · nessun red flag', yellow:'🟡 GIALLO · attenzione', red:'🔴 ROSSO · rischio alto' };
const ICON = { ok:'✅', info:'ℹ️', warn:'⚠️', fail:'⛔', nd:'❔' };
function renderShield(res, kind){
  const share = xIntent(`🛡️ Scudo K.I.R.A. su ${res.title}: ${LBL[res.level]}. Controlla prima di cliccare o firmare. DYOR`, SITE);
  $('#shOut').innerHTML = `<div class="light"><div class="lamp"><i class="r ${res.level==='red'?'on':''}"></i><i class="y ${res.level==='yellow'?'on':''}"></i><i class="g ${res.level==='green'?'on':''}"></i></div>
    <div><div class="verdict ${res.level==='red'?'err':res.level==='yellow'?'warn':'ok'}">${LBL[res.level]}</div><div class="small muted">${esc(kind)} · ${esc(res.title)}${res.kiraVerdict?' · verdetto K.I.R.A.: '+esc(res.kiraVerdict):''}</div></div></div>
    <ul class="checks">${res.checks.map(c=>`<li class="${c.status}">${ICON[c.status]||''} <b>${esc(c.label)}</b>${esc(c.detail)}</li>`).join('')}</ul>
    <a class="btn ghost" href="${esc(share)}" target="_blank" rel="noopener">𝕏 Condividi l'avviso</a>`;
}
async function runShield(kind, fn){ $('#shOut').innerHTML = '<p class="muted">⏳ K.I.R.A. sta controllando…</p>'; try { renderShield(await fn(), kind); } catch(e){ $('#shOut').innerHTML = '<p class="err">Errore: '+esc(e.message)+'</p>'; } }
$('#tokGo').onclick = () => runShield('Token', () => KiraShield.checkToken($('#tokIn').value));
$('#domGo').onclick = () => runShield('Link / dominio', () => KiraShield.checkDomain($('#domIn').value));
$('#walGo').onclick = () => runShield('Wallet', () => KiraShield.checkWallet($('#walIn').value));
$('#lstGo').onclick = () => runShield('Annuncio viaggio', () => KiraShield.checkListing($('#lstText').value, $('#lstPrice').value, $('#lstMedian').value));

// ================= GROK (via backend proxy) =================
async function grokInit(){
  try { const r = await fetch('/api/grok/health', { signal: AbortSignal.timeout(4000) }); const j = await r.json().catch(()=>({}));
    if (r.ok && j.ok){ $('#grokState').className='pill ok'; $('#grokState').textContent='attivo · modello '+(j.model||''); $('#grokIn').disabled=false; $('#grokBtn').disabled=false; return; }
    $('#grokState').textContent = '🔒 richiede API key: '+(j.error||'backend non configurato'); }
  catch { $('#grokState').textContent = '🔒 richiede API key e backend (/api/grok non disponibile)'; }
}
const hist = [];
$('#grokForm').onsubmit = async (e) => { e.preventDefault(); const q=$('#grokIn').value.trim(); if(!q) return; $('#grokIn').value='';
  const log=$('#grokLog'); log.insertAdjacentHTML('beforeend', `<div class="msg me">${esc(q)}</div>`); hist.push({role:'user',content:q});
  try { const r = await fetch('/api/grok', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ messages: hist.slice(-8), trip: lastTrip ? { to:lastTrip.d.name, din:lastTrip.din, dout:lastTrip.dout, adults:lastTrip.ad, kids:lastTrip.kids } : null }) });
    const j = await r.json(); const a = j.reply || ('Errore: '+(j.error||r.status)); hist.push({role:'assistant',content:a}); log.insertAdjacentHTML('beforeend', `<div class="msg bot">${esc(a)}</div>`); }
  catch(err){ log.insertAdjacentHTML('beforeend', `<div class="msg bot err">Errore di rete</div>`); }
  log.scrollTop = log.scrollHeight; };

// ================= INIT =================
$('#shareSite').href = xIntent('Z-X SOLANA by @ZDOS_Core: viaggi con dati aperti, eSIM, store crypto-friendly e Scudo K.I.R.A. anti-truffa. DYOR', SITE);
initFx().catch(()=>{ $('#fxDate').textContent='Frankfurter non raggiungibile'; }).finally(searchTrip); prices(); grokInit();
const h = location.hash; if (h && /^#(tok|dom|wal|lst)$/.test(h)) { const b=document.querySelector(`#shTabs button[data-t="${h.slice(1)}"]`); b && b.click(); }
window.ZX = { searchTrip, runShield };
})();
