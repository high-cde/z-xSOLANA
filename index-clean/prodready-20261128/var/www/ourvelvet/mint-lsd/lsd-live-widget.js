(() => {
  const API_URL = "https://ourvelvet.online/api/domcoin/lsd-live";
  const MINT = "FSwCz9qgcvfWGEU8QU3h4fQpyQ8TB2KLHYC9bmoMxDgP";
  const DEFAULT_WALLET = "A4JY5VGS1oGSqMxW6a7EtwTg7q6wjG3uxVpNaHPyG9PJ";

  function fmtNum(n, dec = 0) {
    return Number(n || 0).toLocaleString("it-IT", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  async function renderWidget() {
    let host = document.getElementById("lsdCapBanner");
    if (!host) {
      host = document.createElement("div");
      host.id = "lsdCapBanner";
      document.body.appendChild(host);
    }

    let connectedWallet = DEFAULT_WALLET;
    try {
      const p = (window.phantom && window.phantom.solana) || window.solana;
      if (p && p.publicKey) connectedWallet = p.publicKey.toBase58();
    } catch (_) {}

    host.style.cssText =
      "max-width:720px;margin:14px auto;padding:12px 16px;border-radius:16px;" +
      "background:linear-gradient(135deg,rgba(20,16,34,.96),rgba(11,8,22,.96));" +
      "border:1px solid rgba(245,195,108,.48);color:#fdf4ff;" +
      "font-family:Inter,system-ui,sans-serif;font-size:12px;display:grid;gap:8px;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.35)";

    let data = null; // niente dati inventati: se l'API non risponde lo diciamo

    try {
      const r = await fetch(API_URL + "?wallet=" + encodeURIComponent(connectedWallet));
      const j = await r.json();
      if (j && j.ok) data = j;
    } catch (_) {}
    if (!data) {
      host.innerHTML = '<span style="color:#fca5a5">Dati L$D non disponibili ora.</span> <a href="/pay/dom-coin/" style="color:#f5c36c">Dati on-chain →</a>';
      return;
    }

    host.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <img src="https://ourvelvet.online/mint-lsd/logo-lsd.png" alt="L$D" style="width:26px;height:26px;border-radius:50%;border:1px solid #f5c36c">
          <div>
            <strong style="color:#f5c36c;font-size:13px">Dom-Coin (L$D) · Solana SPL Live</strong><br>
            <span style="color:#d8b4fe">Supply: <b>${fmtNum(data.totalSupply)}</b><br><span style="font-size:10.5px;color:#e2b8c9">Nessun valore in euro dichiarato. <a href="/lsd-trasparenza/" style="color:#f5c36c">Trasparenza e pool reale →</a></span></span>
          </div>
        </div>
        <button id="btnCopyLsdMint" style="border:1px solid rgba(245,195,108,.5);background:#1e1633;color:#f5c36c;border-radius:10px;padding:6px 10px;font-weight:700;font-size:11px;cursor:pointer">
          Copia Mint L$D
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.1);font-size:11px">
        <span>Saldo Wallet (<code>${data.wallet.slice(0, 4)}...${data.wallet.slice(-4)}</code>): <b>${fmtNum(data.walletBalanceLsd)} L$D</b></span>
        <span style="font-family:monospace;color:#c4b5fd">${MINT}</span>
      </div>
    `;

    const btn = document.getElementById("btnCopyLsdMint");
    if (btn) {
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(MINT);
          btn.textContent = "✓ Mint Copiato";
          setTimeout(() => { btn.textContent = "Copia Mint L$D"; }, 2000);
        } catch (_) {}
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderWidget);
  } else {
    renderWidget();
  }
})();
