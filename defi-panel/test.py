import json, re
from playwright.sync_api import sync_playwright
nacl = open("/workspace/firma/server/node_modules/tweetnacl/nacl-fast.min.js").read()
MOCK = nacl + r"""
;(function(){
  const kp = nacl.sign.keyPair();
  const b58a="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function b58(u8){let d=[0];for(const b of u8){let c=b;for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c){d.push(c%58);c=(c/58)|0}}let s="";for(const b of u8){if(b)break;s+="1"}for(let i=d.length-1;i>=0;i--)s+=b58a[d[i]];return s}
  const address=b58(kp.publicKey); window.__addr=address; window.__signed=0;
  const account={address,publicKey:kp.publicKey,chains:["solana:mainnet"],features:["solana:signIn","solana:signMessage","solana:signTransaction"]};
  const wallet={version:"1.0.0",name:"MockWallet",icon:"data:image/svg+xml;base64,PHN2Zy8+",chains:["solana:mainnet"],accounts:[account],
   features:{"standard:connect":{version:"1.0.0",connect:async()=>({accounts:[account]})},
    "solana:signIn":{version:"1.0.0",signIn:async(i)=>{
       const m=`${i.domain} wants you to sign in with your Solana account:\n${address}\n\n${i.statement}\n\nURI: ${i.uri}\nVersion: ${i.version}\nChain ID: ${i.chainId}\nNonce: ${i.nonce}\nIssued At: ${i.issuedAt}\nExpiration Time: ${i.expirationTime}`;
       const bytes=new TextEncoder().encode(m); const sig=nacl.sign.detached(bytes,kp.secretKey);
       return [{account,signedMessage:bytes,signature:sig,signatureType:"ed25519"}]}},
    "solana:signTransaction":{version:"1.0.0",supportedTransactionVersions:["legacy",0],signTransaction:async(...ins)=>ins.map(({transaction})=>{
       const t=transaction.slice(); const n=t[0]; const msg=t.slice(1+64*n); const sig=nacl.sign.detached(msg,kp.secretKey); t.set(sig,1); window.__signed++; return {signedTransaction:t};})}}};
  const cb=({register})=>register(wallet);
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet",{detail:cb}));
  window.addEventListener("wallet-standard:app-ready",({detail})=>cb(detail));
})();
"""
URL="https://x-zdos.it/defi/"
res={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=True,args=["--no-sandbox"])
    for name,vp,mob in [("desktop",{"width":1366,"height":900},False),("mobile",{"width":390,"height":844},True)]:
        ctx=b.new_context(viewport=vp,is_mobile=mob,device_scale_factor=2 if mob else 1,has_touch=mob)
        pg=ctx.new_page(); errs=[]
        pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror",lambda e: errs.append("PAGEERR "+str(e)))
        pg.goto(URL+"#swap",wait_until="networkidle")
        pg.wait_for_function("document.querySelector('#s-quote .big')||/Nessuna/.test(document.querySelector('#s-quote').textContent)",timeout=30000)
        pg.wait_for_timeout(800)
        res[name+"_quote"]=pg.inner_text("#s-quote")[:160]; res[name+"_eco"]=pg.inner_text("#eco")
        pg.screenshot(path=f"screens/{name}-1-swap.png",full_page=mob)
        pg.click('.tabs button[data-tab="pool"]'); pg.wait_for_selector("#p-bins i",timeout=30000); pg.wait_for_timeout(1500)
        res[name+"_pool"]=pg.inner_text("#p-list")[:200]
        pg.screenshot(path=f"screens/{name}-2-pool.png",full_page=True)
        pg.click('.tabs button[data-tab="basket"]'); pg.wait_for_timeout(500); pg.click("#c-quote"); pg.wait_for_timeout(4000)
        res[name+"_basket"]=pg.inner_text("#c-legs")[:200]
        pg.screenshot(path=f"screens/{name}-3-basket.png",full_page=True)
        pg.click('.tabs button[data-tab="posizioni"]'); pg.wait_for_timeout(500)
        pg.screenshot(path=f"screens/{name}-4-posizioni.png",full_page=False)
        pg.click('.mode button[data-mode="dev"]'); pg.click('.tabs button[data-tab="dev"]'); pg.wait_for_selector("[data-try]",timeout=15000)
        pg.eval_on_selector('[data-try="/api/defi/health"]','e=>e.click()'); pg.wait_for_timeout(1500); pg.wait_for_timeout(5500)
        res[name+"_dev"]=pg.inner_text("#d-out")[:120]; res[name+"_log_lines"]=pg.locator("#d-log div").count()
        pg.screenshot(path=f"screens/{name}-5-dev.png",full_page=True)
        pg.click('.tabs button[data-tab="pool"]'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f"screens/{name}-6-pool-dev.png",full_page=True)
        res[name+"_errors"]=errs
        ctx.close()
    # flusso wallet (mock): login firma ZDOS, swap fino alla firma, LP fino alla firma (senza fondi: l'invio fallisce in preflight)
    ctx=b.new_context(viewport={"width":1366,"height":900},bypass_csp=True); pg=ctx.new_page(); pg.add_init_script(MOCK); errs=[]
    pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(URL+"?mode=dev#swap",wait_until="networkidle"); pg.click("#wbtn"); pg.wait_for_timeout(300)
    pg.screenshot(path="screens/desktop-7-wallet-modal.png")
    pg.click("#wm-list button"); pg.wait_for_function("!/Accedi/.test(document.querySelector('#wbtn').textContent)",timeout=20000)
    res["login_btn"]=pg.inner_text("#wbtn")
    pg.wait_for_function("document.querySelector('#s-quote .big')",timeout=30000)
    pg.wait_for_timeout(4000)
    if pg.is_visible("#s-ack"): pg.check("#s-ack")
    pg.click("#s-go"); pg.wait_for_timeout(12000)
    res["swap_result"]=pg.inner_text("#toast")+" | "+pg.inner_text("#s-quote")[:200]; res["signed_count_after_swap"]=pg.evaluate("window.__signed")
    pg.screenshot(path="screens/desktop-8-swap-firmato.png")
    pg.click('.tabs button[data-tab="pool"]'); pg.wait_for_selector("#p-bins i",timeout=30000)
    pg.fill("#lp-y","0.001"); pg.check("#lp-ack"); pg.click("#lp-go")
    pg.wait_for_function("/err|ok/.test(document.querySelector('#lp-msg').className.replace('msg',''))",timeout=60000)
    res["lp_result"]=pg.inner_text("#lp-msg"); res["signed_count_after_lp"]=pg.evaluate("window.__signed")
    pg.screenshot(path="screens/desktop-9-lp-firmato.png",full_page=True)
    res["flow_errors"]=errs
    ctx.close(); b.close()
print(json.dumps(res,indent=1,ensure_ascii=False))
