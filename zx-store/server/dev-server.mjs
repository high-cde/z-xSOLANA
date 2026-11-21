// Z-X SOLANA · server di sviluppo: file statici + proxy Grok (xAI). Node >= 18, nessuna dipendenza.
// La chiave resta SOLO nelle variabili d'ambiente:  XAI_API_KEY=... XAI_MODEL=grok-4.7 node server/dev-server.mjs
// Endpoint xAI (compatibile OpenAI): POST https://api.x.ai/v1/chat/completions  (verificato: 401 senza chiave, 15/11/2026)
import http from 'node:http'; import { execFile } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const KEY = process.env.XAI_API_KEY || ''; const MODEL = process.env.XAI_MODEL || 'grok-4.7';
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.wasm':'application/wasm', '.map':'application/json' };
const SYSTEM = 'Sei l\'assistente viaggio di Z-X SOLANA (ZDOS). Rispondi in italiano, conciso. Non inventare prezzi, disponibilità o offerte: rimanda ai siti partner. Non dare consigli finanziari. Ricorda di non pagare mai fuori piattaforma.';
const hits = new Map(); // rate limit in memoria: 20 richieste/ora per IP (in produzione: Nginx/Redis)
const sec = { 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'DENY', 'Permissions-Policy':'geolocation=(), camera=(), microphone=()', 'X-Robots-Tag':'noindex, nofollow, noarchive' };
function send(res, code, obj){ res.writeHead(code, { 'content-type':'application/json', ...sec }); res.end(JSON.stringify(obj)); }

// ---- Starlink Dish (sola lettura, rete locale dell'utente) ----
// Proxy verso server/starlink_status.py (starlink-grpc-core → gRPC reflection su 192.168.100.1:9200). Se non raggiungibile → mock etichettato.
const STARLINK_PY = process.env.STARLINK_PY || path.join(ROOT, '.venv-starlink/bin/python');
let slCache = { t:0, data:null };
function starlinkMock(reason){ const t = Date.now()/1000;
  return { source:'mock', reason, ok:true, id:'MOCK-DISH', hardware:'mock', software:'mock', state:'CONNECTED (mock)', uptime_s: 3*86400+4521,
    down_bps: Math.round(120e6 + 60e6*Math.sin(t/7)), up_bps: Math.round(14e6 + 5e6*Math.cos(t/5)), latency_ms: +(32 + 8*Math.sin(t/3)).toFixed(1),
    drop_rate: 0.004, fraction_obstructed: 0.018, currently_obstructed:false, gps_sats: 11, alerts:['roaming (mock)'] }; }
function starlinkHandler(res){
  if (slCache.data && Date.now()-slCache.t < (slCache.data.source==='live' ? 2000 : 15000)) return send(res, 200, slCache.data.source==='mock' ? starlinkMock(slCache.data.reason) : slCache.data);
  execFile(STARLINK_PY, [path.join(ROOT,'server/starlink_status.py')], { timeout: 8000 }, (err, stdout) => {
    let d = null; try { d = JSON.parse(stdout); } catch {}
    const data = d && d.ok ? { source:'live', ...d } : starlinkMock(d?.error || (err && err.killed ? 'antenna non raggiungibile (timeout su 192.168.100.1:9200)' : err ? 'script non eseguibile: '+String(err.message).split('\n')[0].slice(0,120) : 'risposta non valida'));
    slCache = { t: Date.now(), data }; send(res, 200, data);
  });
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/starlink') return starlinkHandler(res);
  if (url.pathname === '/api/grok/health') return KEY ? send(res, 200, { ok:true, model: MODEL }) : send(res, 503, { ok:false, error:'XAI_API_KEY non impostata sul server' });
  if (url.pathname === '/api/grok' && req.method === 'POST'){
    if (!KEY) return send(res, 503, { error:'XAI_API_KEY non impostata sul server' });
    const ip = req.socket.remoteAddress; const now = Date.now(); const h = (hits.get(ip)||[]).filter(t => now-t < 36e5);
    if (h.length >= 20) return send(res, 429, { error:'limite orario raggiunto' }); h.push(now); hits.set(ip, h);
    let body=''; for await (const c of req){ body += c; if (body.length > 20000) return send(res, 413, { error:'richiesta troppo grande' }); }
    let inp; try { inp = JSON.parse(body); } catch { return send(res, 400, { error:'JSON non valido' }); }
    const msgs = (Array.isArray(inp.messages)?inp.messages:[]).slice(-8).filter(m => ['user','assistant'].includes(m.role)).map(m => ({ role:m.role, content:String(m.content).slice(0,2000) }));
    const ctx = inp.trip ? `Contesto viaggio: ${JSON.stringify(inp.trip).slice(0,300)}` : '';
    try {
      const r = await fetch('https://api.x.ai/v1/chat/completions', { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer '+KEY },
        body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role:'system', content: SYSTEM+' '+ctx }, ...msgs] }), signal: AbortSignal.timeout(30000) });
      const j = await r.json(); if (!r.ok) return send(res, 502, { error: 'xAI: '+(j.error?.message || j.error || r.status) });
      return send(res, 200, { reply: j.choices?.[0]?.message?.content || '' });
    } catch(e){ return send(res, 502, { error:'xAI non raggiungibile' }); }
  }
  let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if ((!f.startsWith(ROOT + path.sep) && f !== ROOT) || /\/(server|\.env|career|\.venv|node_modules|\.git)(\/|$)/.test(p) || p.includes('..')) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => { if (err){ res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)]||'application/octet-stream', ...sec }); res.end(data); });
}).listen(PORT, HOST, () => console.log(`Z-X SOLANA su http://${HOST}:${PORT} · Grok ${KEY?'ATTIVO ('+MODEL+')':'disattivato (manca XAI_API_KEY)'}`));
