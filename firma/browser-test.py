from playwright.sync_api import sync_playwright
nacl = open("server/node_modules/tweetnacl/nacl-fast.min.js").read()
MOCK = nacl + r"""
;(function(){
  const kp = nacl.sign.keyPair();
  const b58a="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function b58(u8){let d=[0];for(const b of u8){let c=b;for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c){d.push(c%58);c=(c/58)|0}}let s="";for(const b of u8){if(b)break;s+="1"}for(let i=d.length-1;i>=0;i--)s+=b58a[d[i]];return s}
  const address=b58(kp.publicKey); window.__addr=address; window.__kp=kp;
  const account={address,publicKey:kp.publicKey,chains:["solana:mainnet"],features:["solana:signIn","solana:signMessage"]};
  window.__tamper = false;
  const wallet={version:"1.0.0",name:"MockWallet",icon:"data:image/svg+xml;base64,PHN2Zy8+",chains:["solana:mainnet"],accounts:[account],
   features:{"standard:connect":{version:"1.0.0",connect:async()=>({accounts:[account]})},
    "solana:signIn":{version:"1.0.0",signIn:async(i)=>{
       const m=`${i.domain} wants you to sign in with your Solana account:\n${address}\n\n${i.statement}\n\nURI: ${i.uri}\nVersion: ${i.version}\nChain ID: ${i.chainId}\nNonce: ${i.nonce}\nIssued At: ${i.issuedAt}\nExpiration Time: ${i.expirationTime}`;
       const bytes=new TextEncoder().encode(m); let sig=nacl.sign.detached(bytes,kp.secretKey);
       if(window.__tamper){sig=sig.slice();sig[3]^=1}
       window.__lastMsg=m; window.__lastSig=btoa(String.fromCharCode(...sig));
       return [{account,signedMessage:bytes,signature:sig,signatureType:"ed25519"}]}}}};
  const cb=({register})=>register(wallet);
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet",{detail:cb}));
  window.addEventListener("wallet-standard:app-ready",({detail})=>cb(detail));
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", headless=True, args=["--no-sandbox"])
    for d, tag, label in [("ourvelvet.online","velvet","Accedi con OurVelvet"),("x-zdos.it","zdos","Accedi con ZDOS")]:
        ctx = b.new_context(viewport={"width":1000,"height":1100})
        pg = ctx.new_page(); pg.add_init_script(MOCK)
        pg.goto(f"https://{d}/verifica/", wait_until="networkidle")
        btn = pg.locator("[data-zdos-firma]"); assert btn.inner_text()==label, btn.inner_text()
        # 1) firma valida, badge pubblico
        pg.check("[data-firma-pubblico]"); btn.click()
        pg.wait_for_selector(".fm-ok", timeout=15000)
        print(d, "LOGIN:", pg.inner_text("[data-firma-status]")[:60], "| sessione visibile:", pg.is_visible("#sessBox"))
        sess = pg.evaluate("fetch('/api/firma/session').then(r=>r.json())"); print("  session:", sess["autenticato"], sess["domain"])
        badge = pg.evaluate("fetch('/api/firma/badge?address='+window.__addr).then(r=>r.json())"); print("  badge:", badge)
        # 2) check form con il messaggio firmato dal wallet → valida
        pg.fill("#msg", pg.evaluate("window.__lastMsg")); pg.fill("#sig", pg.evaluate("window.__lastSig")); pg.fill("#adr", pg.evaluate("window.__addr"))
        pg.click("#chkBtn"); pg.wait_for_selector("#res.on"); print("  CHECK valida →", pg.inner_text("#res strong"))
        pg.screenshot(path=f"screens/verifica-{tag}-valida.png", full_page=False)
        # 3) firma alterata nel form
        sig = pg.evaluate("(()=>{const s=Uint8Array.from(atob(window.__lastSig),c=>c.charCodeAt(0));s[7]^=1;return btoa(String.fromCharCode(...s))})()")
        pg.fill("#sig", sig); pg.click("#chkBtn"); pg.wait_for_selector('#res.n')
        print("  CHECK alterata →", pg.inner_text("#res strong"))
        pg.screenshot(path=f"screens/verifica-{tag}-non-valida.png", full_page=False)
        # 4) login con wallet che firma male → rifiutato
        pg.evaluate("window.__tamper=true"); pg.click("[data-zdos-firma]"); pg.wait_for_selector(".fm-err", timeout=15000)
        print("  LOGIN alterato →", pg.inner_text("[data-firma-status]"))
        ctx.close()
    b.close()
