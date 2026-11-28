# -*- coding: utf-8 -*-
import json, html, sys, os, re
from urllib.parse import quote_plus
sys.path.insert(0, os.path.dirname(__file__))
from data import *
from articles import ARTICLES, TESTATE
OUT = os.path.join(os.path.dirname(__file__), '..', 'rivista')
BASE = "https://zx.x-zdos.it/rivista/"
VERIF = "28 novembre 2026"
e = html.escape
def A(u, t, cls="", ext=True):
    r = ' target="_blank" rel="noopener nofollow"' if ext else ''
    c = f' class="{cls}"' if cls else ''
    return f'<a{c} href="{e(u,quote=True)}"{r}>{t}</a>'
def bk(ss): return "https://www.booking.com/searchresults.it.html?ss=" + quote_plus(ss)
def ab(slug): return "https://www.airbnb.it/s/" + slug + "/homes"
def bc(p): return f"https://www.booking.com/cars/city/{p}.it.html"
def dc(s): return "https://www.discovercars.com/" + s
def maps(q): return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(q)
def fen_s(path):
    from urllib.parse import quote
    return "https://fenait.org" + quote(path.strip(), safe="/-.:&")

regions = sorted({b[3] for b in BEACHES}, key=lambda r: [x[3] for x in BEACHES].index(r))

# ---------- sections ----------
def beach_rows():
    out = []
    for n, c, p, r in BEACHES:
        loc = f"{c} ({p})" if c != n else f"({p})"
        out.append(f'''<li class="row" data-reg="{e(r)}" data-q="{e((n+' '+c+' '+r).lower())}">
<div class="row-main"><h4>{e(n)}</h4><p class="meta">{e(c)} ({e(p)}) · {e(r)}</p></div>
<div class="row-links">{A(maps(f"{n} {c} {p} Italia"),"Mappa")}{A(bk(f"{c}, {r}, Italia"),"Alloggi")}{A(FEN,"Fonte FENAIT")}</div></li>''')
    return "\n".join(out)

def centre_rows(verified):
    out = []
    for c in CENTRES:
        url = c['u'] if verified.get(c['u']) else fen_s(c['s'])
        label = "Sito ufficiale" if verified.get(c['u']) else "Scheda FENAIT"
        out.append(f'''<li class="card" data-q="{e((c['n']+' '+c['p']+' '+c['r']).lower())}">
<span class="tag">{e(c['k'])}</span><h4>{e(c['n'])}</h4><p class="meta">{e(c['p'])} · {e(c['r'])}</p>
<p class="links">{A(url,label)}{A(fen_s(c['s']),"Fonte FENAIT") if verified.get(c['u']) else ""}</p></li>''')
    return "\n".join(out)

def simple_cards(items, tag=None, extra=True):
    out = []
    for c in items:
        note = f'<p>{e(c["note"])}</p>' if c.get('note') else ''
        src = f'{A(c["su"],"Fonte: "+e(c["src"]))}' if c.get('su') and c.get('su') != c['u'] else ''
        t = f'<span class="tag">{tag}</span>' if tag else ''
        out.append(f'''<li class="card" data-q="{e((c['n']+' '+c['p']).lower())}">{t}<h4>{e(c['n'])}</h4><p class="meta">{e(c['p'])}</p>{note}<p class="links">{A(c['u'],"Sito ufficiale")}{src}</p></li>''')
    return "\n".join(out)

def events_rows():
    out = []
    for ev in EVENTS:
        d = ev['d']
        out.append(f'''<li class="ev"><time datetime="{d}">{e(ev['lab'])}</time><div><h4>{e(ev['t'])}</h4><p class="meta">{e(ev['w'])}</p><p>{e(ev['note'])}</p><p class="links">{A(ev['su'],"Fonte: "+e(ev['src']))}</p></div></li>''')
    return "\n".join(out)

def hub_cards():
    out = []
    for name, ss, slug, cars, dcs, zones in HUBS:
        out.append(f'''<li class="card hub" data-q="{e((name+' '+zones).lower())}"><h4>{e(name)}</h4><p class="meta">Vicino a: {e(zones)}</p>
<p class="links">{A(bk(ss),"Alloggi · Booking.com")}{A(ab(slug),"Alloggi · Airbnb")}{A(bc(cars),"Auto · Booking.com")}{A(dc(dcs),"Auto · DiscoverCars")}</p></li>''')
    return "\n".join(out)


def toc():
    out=[]
    for i,a in enumerate(ARTICLES,1):
        out.append(f'''<li><a class="toc-a" href="articoli/{a['slug']}/"><span class="n">{i:02d}</span><span class="tt"><b>{e(a['t'])}</b><small>{e(a['sec'])} · {a['min']} min · {e(a['dek'])}</small></span></a></li>''')
    return "\n".join(out)
def testate_cards():
    out=[]
    for t in TESTATE:
        l2=A(t['u2'],e(t['u2l'])) if t.get('u2') else ''
        out.append(f'''<li class="card" data-q="{e((t['n']+' '+t['pub']+' '+t['c']).lower())}"><span class="tag">{e(t['c'])} · {e(t['f'])}</span><h4>{e(t['n'])}</h4><p class="meta">{e(t['pub'])}</p><p>{e(t['note'])}</p><p class="links">{A(t['u'],e(t['ul']))}{l2}</p></li>''')
    return "\n".join(out)

def reg_chips():
    s = '<button class="chip on" data-r="">Tutte</button>'
    for r in regions: s += f'<button class="chip" data-r="{e(r)}">{e(r)}</button>'
    return s

def jsonld(counts):
    items, i = [], 0
    def add(n, u):
        nonlocal i; i += 1
        items.append({"@type": "ListItem", "position": i, "name": n, "url": u})
    for c in CENTRES: add(c['n'], c['u'])
    for c in ASSOC: add(c['n'], c['u'])
    for c in EU_NAT: add(c['n'], c['u'])
    for c in EU_FED: add(c['n'], c['u'])
    for c in CLUBS: add(c['n'], c['u'])
    g = {"@context": "https://schema.org", "@graph": [
      {"@type": "Periodical", "@id": BASE+"#periodical", "name": "ARIA", "alternateName": "ARIA — rivista digitale 18+",
       "description": "Rivista digitale 18+ di naturismo, lifestyle consapevole e viaggio: luoghi reali, fonti verificate, consenso e legalità.",
       "inLanguage": "it-IT", "url": BASE, "isFamilyFriendly": False,
       "audience": {"@type": "PeopleAudience", "requiredMinAge": 18},
       "publisher": {"@type": "Organization", "name": "ZDOS1.3", "url": "https://x-zdos.it/"},
       "isPartOf": {"@type": "WebSite", "name": "Z-X Store · ZDOS", "url": "https://zx.x-zdos.it/"}},
      {"@type": "PublicationIssue", "name": "ARIA · Numero 1", "issueNumber": "1", "datePublished": "2026-11-28",
       "isPartOf": {"@id": BASE+"#periodical"}, "inLanguage": "it-IT", "url": BASE},
      {"@type": "WebPage", "@id": BASE, "url": BASE, "name": "ARIA · Rivista digitale 18+ di naturismo, lifestyle e viaggio",
       "isPartOf": {"@id": BASE+"#periodical"}, "dateModified": "2026-11-28",
       "primaryImageOfPage": BASE+"og.jpg", "inLanguage": "it-IT"},
      {"@type": "ItemList", "name": "Strutture, federazioni e club citati nel numero 1", "numberOfItems": i, "itemListElement": items}
    ]}
    return json.dumps(g, ensure_ascii=False)

def build(verified, counts):
    nb, nc = len(BEACHES), len(CENTRES)
    page = f'''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ARIA · Rivista digitale 18+ di naturismo, lifestyle e viaggio | ZDOS Z-X Store</title>
<meta name="description" content="ARIA, la rivista digitale 18+ di ZDOS1.3: spiagge e centri naturisti ufficiali, club e lifestyle con fonti pubbliche, guida al consenso, legalità e link per prenotare alloggi e auto.">
<link rel="canonical" href="{BASE}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="rating" content="adult">
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
<meta name="theme-color" content="#070112">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ZDOS · Z-X Store">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="ARIA · Rivista digitale 18+ di naturismo, lifestyle e viaggio">
<meta property="og:description" content="Luoghi reali, fonti verificate, consenso e legalità. Numero 1 · solo maggiorenni.">
<meta property="og:url" content="{BASE}">
<meta property="og:image" content="{BASE}og.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{BASE}og.jpg">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="preload" as="image" href="assets/hero-800.webp" media="(max-width:700px)">
<link rel="stylesheet" href="style.css">
<script type="application/ld+json">{jsonld(counts)}</script>
</head>
<body>
<a class="skip" href="#main">Vai ai contenuti</a>
<div id="gate" class="gate" role="dialog" aria-modal="true" aria-labelledby="gt" hidden>
 <div class="gate-box"><p class="kick">ARIA · Numero 1</p><h2 id="gt">Solo per maggiorenni</h2>
 <p>Questa rivista parla di naturismo e vita libertina tra adulti consenzienti. Non contiene immagini esplicite, ma è riservata a chi ha <strong>18 anni o più</strong>.</p>
 <div class="gate-btns"><button id="gate-yes" class="btn">Ho 18 anni o più · Entra</button><a class="btn ghost" href="https://x-zdos.it/">Esci</a></div>
 <p class="tiny">Entrando confermi di essere maggiorenne e di accettare le regole di consenso e rispetto della community ZDOS.</p></div>
</div>
<header class="top"><div class="wrap bar">
 <a class="brand" href="#top" aria-label="ARIA, inizio pagina"><span class="dot"></span>ARIA<small>18+</small></a>
 <nav aria-label="Sezioni" class="nav">
  <a href="#naturismo">Naturismo</a><a href="#lifestyle">Lifestyle</a><a href="#consenso">Consenso</a><a href="#legalita">Legalità</a><a href="#indice">Indice</a><a href="#testate">Testate</a><a href="#calendario">Calendario</a><a href="#prenota">Prenota</a><a href="#gruppo" class="pill">Unisciti</a>
 </nav></div></header>
<main id="main">
<section class="hero" id="top">
 <picture><source media="(max-width:700px)" srcset="assets/hero-800.webp"><img src="assets/hero.webp" alt="Illustrazione astratta: sole dorato che tramonta sul mare tra dune viola" width="1280" height="720" fetchpriority="high"></picture>
 <div class="hero-in wrap">
  <p class="kick">Numero 1 · Novembre 2026 · Editore ZDOS1.3</p>
  <h1>ARIA<span>la rivista dell’aria aperta<br>e dell’intimità consapevole</span></h1>
  <p class="lead">Naturismo, vita libertina e viaggio, raccontati senza ammiccamenti: luoghi veri, fonti pubbliche, regole chiare. Ogni voce ha un nome, un posto e un link ufficiale.</p>
  <p class="cta"><a class="btn" href="#naturismo">Sfoglia il numero</a><a class="btn ghost" href="#prenota">Pianifica il viaggio</a></p>
  <ul class="stats" aria-label="Il numero in cifre">
   <li><b>{nb}</b><span>luoghi naturisti ufficiali in Italia</span></li>
   <li><b>{nc}</b><span>centri certificati INF-FENAIT</span></li>
   <li><b>{len(CLUBS)}</b><span>club con sito ufficiale</span></li>
   <li><b>{len(ARTICLES)}</b><span>articoli originali in questo numero</span></li>
   <li><b>{counts['links']}</b><span>link controllati il {VERIF}</span></li>
  </ul>
 </div>
</section>

<section class="wrap issue" id="indice" aria-labelledby="ix">
 <div class="issue-h"><p class="kick">Numero corrente</p><h2 id="ix">ARIA N°1 · <time datetime="2026-11-28">28 novembre 2026</time></h2><p class="meta">Aggiornato il 28/11/2026 · Redazione ARIA · Editore ZDOS1.3 · {len(ARTICLES)} articoli originali · {nb} luoghi, {nc} centri, {len(CLUBS)} club, {len(TESTATE)} testate · <a href="feed.xml">Feed RSS</a></p></div>
 <ol class="toc">{toc()}</ol>
</section>

<section class="wrap edit" id="editoriale">
 <p class="kick">Editoriale</p>
 <h2>Nudi non significa senza regole.</h2>
 <div class="cols">
  <p class="drop">Il naturismo è un modo di stare al mondo: il corpo come cosa ordinaria, il rispetto come regola. Il lifestyle libertino è un’altra cosa, che condivide con il primo un solo principio: tutto avviene tra adulti, per scelta, con un «sì» detto e ripetibile. ARIA tiene le due strade separate, ma le racconta con lo stesso metodo.</p>
  <p>Il metodo è semplice. Pubblichiamo solo luoghi, club ed eventi che hanno un sito ufficiale raggiungibile e una fonte che si può aprire. Niente classifiche inventate, niente prezzi copiati da altri, niente foto di persone. Dove non esiste un’informazione verificabile, lo scriviamo e passiamo oltre.</p>
  <p>Questo è il primo numero e vogliamo farlo crescere con chi legge: se trovi un errore o un link cambiato, scrivilo nella community e lo correggiamo.</p>
 </div>
 <aside class="pull">«Il consenso non è un modulo da firmare all’ingresso: è una conversazione che può fermarsi in qualsiasi momento.»</aside>
</section>

<section class="wrap sec" id="naturismo">
 <header class="sec-h"><img src="assets/natura.webp" alt="Illustrazione di una costa mediterranea con pini e scogliere al sorgere del sole" width="1000" height="750" loading="lazy"><div><p class="kick">01 · Naturismo e nudismo</p><h2>Spiagge, centri e federazioni</h2><p>In Italia il naturismo non ha una legge nazionale: esistono leggi regionali, spiagge riconosciute dai Comuni e centri certificati. Partiamo da chi li elenca ufficialmente.</p></div></header>

 <div class="tools"><label class="srch"><span class="sr">Cerca nel numero</span><input id="q" type="search" placeholder="Cerca un luogo, una regione, un centro…" autocomplete="off"></label><p id="qn" class="meta" aria-live="polite"></p></div>

 <h3>Federazioni e associazioni</h3>
 <ul class="grid g3" id="g-assoc">{simple_cards(ASSOC)}</ul>

 <h3>Spiagge e luoghi riconosciuti in Italia <em>({nb})</em></h3>
 <p class="note">Elenco ufficiale FENAIT, «ordinato da nord a sud», dei luoghi riconosciuti dai Comuni. Alcune ordinanze si rinnovano ogni stagione: prima di partire controlla il Comune e la pagina della spiaggia.</p>
 <div class="chips" role="group" aria-label="Filtra per regione">{reg_chips()}</div>
 <ul class="rows" id="g-beach">{beach_rows()}</ul>

 <h3>Centri naturisti certificati INF-FENAIT <em>({nc})</em></h3>
 <p class="note">Campeggi, B&amp;B e resort che FENAIT inserisce nel circuito naturista certificato. Prenota sempre dal sito della struttura.</p>
 <ul class="grid g3" id="g-centre">{centre_rows(verified)}</ul>

 <h3>In Europa</h3>
 <ul class="grid g3" id="g-eu">{simple_cards(EU_NAT, 'Resort / campeggio')}</ul>
 <ul class="grid g4 small" id="g-eufed">{simple_cards(EU_FED, 'Federazione')}</ul>
</section>

<section class="wrap sec alt" id="lifestyle">
 <header class="sec-h rev"><img src="assets/lifestyle.webp" alt="Illustrazione art déco: tende di velluto, luna dorata e due calici" width="1000" height="750" loading="lazy"><div><p class="kick">02 · Lifestyle swinger</p><h2>Club e serate, solo da fonti pubbliche</h2><p>Qui trovi nome, città e sito ufficiale. Le informazioni descrittive sono quelle che i club stessi dichiarano pubblicamente. Orari, tessere, dress code e requisiti d’ingresso li decide ciascun locale: leggili sul loro sito.</p></div></header>
 <ul class="grid g3" id="g-club">{simple_cards(CLUBS, 'Club')}</ul>
 <p class="note">ZDOS non è affiliata a nessuno dei locali citati e non riceve compensi per queste segnalazioni. Le descrizioni sono sintesi di testi pubblici dei siti ufficiali e possono cambiare.</p>
</section>

<section class="wrap sec" id="consenso">
 <p class="kick">03 · Consenso, etichetta, sicurezza</p>
 <h2>Le regole che valgono ovunque</h2>
 <ol class="rules">
  <li><h4>Il «sì» è esplicito</h4><p>Il silenzio, un sorriso o un biglietto d’ingresso non sono consenso. Chiedi, ascolta la risposta, chiedi di nuovo se qualcosa cambia.</p></li>
  <li><h4>Il «no» è definitivo</h4><p>Non si insiste, non si negozia, non si offre da bere per far cambiare idea. Chi riceve un «no» ringrazia e si allontana.</p></li>
  <li><h4>Parola di stop: ROSSO</h4><p>Nelle community ZDOS «ROSSO» ferma tutto, subito, senza spiegazioni da dare. Nei locali valgono le regole del locale: conoscile prima.</p></li>
  <li><h4>Niente foto, niente riprese</h4><p>Mai fotografare o filmare altre persone senza permesso scritto. Nei luoghi naturisti e nei club è quasi sempre vietato.</p></li>
  <li><h4>Solo maggiorenni, sempre</h4><p>Nessuna persona minorenne o che dichiari di esserlo ha posto in questi spazi. Chi ha un dubbio sull’età non procede.</p></li>
  <li><h4>Lucidi per scegliere</h4><p>Alcol e sostanze alterano il consenso. Se non sei lucido, o non lo è chi hai davanti, ci si ferma.</p></li>
  <li><h4>Salute e protezione</h4><p>Informati su test e protezione e parlane prima, non durante. Il tuo medico e i servizi sanitari pubblici sono la fonte giusta.</p></li>
  <li><h4>Privacy degli altri</h4><p>Non rivelare nomi, volti o frequentazioni altrui. Quello che succede lì resta lì, a meno che non sia un abuso: in quel caso si segnala.</p></li>
 </ol>
 <div class="safe"><h3>Viaggiare in sicurezza</h3><ul>
  <li>Dì a una persona di fiducia dove sei e quando rientri.</li>
  <li>Scegli strutture con sito e contatti ufficiali; diffida di annunci che chiedono pagamenti anticipati fuori dai canali di prenotazione.</li>
  <li>Al mare: protezione solare, acqua, rispetto della flora e delle aree di nidificazione segnalate.</li>
  <li>In caso di abuso o pericolo chiama il <strong>112</strong> (numero unico di emergenza in Italia e nell’UE).</li></ul></div>
</section>

<section class="wrap sec alt" id="legalita">
 <p class="kick">04 · Legalità</p><h2>Cosa dice la legge, in sintesi</h2>
 <div class="cols">
  <p><strong>Nudismo.</strong> Secondo FENAIT, in Italia la pratica del naturismo <em>non è regolata da una legge nazionale</em>. Hanno una norma propria sei Regioni (Piemonte, Lombardia, Veneto, Emilia-Romagna, Abruzzo, Sardegna) e alcuni Comuni riconoscono spiagge naturiste. Fuori da queste aree autorizzate, restare nudi in luogo pubblico può portare a sanzioni. {A("https://fenait.org/il-naturismo-e-la-legge","Fonte: FENAIT · Il naturismo e la legge")}</p>
  <p><strong>Club privati.</strong> I locali citati si dichiarano riservati a soci maggiorenni con tesseramento. Entrare significa rispettarne il regolamento. Le persone minorenni non possono accedere in nessun caso.</p>
  <p><strong>Altri Paesi.</strong> Croazia, Francia, Spagna, Grecia e Germania hanno regole proprie, spesso più permissive nei centri certificati e più severe altrove. Informati prima presso la federazione nazionale (le trovi nella sezione Naturismo).</p>
 </div>
 <p class="note">Quanto sopra è informazione generale a scopo editoriale, non consulenza legale. Per un caso specifico rivolgiti a un avvocato o al Comune competente.</p>
</section>

<section class="wrap sec" id="testate">
 <p class="kick">05 · Le testate</p><h2>Le riviste del settore</h2>
 <p class="note">Riviste e newsletter del mondo naturista che segnaliamo. Le schede sono nostre, sintetizzate da quanto dichiarano le redazioni sui propri siti: nessun testo o logo copiato. Per il lifestyle non citiamo riviste: quelle che abbiamo trovato sono dismesse, non raggiungibili o di taglio esplicito, e non rientrano nei criteri di ARIA.</p>
 <ul class="grid g3" id="g-testate">{testate_cards()}</ul>
</section>

<section class="wrap sec" id="calendario">
 <p class="kick">06 · Calendario verificato</p><h2>Date con fonte</h2>
 <p class="note">Elenchiamo solo date che abbiamo letto sulla pagina ufficiale indicata il {VERIF}. Se un evento non ha una fonte raggiungibile, non lo pubblichiamo.</p>
 <ol class="evs">{events_rows()}</ol>
</section>

<section class="wrap sec alt" id="prenota">
 <header class="sec-h"><img src="assets/viaggi.webp" alt="Illustrazione di una strada tra le colline verso il sole, con valigia e bussola" width="1000" height="750" loading="lazy"><div><p class="kick">07 · Prenota il viaggio</p><h2>Alloggi e auto a noleggio</h2><p>Link diretti alle ricerche pubbliche per località. ZDOS non ha accordi di affiliazione con questi servizi e non mostra prezzi: li vedi sul sito di destinazione. Per i centri naturisti, prenota direttamente sul loro sito.</p></div></header>

 <form id="srch-trip" class="trip" autocomplete="off"><label for="place">Cerca una località</label><div><input id="place" type="text" placeholder="Es. Lido di Dante, Alghero, Cap d’Agde…" required><button class="btn" type="submit">Cerca</button></div>
 <p id="trip-out" class="links" aria-live="polite"></p></form>

 <h3>Per zona</h3>
 <ul class="grid g3" id="g-hub">{hub_cards()}</ul>
 <p class="note">Booking.com, Airbnb, DiscoverCars: nomi dei rispettivi proprietari, citati solo per indicare dove porta il link. Le pagine di ricerca di terzi possono chiedere un controllo anti-bot al primo accesso.</p>
</section>

<section class="wrap sec join" id="gruppo">
 <p class="kick">08 · Aggregati</p><h2>Entra nella community ZDOS</h2>
 <p>Una community di adulti per parlare di naturismo, viaggio, eventi e regole, con moderazione attiva. Ingresso solo 18+, consenso sempre, parola di stop <strong>ROSSO</strong>.</p>
 <p class="cta">{A("https://t.me/OurVelvetHub","Telegram · OurVelvetHub","btn")}{A("https://discord.gg/4CGZrAAxaq","Discord · ZDOS","btn ghost")}</p>
 <ul class="mini"><li>Vietato ogni contenuto con minori o con soggetti dall’aspetto minorile.</li><li>Niente foto di altre persone senza consenso; niente doxxing.</li><li>Nessuna promessa di guadagno, nessuna vendita di incontri.</li><li>Chi infrange le regole viene allontanato.</li></ul>
</section>
</main>
<footer class="foot"><div class="wrap">
 <p><strong>ARIA</strong> · rivista digitale 18+ · Numero 1 · 28 novembre 2026 · Editore: ZDOS1.3 · {A("https://zx.x-zdos.it/","Z-X Store",ext=False)} · {A("https://x-zdos.it/","x-zdos.it",ext=False)}</p>
 <p class="tiny">Illustrazioni originali generate con strumenti di intelligenza artificiale: non ritraggono persone reali né marchi. Nessuna fotografia di persone. Le informazioni su strutture, club ed eventi provengono dai siti ufficiali e dalle fonti citate e sono state controllate il {VERIF}; possono cambiare senza preavviso, verifica sempre la fonte. I nomi di terzi sono citati a solo scopo informativo; ZDOS non è affiliata né sponsorizzata da alcuna struttura citata. Informazione generale, non consulenza legale o sanitaria. Segnalazioni e correzioni: community ZDOS.</p>
 <p class="tiny">{A("fonti.json","Elenco dei link verificati (JSON)",ext=False)}</p>
</div></footer>
<script src="app.js" defer></script>
</body></html>'''
    return page


def article_page(a, idx):
    url = BASE+"articoli/"+a['slug']+"/"
    body=""
    for k,v in a['body']:
        if k=="p": body+=f"<p>{v}</p>\n"
        elif k=="h": body+=f"<h3>{v}</h3>\n"
        elif k=="ul": body+="<ul class='bul'>"+"".join(f"<li>{x}</li>" for x in v)+"</ul>\n"
    srcs="".join(f"<li>{A(u,e(t))}</li>" for t,u in a['src'])
    nxt=ARTICLES[(idx+1)%len(ARTICLES)]
    ld=json.dumps({"@context":"https://schema.org","@type":"Article","headline":a['t'],"description":a['dek'],"inLanguage":"it-IT",
      "datePublished":"2026-11-28","dateModified":"2026-11-28","url":url,"mainEntityOfPage":url,
      "author":{"@type":"Organization","name":"Redazione ARIA"},"publisher":{"@type":"Organization","name":"ZDOS1.3","url":"https://x-zdos.it/"},
      "isPartOf":{"@id":BASE+"#periodical"},"image":BASE+"og.jpg","audience":{"@type":"PeopleAudience","requiredMinAge":18},"isFamilyFriendly":False},ensure_ascii=False)
    return f'''<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(a['t'])} · ARIA, rivista digitale 18+</title>
<meta name="description" content="{e(a['dek'],quote=True)}">
<link rel="canonical" href="{url}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="rating" content="adult"><meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
<meta name="theme-color" content="#070112">
<meta property="og:type" content="article"><meta property="og:title" content="{e(a['t'],quote=True)}"><meta property="og:description" content="{e(a['dek'],quote=True)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}og.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="../../style.css">
<script type="application/ld+json">{ld}</script></head><body class="art">
<div id="gate" class="gate" role="dialog" aria-modal="true" aria-labelledby="gt" hidden><div class="gate-box"><p class="kick">ARIA · Numero 1</p><h2 id="gt">Solo per maggiorenni</h2><p>Contenuti per adulti su naturismo e vita libertina, senza immagini esplicite. Riservati a chi ha <strong>18 anni o più</strong>.</p><div class="gate-btns"><button id="gate-yes" class="btn">Ho 18 anni o più · Entra</button><a class="btn ghost" href="https://x-zdos.it/">Esci</a></div></div></div>
<header class="top"><div class="wrap bar"><a class="brand" href="../../"><span class="dot"></span>ARIA<small>18+</small></a><nav class="nav"><a href="../../#indice">Indice</a><a href="../../#naturismo">Naturismo</a><a href="../../#testate">Testate</a><a href="../../#prenota">Prenota</a><a href="../../#gruppo" class="pill">Unisciti</a></nav></div></header>
<main class="wrap article"><p class="kick">{e(a['sec'])} · Numero 1 · <time datetime="2026-11-28">28 novembre 2026</time> · {a['min']} min di lettura</p>
<h1 class="at">{e(a['t'])}</h1><p class="lead">{e(a['dek'])}</p>
<div class="prose">{body}</div>
<aside class="srcs"><h3>Fonti</h3><ul>{srcs}</ul><p class="tiny">Link controllati il {VERIF}. Testo originale della redazione ARIA.</p></aside>
<nav class="next"><a href="../../#indice">← Indice del numero</a><a href="../{nxt['slug']}/">Prossimo: {e(nxt['t'])} →</a></nav></main>
<footer class="foot"><div class="wrap"><p><strong>ARIA</strong> · rivista digitale 18+ · Editore ZDOS1.3 · <a href="../../">Torna al numero</a> · <a href="https://zx.x-zdos.it/">Z-X Store</a></p><p class="tiny">Informazione generale, non consulenza legale o sanitaria. Solo maggiorenni, consenso sempre, parola di stop ROSSO.</p></div></footer>
<script src="../../app.js" defer></script></body></html>'''

def feed():
    items="".join(f"<item><title>{e(a['t'])}</title><link>{BASE}articoli/{a['slug']}/</link><guid>{BASE}articoli/{a['slug']}/</guid><pubDate>Sat, 28 Nov 2026 02:00:00 +0100</pubDate><category>{e(a['sec'])}</category><description>{e(a['dek'])}</description></item>" for a in ARTICLES)
    return f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ARIA · rivista digitale 18+</title><link>{BASE}</link><description>Naturismo, lifestyle e viaggio: luoghi reali, fonti verificate, consenso e legalità. Solo maggiorenni.</description><language>it-IT</language><lastBuildDate>Sat, 28 Nov 2026 02:00:00 +0100</lastBuildDate>{items}</channel></rss>'

def sitemap():
    urls=[BASE]+[BASE+"articoli/"+a['slug']+"/" for a in ARTICLES]
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+"".join(f"<url><loc>{u}</loc><lastmod>2026-11-28</lastmod></url>" for u in urls)+"</urlset>"

if __name__ == "__main__":
    ver = json.load(open(os.path.join(os.path.dirname(__file__), 'verified.json')))
    ok = {u: v['ok'] for u, v in ver.items()}
    counts = {'links': sum(1 for v in ver.values() if v['ok'])}
    open(os.path.join(OUT, 'index.html'), 'w').write(build(ok, counts))
    for i,a in enumerate(ARTICLES):
        d=os.path.join(OUT,'articoli',a['slug']); os.makedirs(d,exist_ok=True)
        open(os.path.join(d,'index.html'),'w').write(article_page(a,i))
    open(os.path.join(OUT,'feed.xml'),'w').write(feed())
    open(os.path.join(OUT,'sitemap.xml'),'w').write(sitemap())
    fonti={u:{"ok":v["ok"],"http":v.get("code"),"controllato":"2026-11-28"} for u,v in sorted(ver.items())}
    json.dump({"verificato_il":"2026-11-28","nota":"HTTP 2xx/3xx da VPS Contabo con curl -L; alcuni siti restituiscono pagine di controllo anti-bot (200/202).","link":fonti},open(os.path.join(OUT,'fonti.json'),'w'),ensure_ascii=False,indent=1)
    print("built", counts)
