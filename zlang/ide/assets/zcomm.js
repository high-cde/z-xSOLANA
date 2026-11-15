/* zcomm-rpc — strato di comunicazione dell'IDE verso Solana JSON-RPC.
 * Riprende la forma busta di high-cde/Zcomm api/zcomm_gateway.js (v4.0.0-sovereign):
 *   { sender, recipient, payload, timestamp }
 * Come nel gateway originale NON c'è cifratura applicativa: il trasporto è HTTPS verso l'endpoint RPC.
 * Nessuna chiave privata passa da qui: le firme le fa solo Phantom nel browser dell'utente. */
(function (root) {
  'use strict';
  const CLUSTERS = {
    devnet: { label: 'Devnet', rpcs: ['https://api.devnet.solana.com'], explorer: '?cluster=devnet' },
    testnet: { label: 'Testnet', rpcs: ['https://api.testnet.solana.com', 'https://solana-testnet-rpc.publicnode.com'], explorer: '?cluster=testnet' },
    // l'RPC pubblico mainnet di Solana Labs rifiuta le chiamate dai browser (403): si usa publicnode, come in ZSwap
    'mainnet-beta': { label: 'Mainnet', rpcs: ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'], explorer: '' },
  };
  const VERSION = '4.0.0-sovereign';
  const listeners = [];
  let seq = 0;
  function envelope(sender, recipient, payload) {
    return { sender, recipient, payload, timestamp: new Date().toISOString() };
  }
  function customRpc(cluster) {
    try { return localStorage.getItem('zide.rpc.' + cluster) || ''; } catch (_) { return ''; }
  }
  function endpoints(cluster) { const c = customRpc(cluster); return c ? [c] : CLUSTERS[cluster].rpcs; }
  function endpoint(cluster) { return endpoints(cluster)[0]; }
  async function rpc(cluster, method, params) {
    const env = envelope('zlang-ide', cluster, { method, params: params || [] });
    const id = ++seq;
    const t0 = performance.now();
    const entry = { id, env, status: 'pending', ms: null };
    listeners.forEach((f) => f(entry));
    const urls = endpoints(cluster);
    let lastErr = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params: params || [] }),
        });
        const json = await res.json().catch(() => ({ error: { code: res.status, message: 'HTTP ' + res.status } }));
        if (json.error) {
          const code = json.error.code;
          lastErr = new Error(json.error.message || JSON.stringify(json.error));
          // limiti di accesso dell'endpoint: prova il successivo; errori della chiamata: fermati
          if ((code === 403 || code === 429 || res.status === 403 || res.status === 429) && i < urls.length - 1) continue;
          break;
        }
        entry.ms = Math.round(performance.now() - t0); entry.status = 'ok'; entry.endpoint = urls[i];
        listeners.forEach((f) => f(entry));
        return json.result;
      } catch (e) { lastErr = e; if (i < urls.length - 1) continue; }
    }
    entry.ms = Math.round(performance.now() - t0); entry.status = 'error'; entry.error = lastErr ? lastErr.message : 'errore';
    listeners.forEach((f) => f(entry));
    throw lastErr || new Error('errore RPC');
  }
  root.ZComm = {
    VERSION, CLUSTERS, envelope, rpc, endpoint,
    setCustomRpc(cluster, url) { try { url ? localStorage.setItem('zide.rpc.' + cluster, url) : localStorage.removeItem('zide.rpc.' + cluster); } catch (_) {} },
    customRpc,
    onEvent(f) { listeners.push(f); },
    explorerTx(cluster, sig) { return 'https://explorer.solana.com/tx/' + sig + CLUSTERS[cluster].explorer; },
    explorerAddr(cluster, a) { return 'https://explorer.solana.com/address/' + a + CLUSTERS[cluster].explorer; },
  };
})(window);
