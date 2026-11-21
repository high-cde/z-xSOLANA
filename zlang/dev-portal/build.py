#!/usr/bin/env python3
"""Genera le pagine statiche del portale sviluppatori Zlang (x-zdos.it/dev/).
Gli esempi sono letti dai modelli reali dell'IDE (../ide/assets/ide.js) e compilati con zlangc (../tools/zlangc.py)
per riportarne dimensione e numero di istruzioni. Uso: python3 zlang/dev-portal/build.py"""
import html, json, os, re, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ZL = os.path.dirname(HERE)
V = '3'
SNAP = '21/11/2026 alle 15:41 (ora di Roma)'
DSN_SOL = '35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4'
DSN_POL = '0xfc90516a1f736FaC557e09D8853dB80dA192c296'
OV = '2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump'
REPO = 'https://github.com/high-cde/z-xSOLANA/tree/main/zlang'
e = html.escape

def templates():
    s = open(os.path.join(ZL, 'ide/assets/ide.js'), encoding='utf-8').read()
    a = s.index('const TEMPLATES = {'); b = s.index('};', a)
    body = s[a + len('const TEMPLATES = '):b + 1]
    out = json.loads(subprocess.check_output(['node', '-e', 'process.stdout.write(JSON.stringify(eval("("+require("fs").readFileSync(0,"utf8")+")")))'], input=body.encode()))
    res = {}
    for name, src in out.items():
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, name); open(p, 'w', encoding='utf-8').write(src)
            subprocess.check_call(['python3', os.path.join(ZL, 'tools/zlangc.py'), p, '--bytecode', p + '.zbin', '--header', p + '.h'], stdout=subprocess.DEVNULL)
            size = os.path.getsize(p + '.zbin')
        res[name] = {'src': src, 'bytes': size, 'ins': sum(1 for l in src.splitlines() if l.strip() and not l.strip().startswith('#'))}
    return res

NAV = [('', 'Portale'), ('linguaggio/', 'Linguaggio'), ('esempi/', 'Esempi'), ('monete/', 'Monete'), ('api/', 'API')]

def page(path, title, desc, body):
    nav = ''.join('<a href="/dev/%s"%s>%s</a>' % (p, ' aria-current="page"' if p == path else '', t) for p, t in NAV)
    return f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#070112">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src https://solana-rpc.publicnode.com https://polygon-bor-rpc.publicnode.com https://polygon.drpc.org; base-uri 'self'; form-action 'none'">
<link rel="canonical" href="https://x-zdos.it/dev/{path}">
<link rel="icon" type="image/svg+xml" href="/dev/assets/zdev.svg">
<link rel="preload" href="/assets/fonts/SpaceGrotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="/dev/assets/dev.css?v={V}">
</head>
<body>
<a class="skip" href="#main">Vai al contenuto</a>
<header class="top">
  <a class="brand" href="/dev/"><img src="/dev/assets/zdev.svg" alt="" width="24" height="24"><span>Zlang <b>Dev</b></span></a>
  <nav class="menu" aria-label="Sezioni del portale">{nav}</nav>
  <a class="btn primary sm" href="/ide/">Apri l’IDE</a>
</header>
<main id="main">
{body}
</main>
<footer>
  <p>Portale sviluppatori Zlang · <a href="https://x-zdos.it/">x-zdos.it</a> · <a href="/ide/">Zlang IDE</a> · <a href="{REPO}" rel="noopener">Sorgenti su GitHub</a></p>
  <p>Solo strumenti e documentazione: nessun consiglio finanziario, nessuna promessa di rendimento. Le firme le fa solo il tuo wallet.</p>
  <p>© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza proprietaria ZSEL</p>
</footer>
<script src="/dev/assets/dev.js?v={V}"></script>
</body>
</html>
'''

def code(src, copy=True):
    return '<pre%s><code>%s</code></pre>' % (' data-copy' if copy else '', e(src.rstrip('\n')))

def ide(name, label='Apri nell’IDE'):
    return '<a class="btn primary sm" href="/ide/?esempio=%s">%s</a>' % (name, label)

T = templates()
EX = [
    ('hello', 'Hello Zlang', 'Il primo programma: due righe <code>emit</code>. Gira su entrambi i toolchain.'),
    ('vault', 'Saldo locale', 'Variabili intere e sottrazione: la VM Rust esegue LOAD, SUB e STORE. Nessun fondo reale.'),
    ('flusso-zlb2', 'Tutte le istruzioni ZLB2', 'Etichette, <code>if … jump</code>, <code>wait</code> e <code>storage.read</code> compilati da zlangc.'),
    ('dsn-solana', '$DSN su Solana', 'Legge supply, decimali, authority e metadati del mint $DSN su mainnet.'),
    ('dsn-polygon', '$DSN su Polygon', 'Legge nome, simbolo, decimali e totalSupply del contratto ERC-20.'),
    ('velvet-ov', 'VELVET ($OV)', 'Legge il mint VELVET: supply, decimali, authority, nome e simbolo.'),
    ('saldi-wallet', 'Saldi del tuo wallet', 'Con Phantom collegato, <code>@wallet</code> diventa il tuo indirizzo: SOL, $DSN e VELVET.'),
    ('znft-regole', 'zNFT · regole di certificazione', 'Il programma che la galleria zNFT esegue prima della revisione: hash, dichiarazioni 18+, consensi, segnalazioni. Namespace <code>znft/</code>.'),
    ('znft-vendita', 'zNFT · messa in vendita', 'Controlla possesso on-chain e prezzo prima di pubblicare un annuncio in Velvet Pay (devnet).'),
    ('znft-acquisto', 'zNFT · acquisto', 'Pagamento VPAY verificato on-chain prima della consegna del certificato.'),
]
ZNFT = 'https://velvet.x-zdos.it/znft/'
VPAY = 'ESFG2VFX6ptALeruvT4mN7LN4DewoCrAXW9YfkaZLAKk'

def excard(k, t, d):
    x = T[k + '.zlang']
    return f'<div class="card"><h3>{t}</h3><p class="small">{d}</p><p class="tiny muted">zlangc: {x["bytes"]} byte, {x["ins"]} istruzioni</p><div class="row">{ide(k)}<a class="btn sm" href="/dev/esempi/#{k}">Vedi il codice</a></div></div>'

# ---------------- home ----------------
home = f'''<section class="hero">
<h1>Portale sviluppatori <span>Zlang</span></h1>
<p class="lead">Documentazione, esempi pronti e dati on-chain delle monete dell’ecosistema ZDOS: $DSN su Solana e Polygon, VELVET su Solana. Tutto si prova nel browser con lo <a href="/ide/">Zlang IDE</a>, senza installare nulla.</p>
<div class="row"><a class="btn primary" href="/ide/?esempio=hello">Inizia dall’IDE</a><a class="btn" href="/dev/linguaggio/">Guida al linguaggio</a><a class="btn" href="/dev/monete/">Le monete</a></div>
</section>

<h2 id="quickstart">Quickstart in 4 passi</h2>
<ol class="steps">
<li><b>Apri un esempio.</b> {ide('dsn-solana', 'Apri “$DSN su Solana”')} Il file si salva solo nel tuo browser.</li>
<li><b>Compila.</b> Pannello <i>Compila</i> → <i>Compila</i> (o <kbd>Ctrl+S</kbd>). zlangc v2.5 produce il bytecode ZLB2, con disassemblato, hex e SHA-256.</li>
<li><b>Esegui.</b> <i>Esegui</i> lancia la VM Rust compilata in WASM. Poi l’IDE legge in sola lettura i percorsi <code>chain/</code> e scrive i dati on-chain in console.</li>
<li><b>Ancora (facoltativo).</b> In <i>Deploy</i> puoi firmare con Phantom un memo su <b>devnet</b> con l’hash del bytecode. È una prova pubblica della versione, non un deploy di contratti.</li>
</ol>

<h2 id="esempi">Esempi pronti</h2>
<div class="grid">{''.join(excard(*x) for x in EX[3:7])}{excard(*EX[0])}</div>
<p class="small"><a href="/dev/esempi/">Tutti gli esempi con il codice →</a></p>

<h2 id="znft">Zlang in produzione: regole della galleria zNFT</h2>
<p>La <a href="{ZNFT}">galleria zNFT</a> di OurVelvet (18+, <b>devnet</b>) usa tre programmi Zlang compilati con zlangc. Il server esegue lo stesso bytecode ZLB2 prima di certificare, mettere in vendita e consegnare un’opera; ogni pagina d’opera lo può rieseguire nel browser e confrontarne lo SHA-256. I valori arrivano dal namespace <code>znft/</code>, risolto dall’host regole della galleria (nell’IDE quei percorsi non sono risolti: si compila e si legge il codice).</p>
<div class="grid">{''.join(excard(*x) for x in EX if x[0].startswith('znft-'))}</div>
<p class="small">Pagamenti in Velvet Pay (VPAY), moneta di test Token-2022 su devnet: <a href="https://explorer.solana.com/address/{VPAY}?cluster=devnet" rel="noopener">{VPAY}</a>. Nessun valore reale. Panorama onesto di cosa esiste e cosa manca per una rete propria: <a href="https://x-zdos.it/rete/">Rete zDOS</a>.</p>

<h2 id="monete">Le monete in breve</h2>
<div class="grid">
<div class="card" data-chain="solana" data-addr="{DSN_SOL}"><h3>$DSN · Solana</h3><dl class="kv"><dt>Nome on-chain</dt><dd data-f="name">xZDOS</dd><dt>Supply</dt><dd data-f="supply">1.000.000.000.000</dd><dt>Decimali</dt><dd data-f="decimals">6</dd></dl><p class="live">dato dell’ultima rilevazione</p><div class="row"><a class="btn sm" href="/dev/monete/#dsn-solana">Scheda</a></div></div>
<div class="card" data-chain="polygon" data-addr="{DSN_POL}"><h3>$DSN · Polygon</h3><dl class="kv"><dt>Nome on-chain</dt><dd data-f="name">NETkali</dd><dt>Supply</dt><dd data-f="supply">1.000.000.000.000</dd><dt>Decimali</dt><dd data-f="decimals">18</dd></dl><p class="live">dato dell’ultima rilevazione</p><div class="row"><a class="btn sm" href="/dev/monete/#dsn-polygon">Scheda</a></div></div>
<div class="card" data-chain="solana" data-addr="{OV}"><h3>VELVET ($OV) · Solana</h3><dl class="kv"><dt>Nome on-chain</dt><dd data-f="name">VELVET</dd><dt>Supply</dt><dd data-f="supply">1.000.000.000</dd><dt>Decimali</dt><dd data-f="decimals">6</dd></dl><p class="live">dato dell’ultima rilevazione</p><div class="row"><a class="btn sm" href="/dev/monete/#velvet">Scheda</a></div></div>
</div>

<h2 id="stato">Cosa funziona davvero, cosa è in arrivo</h2>
<div class="tbl"><table>
<tr><th>Componente</th><th>Stato</th><th>Dettaglio</th></tr>
<tr><td>Zlang IDE</td><td><span class="tag ok">online</span></td><td>Editor, file nel browser, modelli, console. <a href="/ide/">x-zdos.it/ide/</a></td></tr>
<tr><td>zlangc v2.5 → bytecode ZLB2</td><td><span class="tag ok">reale</span></td><td>Port JS identico byte per byte a <code>tools/zlangc.py</code>.</td></tr>
<tr><td>Compiler + VM Rust (WASM)</td><td><span class="tag part">parziale</span></td><td>Esegue <code>emit</code> e <code>let</code> (interi, <code>a - b</code>). Le altre istruzioni diventano <code>UNKNOWN_OPCODE</code>.</td></tr>
<tr><td>Lettura dati on-chain (<code>chain/</code>)</td><td><span class="tag ok">reale</span></td><td>Sola lettura via RPC pubblici, risolta dall’host dell’IDE, non dalla VM.</td></tr>
<tr><td>Ancoraggio su devnet</td><td><span class="tag ok">reale</span></td><td>Memo con SHA-256 del bytecode, firmato in Phantom.</td></tr>
<tr><td>Regole zNFT (galleria OurVelvet)</td><td><span class="tag ok">reale · devnet</span></td><td>Tre programmi ZLB2 eseguiti dal server e nel browser prima di ogni passaggio. <a href="{ZNFT}#/regole">Vedi le regole</a></td></tr>
<tr><td>Velvet Pay (VPAY)</td><td><span class="tag part">test · devnet</span></td><td>Token-2022, 6 decimali. Versione Polygon Amoy (18 decimali) pronta ma non pubblicata.</td></tr>
<tr><td>Deploy di smart contract Solana</td><td><span class="tag no">non esiste</span></td><td>Zlang non genera programmi SBF/BPF né Rust/Anchor.</td></tr>
<tr><td>Funzioni, tipi, moduli</td><td><span class="tag info">in progetto</span></td><td>Descritti in <code>docs/language-spec.md</code>, non implementati dai compilatori.</td></tr>
<tr><td>Bytecode ZBC0 stack-based</td><td><span class="tag info">in progetto</span></td><td><code>docs/bytecode-spec.md</code>: specifica, non ancora codice.</td></tr>
<tr><td>Saldi holder di $DSN su Polygon</td><td><span class="tag part">esterno</span></td><td>Non leggibili con RPC semplice: si usa Polygonscan.</td></tr>
</table></div>
<p class="note">Nessuna transazione parte da questo portale. L’IDE firma solo quello che approvi tu in Phantom, e di default solo su devnet.</p>
'''

# ---------------- linguaggio ----------------
hello = T['hello.zlang']['src']
ling = f'''<section class="hero"><h1>Guida al linguaggio</h1>
<p class="lead">Zlang oggi ha due toolchain reali, entrambe nel repo <a href="{REPO}" rel="noopener">z-xSOLANA/zlang</a> ed entrambe nell’IDE. Qui trovi solo quello che compila davvero; la specifica più ampia è segnata come progetto.</p></section>

<h2 id="toolchain">Le due toolchain</h2>
<div class="grid">
<div class="card"><h3>zlangc v2.5</h3><p class="small"><code>tools/zlangc.py</code>. Legge il sorgente riga per riga e produce il bytecode <b>ZLB2</b> e un header C. Nell’IDE gira un port JavaScript identico byte per byte.</p></div>
<div class="card"><h3>Compiler + VM Rust</h3><p class="small"><code>src/compiler</code> e <code>src/vm</code>, compilati in WebAssembly senza modifiche. vCPU con 16 registri, 4 KB di memoria, massimo 3000 cicli.</p></div>
</div>

<h2 id="sintassi">Sintassi supportata</h2>
<p>Una istruzione per riga. Le righe vuote e quelle che iniziano con <code>#</code> sono ignorate. Ogni altra riga non riconosciuta ferma zlangc con un errore.</p>
<div class="tbl"><table>
<tr><th>Istruzione</th><th>Opcode ZLB2</th><th>VM Rust</th><th>Note</th></tr>
<tr><td><code>emit testo</code></td><td>0x01 EMIT</td><td>stampa</td><td>Le virgolette agli estremi vengono tolte.</td></tr>
<tr><td><code>let x = 100</code></td><td>0x02 ASSIGN</td><td>LOAD + STORE</td><td>Solo interi.</td></tr>
<tr><td><code>let x = a - b</code></td><td>0x02 ASSIGN</td><td>SUB</td><td><code>+ * /</code> non sono eseguiti: valgono 0.</td></tr>
<tr><td><code>if x == 1 jump fine</code></td><td>0x03 JUMP_IF</td><td>ignorata</td><td>Il payload è la condizione testuale.</td></tr>
<tr><td><code>fine:</code></td><td>0x04 LABEL</td><td>ignorata</td><td>Ogni riga che finisce con <code>:</code>.</td></tr>
<tr><td><code>wait</code></td><td>0x05 WAIT</td><td>ignorata</td><td>Payload fisso <code>async_signal</code>.</td></tr>
<tr><td><code>storage.read "percorso"</code></td><td>0x06 STORAGE_READ</td><td>ignorata</td><td>Percorso relativo: niente <code>/</code> iniziale, niente <code>..</code>.</td></tr>
</table></div>

<h2 id="zlb2">Formato del bytecode ZLB2</h2>
<p>Intestazione di 6 byte: <code>5A 4C 42 32</code> (“ZLB2”) e la versione <code>02 05</code>. Poi una sequenza di istruzioni, ognuna fatta di opcode (1 byte), lunghezza del payload (2 byte little-endian) e payload UTF-8. Il programma termina con <code>FF 00 00</code> (HALT).</p>
{code(hello, False)}
<p class="small">Compilato, l’esempio sopra diventa {T['hello.zlang']['bytes']} byte. Le prime righe del dump:</p>
<pre><code>0000  5a 4c 42 32 02 05 01 1f 00 43 69 61 6f 20 64 61   ZLB2.....Ciao da
0010  6c 20 70 72 6f 67 72 61 6d 6d 61 20 5a 6c 61 6e   l programma Zlan</code></pre>

<h2 id="storage">storage.read e il namespace chain/</h2>
<p><code>storage.read</code> legge un percorso dentro un namespace autorizzato. Da riga di comando, <code>tools/zlang_storage_read.py --root &lt;cartella&gt;</code> legge file locali (massimo 4096 byte di default) e rifiuta i percorsi che escono dalla cartella.</p>
<p>Nell’IDE c’è un namespace in più, <code>chain/</code>, che l’host dell’IDE risolve in sola lettura con RPC pubblici quando premi <i>Esegui</i>. Il bytecode contiene il percorso; la lettura la fa l’host, non la VM.</p>
<div class="tbl"><table>
<tr><th>Percorso</th><th>Restituisce</th></tr>
<tr><td><code>chain/solana/mainnet/mint/&lt;MINT&gt;</code></td><td>Programma token, supply, decimali, mint e freeze authority, nome e simbolo, estensioni Token-2022.</td></tr>
<tr><td><code>chain/solana/mainnet/balance/&lt;WALLET&gt;/&lt;MINT&gt;</code></td><td>Saldo del conto token associato (ATA) del wallet. Altri conti token dello stesso wallet non vengono sommati.</td></tr>
<tr><td><code>chain/solana/mainnet/sol/&lt;WALLET&gt;</code></td><td>Saldo in SOL.</td></tr>
<tr><td><code>chain/polygon/erc20/&lt;0xTOKEN&gt;</code></td><td>Nome, simbolo, decimali, totalSupply.</td></tr>
<tr><td><code>chain/polygon/erc20/&lt;0xTOKEN&gt;/balance/&lt;0xWALLET&gt;</code></td><td>Saldo ERC-20 di un indirizzo.</td></tr>
</table></div>
<p class="small">Al posto di <code>mainnet</code> puoi usare <code>devnet</code>. Nei percorsi Solana <code>@wallet</code> diventa l’indirizzo del Phantom collegato all’IDE.</p>

<h2 id="cli">Da riga di comando</h2>
{code("git clone https://github.com/high-cde/z-xSOLANA.git\ncd z-xSOLANA/zlang\npython3 tools/zlangc.py examples/hello.zlang --bytecode hello.zbin --header hello.h\ncargo build --release   # compiler e VM Rust")}

<h2 id="progetto">In progetto, non ancora implementato</h2>
<ul>
<li><code>docs/language-spec.md</code>: moduli, funzioni, tipi, <code>import</code>. Esempi come <code>examples/chain_node.zlang</code> usano questa sintassi e <b>non compilano</b> con le toolchain attuali.</li>
<li><code>docs/bytecode-spec.md</code>: VM stack-based con bytecode <code>ZBC0</code>, tabella costanti e syscall. È una specifica, non codice.</li>
<li>Nessuna toolchain genera programmi Solana (SBF/BPF): il “Deploy” dell’IDE è un ancoraggio dell’hash su devnet.</li>
</ul>
'''

# ---------------- esempi ----------------
ex_all = '<section class="hero"><h1>Esempi</h1><p class="lead">Sono gli stessi modelli dell’IDE. “Apri nell’IDE” li carica in un file nel tuo browser; la compilazione e l’esecuzione restano locali. Le letture <code>chain/</code> sono in sola lettura.</p></section>'
for k, t, d in EX:
    x = T[k + '.zlang']
    ex_all += f'<h2 id="{k}">{t}</h2><p>{d}</p><p class="tiny muted">zlangc v2.5: {x["bytes"]} byte di bytecode ZLB2, {x["ins"]} istruzioni.</p>{code(x["src"])}<div class="row">{ide(k)}</div>'
ex_all += '<p class="note">Con il toolchain Rust le righe <code>storage.read</code>, <code>if</code>, etichette e <code>wait</code> compaiono come <code>UNKNOWN_OPCODE</code>: è il comportamento reale della VM di oggi.</p>'

# ---------------- monete ----------------
def kvrow(label, f, val):
    return f'<dt>{label}</dt><dd data-f="{f}">{e(val)}</dd>'
mon = f'''<section class="hero"><h1>Le monete</h1>
<p class="lead">Dati letti dal browser direttamente on-chain, con RPC pubblici in sola lettura. Se l’RPC non risponde vedi i valori dell’ultima rilevazione. Nessun prezzo, nessuna previsione.</p></section>

<h2 id="dsn-solana">$DSN su Solana</h2>
<div class="card" data-chain="solana" data-addr="{DSN_SOL}">
<dl class="kv"><dt>Mint</dt><dd>{DSN_SOL}</dd>{kvrow('Nome on-chain','name','xZDOS')}{kvrow('Simbolo','symbol','$DSN')}{kvrow('Programma','program','Token-2022')}{kvrow('Supply','supply','1.000.000.000.000')}{kvrow('Decimali','decimals','6')}{kvrow('Mint authority','mintAuth','revocata')}{kvrow('Freeze authority','freezeAuth','revocata')}<dt>Conti con saldo</dt><dd>1 (rilevato il {SNAP})</dd></dl>
<p class="live">dato dell’ultima rilevazione</p>
<p class="small">Al momento tutta la supply è in un solo conto e non c’è una pool di liquidità.</p>
<div class="row"><a class="btn sm" href="https://solscan.io/token/{DSN_SOL}" rel="noopener">Solscan ↗</a><a class="btn sm" href="https://explorer.solana.com/address/{DSN_SOL}" rel="noopener">Solana Explorer ↗</a>{ide('dsn-solana')}</div>
</div>

<h2 id="dsn-polygon">$DSN su Polygon</h2>
<div class="card" data-chain="polygon" data-addr="{DSN_POL}">
<dl class="kv"><dt>Contratto</dt><dd>{DSN_POL}</dd>{kvrow('Nome on-chain','name','NETkali')}{kvrow('Simbolo','symbol','$DSN')}<dt>Standard</dt><dd>ERC-20 su Polygon PoS</dd>{kvrow('Supply','supply','1.000.000.000.000')}{kvrow('Decimali','decimals','18')}<dt>Holder</dt><dd>non leggibili via RPC: vedi Polygonscan</dd></dl>
<p class="live">dato dell’ultima rilevazione</p>
<p class="small">Il nome registrato nel contratto è “NETkali”; il simbolo è $DSN.</p>
<div class="row"><a class="btn sm" href="https://polygonscan.com/token/{DSN_POL}" rel="noopener">Polygonscan ↗</a>{ide('dsn-polygon')}</div>
</div>

<h2 id="velvet">VELVET ($OV) su Solana</h2>
<div class="card" data-chain="solana" data-addr="{OV}">
<dl class="kv"><dt>Mint</dt><dd>{OV}</dd>{kvrow('Nome on-chain','name','VELVET')}{kvrow('Simbolo','symbol','$OV')}{kvrow('Programma','program','Token-2022')}{kvrow('Supply','supply','1.000.000.000')}{kvrow('Decimali','decimals','6')}{kvrow('Mint authority','mintAuth','revocata')}{kvrow('Freeze authority','freezeAuth','revocata')}<dt>Conti con saldo</dt><dd>6 (rilevato il {SNAP})</dd></dl>
<p class="live">dato dell’ultima rilevazione</p>
<p class="small">Gettone di comunità di OurVelvet, senza alcun rendimento. È ancora nella curva di lancio iniziale: il conto più grande (circa 99,4% della supply) è quello della curva, non c’è una pool DEX e i volumi sono nulli.</p>
<div class="row"><a class="btn sm" href="https://solscan.io/token/{OV}" rel="noopener">Solscan ↗</a><a class="btn sm" href="https://explorer.solana.com/address/{OV}" rel="noopener">Solana Explorer ↗</a>{ide('velvet-ov')}</div>
</div>

<h2 id="leggere">Leggere i dati da soli</h2>
<p>Le stesse letture con <code>curl</code>, senza chiavi:</p>
{code(f"""# Mint su Solana (supply, decimali, authority, estensioni)
curl -s https://solana-rpc.publicnode.com -H 'content-type: application/json' \\
  -d '{{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["{DSN_SOL}",{{"encoding":"jsonParsed"}}]}}'

# totalSupply su Polygon (selettore 0x18160ddd)
curl -s https://polygon-bor-rpc.publicnode.com -H 'content-type: application/json' \\
  -d '{{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{{"to":"{DSN_POL}","data":"0x18160ddd"}},"latest"]}}'""")}
<p class="note">Contare gli holder richiede chiamate indicizzate (<code>getProgramAccounts</code>) che gli RPC pubblici gratuiti spesso bloccano dal browser. Per questo il numero dei conti con saldo è una rilevazione datata, non un valore in diretta.</p>
'''

# ---------------- api ----------------
api = f'''<section class="hero"><h1>API pubbliche</h1>
<p class="lead">Le interfacce dell’ecosistema che oggi rispondono davvero a chiunque. Gli altri servizi hanno API interne o protette e non sono elencati qui.</p></section>

<h2 id="ecosystem">Directory dei servizi · <code>ecosystem.json</code></h2>
<p><span class="tag ok">GET</span> <code>https://x-zdos.it/ecosystem.json</code> — elenco dei servizi del portale con URL e maturità (<code>live</code>, <code>demo</code>, <code>beta</code>…).</p>
{code("curl -s https://x-zdos.it/ecosystem.json")}

<h2 id="discord">Verifica holder del bot Discord</h2>
<p>Usata dalla pagina <a href="/discord/verify/">/discord/verify/</a> dopo il comando <code>/verifica</code> su Discord. Limite: 30 richieste al minuto per IP.</p>
<div class="tbl"><table>
<tr><th>Metodo</th><th>Percorso</th><th>Cosa fa</th></tr>
<tr><td><span class="tag ok">GET</span></td><td><code>/discord/api/health</code></td><td>Stato del servizio: <code>{{"ok":true,"discord":true,…}}</code></td></tr>
<tr><td><span class="tag ok">GET</span></td><td><code>/discord/api/message?n=&lt;nonce&gt;</code></td><td>Messaggio da firmare per un nonce emesso da <code>/verifica</code>, con scadenza.</td></tr>
<tr><td><span class="tag info">POST</span></td><td><code>/discord/api/verify</code></td><td>Corpo JSON <code>{{nonce, publicKey, signature}}</code>: verifica la firma ed25519 del messaggio. Non muove fondi.</td></tr>
</table></div>
{code("curl -s https://x-zdos.it/discord/api/health")}

<h2 id="rpc">RPC pubblici usati da IDE e portale</h2>
<div class="tbl"><table>
<tr><th>Rete</th><th>Endpoint</th><th>Note</th></tr>
<tr><td>Solana mainnet</td><td><code>https://solana-rpc.publicnode.com</code></td><td>Funziona dal browser. Le chiamate indicizzate (<code>getProgramAccounts</code>, <code>getTokenAccountsByOwner</code>, <code>getTokenAccountBalance</code>) richiedono un token: per i saldi l’IDE calcola il conto associato e usa <code>getAccountInfo</code>.</td></tr>
<tr><td>Solana mainnet</td><td><code>https://api.mainnet-beta.solana.com</code></td><td>Rifiuta le chiamate dai browser (403); va bene da server o da terminale.</td></tr>
<tr><td>Solana devnet</td><td><code>https://api.devnet.solana.com</code></td><td>Il faucet via RPC è chiuso: SOL di test da faucet.solana.com.</td></tr>
<tr><td>Polygon PoS</td><td><code>https://polygon-bor-rpc.publicnode.com</code></td><td>Riserva: <code>https://polygon.drpc.org</code>.</td></tr>
</table></div>
<p class="small">Nell’IDE puoi impostare un tuo endpoint Solana nel pannello <i>zcomm</i>; resta salvato solo nel tuo browser.</p>

<h2 id="ide-host">Host dell’IDE (namespace chain/)</h2>
<p>Non è un’API HTTP: è il modo in cui un programma Zlang chiede dati on-chain all’IDE con <code>storage.read</code>. Percorsi e risposte sono nella <a href="/dev/linguaggio/#storage">guida al linguaggio</a>.</p>

<h2 id="non-pubblico">Cosa non è un’API pubblica</h2>
<ul>
<li>Lo swap zRoute usa le API di Jupiter direttamente dal browser: non c’è un’API zRoute da chiamare.</li>
<li>zdesk, il Radar e i servizi di OurVelvet hanno API interne, protette o legate al sito 18+: non sono documentate qui.</li>
</ul>
'''

PAGES = {
    '': ('Portale sviluppatori Zlang · ZDOS1.3', 'Documentazione Zlang, esempi da aprire nell’IDE e dati on-chain di $DSN e VELVET, in sola lettura.', home),
    'linguaggio/': ('Guida al linguaggio · Zlang Dev', 'Sintassi supportata da zlangc v2.5 e dalla VM Rust, formato bytecode ZLB2, storage.read e namespace chain/.', ling),
    'esempi/': ('Esempi · Zlang Dev', 'Esempi Zlang pronti da aprire nello Zlang IDE: hello, saldi, $DSN su Solana e Polygon, VELVET.', ex_all),
    'monete/': ('Monete · Zlang Dev', 'Schede on-chain di $DSN su Solana e Polygon e di VELVET ($OV) su Solana: supply, decimali, authority, link agli explorer.', mon),
    'api/': ('API pubbliche · Zlang Dev', 'API pubbliche dell’ecosistema ZDOS ed endpoint RPC usati da IDE e portale, con i loro limiti.', api),
}
for p, (t, d, b) in PAGES.items():
    out = os.path.join(HERE, p, 'index.html'); os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(page(p, t, d, b))
    print('scritto', out)
