/* Portale sviluppatori Zlang — dati on-chain in sola lettura dal browser (RPC pubblici). Nessuna firma, nessuna chiave. */
(function () {
  'use strict';
  const SOL_RPC = 'https://solana-rpc.publicnode.com';
  const POLY_RPCS = ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.drpc.org'];
  const METAPLEX = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  function units(raw, dec) { const s = BigInt(raw).toString().padStart(dec + 1, '0'); const i = s.slice(0, s.length - dec); const f = dec ? s.slice(s.length - dec).replace(/0+$/, '') : ''; return BigInt(i).toLocaleString('it-IT') + (f ? ',' + f : ''); }
  async function post(url, body) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (j.error) throw new Error(j.error.message || 'errore RPC'); return j.result; }
  async function solInfo(addr, enc) { return post(SOL_RPC, { jsonrpc: '2.0', id: 1, method: 'getAccountInfo', params: [addr, { encoding: enc || 'jsonParsed' }] }); }
  function b64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function mpName(u) { const dv = new DataView(u.buffer); const d = new TextDecoder(); let o = 65; const rd = () => { const n = dv.getUint32(o, true); o += 4; const s = d.decode(u.slice(o, o + n)).replace(/\0+$/, ''); o += n; return s; }; return { name: rd(), symbol: rd() }; }
  async function solMint(mint) {
    const r = await solInfo(mint); const v = r && r.value; if (!v || !v.data.parsed || v.data.parsed.type !== 'mint') throw new Error('mint non trovato');
    const i = v.data.parsed.info; const ext = i.extensions || []; const o = { supply: units(i.supply, i.decimals), decimals: String(i.decimals), mintAuth: i.mintAuthority ? 'attiva' : 'revocata', freezeAuth: i.freezeAuthority ? 'attiva' : 'revocata', program: v.owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? 'Token-2022' : 'SPL Token' };
    const tm = ext.find((x) => x.extension === 'tokenMetadata'); const mp = ext.find((x) => x.extension === 'metadataPointer');
    if (tm) { o.name = tm.state.name; o.symbol = tm.state.symbol; }
    else if (mp && mp.state.metadataAddress !== mint) { const m = await solInfo(mp.state.metadataAddress, 'base64'); if (m && m.value && m.value.owner === METAPLEX) { const ns = mpName(b64(m.value.data[0])); o.name = ns.name; o.symbol = ns.symbol; } }
    o.slot = r.context.slot.toLocaleString('it-IT'); return o;
  }
  async function evm(to, data) { let e; for (const u of POLY_RPCS) { try { return await post(u, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }); } catch (x) { e = x; } } throw e; }
  function abiStr(h) { h = h.slice(2); const n = parseInt(h.slice(64, 128), 16); const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = parseInt(h.substr(128 + i * 2, 2), 16); return new TextDecoder().decode(u); }
  async function erc20(t) { const [n, s, d, ts] = await Promise.all(['0x06fdde03', '0x95d89b41', '0x313ce567', '0x18160ddd'].map((x) => evm(t, x))); const dec = Number(BigInt(d)); return { name: abiStr(n), symbol: abiStr(s), decimals: String(dec), supply: units(BigInt(ts).toString(), dec) }; }

  async function fill(card) {
    const st = card.querySelector('.live'); const kind = card.dataset.chain; const addr = card.dataset.addr;
    try {
      const d = kind === 'solana' ? await solMint(addr) : await erc20(addr);
      Object.keys(d).forEach((k) => card.querySelectorAll('[data-f="' + k + '"]').forEach((el) => { el.textContent = d[k]; }));
      if (st) { st.textContent = '● dato letto ora on-chain' + (d.slot ? ' · slot ' + d.slot : '') + ' · ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); st.className = 'live ok'; }
    } catch (e) { if (st) { st.textContent = '○ RPC non raggiungibile: valori dell’ultima rilevazione (21/11/2026)'; st.className = 'live err'; } }
  }
  document.querySelectorAll('[data-chain][data-addr]').forEach(fill);
  document.querySelectorAll('pre[data-copy]').forEach((pre) => {
    if (!navigator.clipboard) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm copy'; b.textContent = 'Copia';
    b.onclick = () => navigator.clipboard.writeText(pre.querySelector('code').innerText).then(() => { b.textContent = 'Copiato'; setTimeout(() => (b.textContent = 'Copia'), 1400); });
    pre.prepend(b);
  });
})();
