#!/usr/bin/env python3
"""Genera site/piano/index.html da PIANO.md, togliendo i blocchi INTERNO (confronti e fonti dei concorrenti)."""
import re, markdown, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
src = open(HERE / 'PIANO.md', encoding='utf-8').read()
pub = re.sub(r'<!--INTERNO-->.*?<!--/INTERNO-->\n?', '', src, flags=re.S)
html = markdown.markdown(pub, extensions=['tables', 'fenced_code', 'toc'], extension_configs={'toc': {'toc_depth': '2'}})
html = re.sub(r'(<table>.*?</table>)', r'<div class="zl-tw">\1</div>', html, flags=re.S)
# indice di sezioni
heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', html)
toc = '<ul class="zl-toc">' + ''.join('<li><a href="#%s">%s</a></li>' % (i, re.sub(r'^\d+\.\s*', '', t)) for i, t in heads) + '</ul>'
page = '''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Piano · ZLang Launcher by ZDOS</title>
<meta name="description" content="Piano del progetto ZLang Launcher by ZDOS: architettura, commissioni, party pool, faucet, airdrop, sicurezza, costi in SOL e fasi.">
<meta name="theme-color" content="#fbf9ff">
<link rel="canonical" href="https://x-zdos.it/launcher/piano/">
<link rel="icon" type="image/svg+xml" href="/launcher/assets/zlang-mark.svg">
<link rel="preload" href="/assets/fonts/SpaceGrotesk-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="/launcher/launcher.css?v=1">
</head>
<body>
<header class="zl-top"><div class="zl-wrap">
  <a class="zl-brand" href="/launcher/" aria-label="ZLang by ZDOS, launcher"><img src="/launcher/assets/zlang-mark.svg" alt="" width="34" height="34"><span><b>ZLang</b><small>by ZDOS</small></span></a>
  <span class="zl-spacer"></span>
  <a class="zl-btn ghost sm u-link" href="/launcher/">Apri la demo</a>
</div></header>
<div class="zl-band"><div class="zl-wrap"><span class="k">ZLANG // SOLANA ANCHOR RECEIPT</span><span class="zl-pill">PIANO v1.0 · PROPOSTA</span><span>28 nov 2026</span></div></div>
<main class="zl-doc" id="main">
''' + html.replace('<h1', '<h1', 1) + '''
</main>
<footer class="zl-ft"><div class="zl-wrap">ZLang by ZDOS · ZDOS1.3 · P.IVA 11040550961 · Proposta: nessuna transazione reale, nessun consiglio di investimento.<br>Liquidità su protocollo Solana standard. <a href="/launcher/">Demo del launcher</a></div></footer>
</body>
</html>
'''
# sposta l'indice dopo la prima citazione (paragrafo introduttivo)
page = page.replace('</blockquote>', '</blockquote>\n' + toc, 1)
open(HERE / 'site' / 'piano' / 'index.html', 'w', encoding='utf-8').write(page)
bad = re.findall(r'(?i)meteora|jupiter|pump\.?fun|raydium|damm|dlmm|metaplex|launchlab|jumpbit|DBC', page)
print('parole vietate nella pagina pubblica:', bad)
