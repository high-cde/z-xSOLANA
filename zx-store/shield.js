/*! Scudo K.I.R.A. · prototipo Z-X SOLANA (ZDOS). Controlli SOLO difensivi su token, link, wallet e annunci.
 * Riusa KiraCore (kira-core.js di zRoute / bot Discord z-xSOLANA) per i token.
 * Fonti verificate il 15/11/2026: Solana RPC publicnode, RugCheck, GoPlus (token/phishing/address), Phantom blocklist (GitHub),
 * rdap.org (età dominio, NON copre .it), dns.google. Nessuna profilazione di persone. */
(function(){
  'use strict';
  const RPC = 'https://solana-rpc.publicnode.com';
  const T = (ms) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
  async function fetchJson(url, opt){ const r = await fetch(url, Object.assign({ signal: T(15000) }, opt||{})); if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
  const RPCS = [RPC, 'https://api.mainnet-beta.solana.com']; // come ZSwap Hub: più RPC pubblici in fallback (in produzione: RPC dedicato via backend)
  async function rpc(method, params){ let last; for (const u of RPCS){ try { const j = await fetchJson(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }) }); if (j.error) throw new Error(j.error.message); return j.result; } catch(e){ last = e; } } throw last; }
  const C = (status, label, detail) => ({ status, label, detail });
  function light(checks){
    const f = checks.filter(c=>c.status==='fail').length, w = checks.filter(c=>c.status==='warn').length;
    return f ? 'red' : w ? 'yellow' : 'green';
  }

  // ---------- TOKEN ----------
  async function checkToken(mint){
    const rep = await KiraCore.kiraReport(mint, { rpc, fetchJson });
    const checks = rep.checks.map(c => C(c.status, c.label, c.detail));
    try {
      const g = await fetchJson('https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses='+encodeURIComponent(mint));
      const r = g && g.result && g.result[mint];
      if (r){
        const flags = [];
        if (r.trusted_token === '1') checks.push(C('ok','GoPlus','token segnato come affidabile'));
        if (r.transfer_hook && r.transfer_hook.length) flags.push('transfer hook');
        if (r.non_transferable === '1') flags.push('non trasferibile');
        if ((r.balance_mutable_authority||{}).status === '1') flags.push('saldi modificabili da un\'authority');
        if ((r.closable||{}).status === '1') flags.push('mint chiudibile');
        checks.push(C(flags.length?'warn':'ok','GoPlus token security', flags.length ? flags.join(', ') : 'nessun flag critico'));
      } else checks.push(C('nd','GoPlus token security','nessun dato'));
    } catch(e){ checks.push(C('nd','GoPlus token security','non raggiungibile')); }
    const off = ZX_OFFICIAL.addresses[mint]; if (off) checks.unshift(C('info','Indirizzo noto ZDOS', off));
    return { title: (rep.symbol? rep.symbol+' · ' : '') + KiraCore.mask(mint), kiraVerdict: rep.verdict, level: light(checks), checks };
  }

  // ---------- DOMINI ----------
  let phantomList = null;
  async function loadPhantom(){
    if (phantomList) return phantomList;
    const r = await fetch('https://raw.githubusercontent.com/phantom/blocklist/master/blocklist.yaml', { signal: T(15000) });
    const txt = await r.text(); phantomList = new Set([...txt.matchAll(/url:\s*["']?([^\s"']+)/g)].map(m=>m[1].toLowerCase())); return phantomList;
  }
  function lev(a,b){ const m=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){ let p=m[0]; m[0]=i; for(let j=1;j<=b.length;j++){ const t=m[j]; m[j]=Math.min(m[j]+1,m[j-1]+1,p+(a[i-1]===b[j-1]?0:1)); p=t; } } return m[b.length]; }
  const skel = s => s.toLowerCase().replace(/rn/g,'m').replace(/vv/g,'w').replace(/0/g,'o').replace(/[1l|]/g,'i').replace(/5/g,'s').replace(/3/g,'e').replace(/[-_.]/g,'');
  function parseHost(input){ let s=String(input||'').trim(); if(!/^[a-z]+:\/\//i.test(s)) s='https://'+s; const u=new URL(s); return { url:u, host:u.hostname.toLowerCase().replace(/\.$/,'') }; }
  const regDomain = h => { const p=h.split('.'); return p.slice(-2).join('.'); };
  async function checkDomain(input){
    const checks = []; let url, host;
    try { ({url,host} = parseHost(input)); } catch { return { title:String(input), level:'red', checks:[C('fail','URL','non valido')] }; }
    const reg = regDomain(host); const tld = host.split('.').pop();
    const official = ZX_OFFICIAL.domains.some(d => host===d || host.endsWith('.'+d));
    if (official) checks.push(C('ok','Dominio ufficiale ZDOS', host));
    else {
      const label = reg.split('.')[0]; const sk = skel(label);
      const hit = ZX_OFFICIAL.brandLabels.find(b => sk.includes(skel(b)) || lev(sk, skel(b)) <= 2);
      if (host.startsWith('xn--') || host.includes('.xn--')) checks.push(C('warn','Punycode','il dominio usa caratteri internazionali: possibile omografo'));
      if (hit) checks.push(C('fail','Sosia di x-zdos.it', `"${reg}" somiglia al marchio ZDOS ma NON è un dominio ufficiale`));
      else checks.push(C('ok','Sosia di x-zdos.it','nessuna somiglianza'));
      const brand = Object.keys(ZX_BRANDS).find(b => sk.includes(b) || (label.length>4 && lev(sk,b)<=1));
      if (brand && !ZX_BRANDS[brand].some(d => reg===d)) checks.push(C('fail','Imitazione di marchio', `contiene "${brand}" ma non è un dominio ufficiale (${ZX_BRANDS[brand].join(', ')})`));
    }
    if (url.protocol !== 'https:') checks.push(C('warn','HTTPS','il link non usa HTTPS'));
    try { const bl = await loadPhantom(); const listed = bl.has(host) || bl.has(reg);
      checks.push(C(listed?'fail':'ok','Blocklist Phantom', listed ? 'dominio segnalato come malevolo' : 'non presente ('+bl.size+' domini)')); }
    catch { checks.push(C('nd','Blocklist Phantom','non raggiungibile')); }
    try { const g = await fetchJson('https://api.gopluslabs.io/api/v1/phishing_site?url='+encodeURIComponent(host));
      checks.push(C(g.result && g.result.phishing_site===1 ? 'fail':'ok','GoPlus phishing', g.result && g.result.phishing_site===1 ? 'segnalato come phishing' : 'nessuna segnalazione')); }
    catch { checks.push(C('nd','GoPlus phishing','non raggiungibile')); }
    if (tld === 'it') checks.push(C('nd','Età dominio','il registro .it non ha RDAP pubblico: serve WHOIS lato server (roadmap)'));
    else try {
      const r = await fetchJson('https://rdap.org/domain/'+encodeURIComponent(reg));
      const ev = (r.events||[]).find(e => /registration/i.test(e.eventAction));
      if (ev){ const days = Math.floor((Date.now()-Date.parse(ev.eventDate))/864e5);
        checks.push(C(days<30?'fail':days<180?'warn':'ok','Età dominio (RDAP)', `registrato il ${ev.eventDate.slice(0,10)} · ${days} giorni`+(days<30?' · appena creato':''))); }
      else checks.push(C('nd','Età dominio (RDAP)','data di registrazione non pubblicata'));
    } catch(e){ checks.push(C('nd','Età dominio (RDAP)', /404/.test(e.message)?'dominio non registrato o TLD senza RDAP':'non raggiungibile')); }
    try { const d = await fetchJson('https://dns.google/resolve?name='+encodeURIComponent(host)+'&type=A');
      checks.push(d.Status===3 ? C('warn','DNS','il dominio non esiste (NXDOMAIN)') : C('ok','DNS', (d.Answer||[]).filter(a=>a.type===1).map(a=>a.data).join(', ')||'nessun record A')); }
    catch { checks.push(C('nd','DNS','non raggiungibile')); }
    return { title: host, level: light(checks), checks };
  }

  // ---------- WALLET ----------
  const MY_KEY = 'zx_my_addresses';
  function myAddresses(){ try { return JSON.parse(localStorage.getItem(MY_KEY)||'[]'); } catch { return []; } }
  async function checkWallet(addr){
    addr = String(addr||'').trim(); const checks = [];
    if (!KiraCore.isMint(addr)) return { title: addr, level:'red', checks:[C('fail','Formato','non è un indirizzo Solana valido (base58, 32–44 caratteri)')] };
    checks.push(C('ok','Formato','indirizzo Solana valido'));
    const known = Object.assign({}, ZX_OFFICIAL.addresses); myAddresses().forEach(a => known[a] = known[a] || 'indirizzo salvato da te');
    if (known[addr]) checks.push(C('info','Indirizzo noto', known[addr]));
    const twin = Object.keys(known).find(k => k!==addr && k.slice(0,4)===addr.slice(0,4) && k.slice(-4)===addr.slice(-4));
    if (twin) checks.push(C('fail','Address poisoning', `stesso inizio e fine di ${KiraCore.mask(twin)} (${known[twin]}) ma è un indirizzo diverso`));
    try { const info = await rpc('getAccountInfo', [addr, { encoding:'jsonParsed' }]); const v = info && info.value;
      if (!v) checks.push(C('info','On-chain','account vuoto o mai usato: controlla due volte prima di inviare'));
      else if (v.executable) checks.push(C('warn','On-chain','è un programma, non un wallet'));
      else if (v.data && v.data.parsed && v.data.parsed.type === 'mint') checks.push(C('warn','On-chain','è un MINT di token, non un wallet: non inviare fondi qui'));
      else if (v.data && v.data.parsed && v.data.parsed.type === 'account') checks.push(C('warn','On-chain','è un token account, non l\'indirizzo principale del wallet'));
      else checks.push(C('ok','On-chain','wallet di sistema · saldo '+(v.lamports/1e9).toLocaleString('it-IT',{maximumFractionDigits:4})+' SOL'));
    } catch { checks.push(C('nd','On-chain','RPC non raggiungibile')); }
    try { const g = await fetchJson('https://api.gopluslabs.io/api/v1/address_security/'+addr); const r = g.result||{};
      const bad = ['cybercrime','money_laundering','financial_crime','phishing_activities','stealing_attack','blackmail_activities','fake_kyc','darkweb_transactions','sanctioned','honeypot_related_address','blacklist_doubt'].filter(k => r[k]==='1');
      checks.push(C(bad.length?'fail':'ok','GoPlus address security', bad.length ? 'segnalazioni: '+bad.join(', ') : 'nessuna segnalazione nota')); }
    catch { checks.push(C('nd','GoPlus address security','non raggiungibile')); }
    checks.push(C('info','Chainabuse','database segnalazioni: API con chiave (roadmap backend)'));
    return { title: KiraCore.mask(addr), level: light(checks), checks };
  }

  // ---------- ANNUNCI VIAGGIO ----------
  const RED_PATTERNS = [
    [/fuori (da |dalla )?(airbnb|booking|piattaforma|app)|off[- ]platform|senza commission/i, 'Pagamento fuori piattaforma: perdi ogni tutela e rimborso'],
    [/western union|moneygram|ricarica postepay|postepay|gift ?card|buono regalo|carta prepagata/i, 'Metodo di pagamento non tracciabile'],
    [/\b(usdt|usdc|bitcoin|btc|crypto|cripto|sol)\b/i, 'Richiesta di pagamento in crypto per un affitto: tipico delle truffe'],
    [/bonifico|iban/i, 'Bonifico diretto al proprietario invece del pagamento in app'],
  ];
  const WARN_PATTERNS = [
    [/whatsapp|telegram|signal|scrivimi (in privato|su)|email personale/i, 'Ti sposta su chat privata'],
    [/caparra|anticipo|blocc(a|arlo|o)|ultim[ao] disponibil|solo oggi|urgente/i, 'Pressione o anticipo per "bloccare" la casa'],
    [/sono all'estero|chiavi (per posta|spedite)|non posso mostrar/i, 'Proprietario irraggiungibile o visita impossibile'],
  ];
  async function checkListing(text, price, median){
    const checks = [];
    RED_PATTERNS.forEach(([re,msg]) => { if (re.test(text)) checks.push(C('fail','Testo annuncio', msg)); });
    WARN_PATTERNS.forEach(([re,msg]) => { if (re.test(text)) checks.push(C('warn','Testo annuncio', msg)); });
    price = Number(price); median = Number(median);
    if (price>0 && median>0){ const r = price/median;
      checks.push(C(r<0.5?'fail':r<0.7?'warn':'ok','Prezzo vs media zona', `${Math.round(r*100)}% della media che hai inserito (${price}€ vs ${median}€)`)); }
    else checks.push(C('nd','Prezzo vs media zona','inserisci prezzo e media per il confronto'));
    const urls = [...String(text).matchAll(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi)].map(m=>m[0]).slice(0,3);
    for (const u of urls){ try { const d = await checkDomain(u);
      const worst = d.checks.filter(c=>c.status==='fail'||c.status==='warn');
      checks.push(C(d.level==='red'?'fail':d.level==='yellow'?'warn':'ok','Link nell\'annuncio: '+d.title, worst.length ? worst.map(c=>c.label+': '+c.detail).join(' · ') : 'nessun problema rilevato')); } catch {} }
    if (!checks.some(c=>c.status==='fail'||c.status==='warn')) checks.push(C('ok','Testo annuncio','nessun segnale tipico di truffa'));
    return { title:'Annuncio', level: light(checks), checks };
  }

  window.KiraShield = { checkToken, checkDomain, checkWallet, checkListing, rpc, fetchJson, RPC };
})();
