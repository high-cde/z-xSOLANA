# -*- coding: utf-8 -*-
# Dati ARIA · tutte le voci derivano da fonti pubbliche citate (vedi "src").
FEN = "https://fenait.org/luoghi-naturisti"
FENC = "https://fenait.org/centri-naturisti"
FENA = "https://fenait.org/associazioni-federate"

BEACHES = [
 # nome, luogo, provincia, regione
 ("Spiaggia fluviale del Sesia (Balangera)","Varallo Sesia","VC","Piemonte"),
 ("Spiaggia fluviale del Trebbia","Secchiello","PC","Emilia-Romagna"),
 ("Lido di Volano","Comacchio","FE","Emilia-Romagna"),
 ("Spiaggia della Bassona","Lido di Dante","RA","Emilia-Romagna"),
 ("Spiaggia della Lecciona","Viareggio","LU","Toscana"),
 ("Punta Combara","Livorno","LI","Toscana"),
 ("Nido dell’Aquila","San Vincenzo","LI","Toscana"),
 ("Punta del Miglio","Sassoscritto","LI","Toscana"),
 ("Spiaggia delle Tombe","Campo nell’Elba","LI","Toscana"),
 ("Spiaggia di Acquarilli","Isola d’Elba","LI","Toscana"),
 ("Lido Punta Le Morge","Torino di Sangro","CH","Abruzzo"),
 ("Sabbie Nere","Santa Marinella","RM","Lazio"),
 ("Spiaggia di Focene","Fiumicino","RM","Lazio"),
 ("Oasi naturista di Capocotta","Lido di Ostia","RM","Lazio"),
 ("Spiaggia della Termitosa","Castellaneta","TA","Puglia"),
 ("Spiaggia del Troncone","Marina di Camerota","SA","Campania"),
 ("Stignano","Stignano","RC","Calabria"),
 ("San Saba – Rasocolmo","Messina","ME","Sicilia"),
 ("Spiaggia di Bulala","Gela","CL","Sicilia"),
 ("Porto Ferro","Porto Ferro","SS","Sardegna"),
 ("Baia delle Ninfe","Alghero","SS","Sardegna"),
 ("Is Benas","San Vero Milis","OR","Sardegna"),
 ("Piscinas","Arbus","SU","Sardegna"),
 ("Feraxi","Muravera","SU","Sardegna"),
]

# Centri naturisti certificati INF-FENAIT (fenait.org/centri-naturisti)
CENTRES = [
 dict(n="Camping Classe FKK",p="Lido di Dante (RA)",r="Emilia-Romagna",k="Campeggio",u="https://www.campingclassefkk.it",s="/centro-naturista/3-CAMPING CLASSE FKK"),
 dict(n="Cà Le Scope Camping Naturista",p="Marzabotto (BO)",r="Emilia-Romagna",k="Campeggio",u="http://www.calescope.com/",s="/centro-naturista/5-CÀ LE SCOPE CAMPING NATURISTA"),
 dict(n="Il Costalunga",p="Sassello (SV)",r="Liguria",k="Campeggio",u="http://www.costalunga.org/",s="/centro-naturista/13-IL COSTALUNGA CAMPEGGIO NATURISTA"),
 dict(n="Casale del Valla",p="Spigno Monferrato (AL)",r="Piemonte",k="B&B",u="https://casaledelvalla.com",s="/centro-naturista/15-CASALE DEL VALLA - B&B NATURISTA"),
 dict(n="Ad Naturam · spazio 3Venat",p="Noale (VE)",r="Veneto",k="Spazio naturista",u="https://www.3venat.it/ad-naturam",s="/centro-naturista/16-AD NATURAM – SPAZIO NATURISTA 3VENAT "),
 dict(n="B&B Borgo Corniola",p="Marradi (FI)",r="Toscana",k="B&B",u="https://www.borgocorniola.com",s="/centro-naturista/6-B&B BORGO CORNIOLA"),
 dict(n="BNatural Naturism & Glamping",p="Piombino (LI)",r="Toscana",k="Glamping",u="http://www.bnaturalglamping.it",s="/centro-naturista/7-BNATURAL NATURISM & GLAMPING"),
 dict(n="Ecocampeggio Sasso Corbo",p="Semproniano (GR)",r="Toscana",k="Campeggio",u="http://www.sassocorbo.com",s="/centro-naturista/8-ECOCAMPEGGIO SASSO CORBO"),
 dict(n="Suncave Garden Naturist",p="Bracciano (RM)",r="Lazio",k="Giardino naturista",u="https://www.suncavegardens.it",s="/centro-naturista/9-SUNCAVE GARDEN NATURIST"),
 dict(n="Casa Vacanze La Sorgente",p="Catignano (PE)",r="Abruzzo",k="Casa vacanze",u="https://www.casasorgente-naturismo.it",s="/centro-naturista/4-CASA VACANZE LA SORGENTE"),
 dict(n="Resort Naturista Grottamiranda",p="Carovigno (BR)",r="Puglia",k="Resort",u="https://www.resort-naturista-grottamiranda.com",s="/centro-naturista/12-RESORT NATURISTA GROTTAMIRANDA"),
 dict(n="Pizzo Greco Campeggio Naturista",p="Isola di Capo Rizzuto (KR)",r="Calabria",k="Campeggio",u="http://pizzogreco.com",s="/centro-naturista/2-PIZZO GRECO CAMPEGGIO NATURISTA"),
 dict(n="Club Le Peonie",p="Dorgali (NU)",r="Sardegna",k="Hotel / sito naturista",u="http://www.clublepeoniesardegna.it",s="/centro-naturista/11-CLUB LE PEONIE"),
]

ASSOC = [
 dict(n="FENAIT · Federazione Naturista Italiana",p="Italia",u="https://fenait.org/",note="Federazione nazionale, associata a INF-FNI. Elenca spiagge, centri e associazioni."),
 dict(n="INF-FNI · International Naturist Federation",p="Internazionale",u="https://inf-fni.org/",note="Federazione internazionale; calendario eventi e tessera INF."),
 dict(n="A.N.ITA. · Associazione Naturista Italiana",p="Italia",u="http://www.naturismoanita.it",note="APS dal 1966, federata FENAIT."),
 dict(n="A.N.A.B. · Associazione Naturista Abruzzese",p="Abruzzo",u="https://www.abruzzonaturista.it",note="Mappa aggiornata di spiagge e strutture italiane."),
 dict(n="UNAIT · Unione Naturisti Ambiente Italia",p="Lazio",u="https://www.unait.org",note="Associazione dei naturisti del Lazio."),
 dict(n="3Venat · Tre Venezie Naturista",p="Triveneto",u="https://www.3venat.it/",note="Associazione federata FENAIT."),
 dict(n="ANAA-SFKK · Naturisti Alto Adige",p="Alto Adige",u="https://naturismoanaa-fkk.org",note="Associazione federata FENAIT."),
 dict(n="Liburnia · Associazione Naturista Umanista",p="Friuli-Venezia Giulia",u="http://www.liburniats.org",note="Associazione federata FENAIT."),
]

EU_NAT = [
 dict(n="FKK Valalta",p="Rovinj, Croazia",u="https://www.valalta.hr/en/",src="Sito ufficiale",su="https://www.valalta.hr/en/",note="Campeggio naturista; stagione 2027 dall’1 maggio al 30 settembre. Il sito precisa che in loco non si prenotano le piazzole."),
 dict(n="Koversada Uncovered Naturist Campsite",p="Vrsar, Croazia",u="https://www.maistra.com/properties/koversada-park-camping-resort/koversada-uncovered-naturist-campsite/",src="Maistra (sito ufficiale)",su="https://www.maistra.com/properties/koversada-park-camping-resort/koversada-uncovered-naturist-campsite/",note="Naturista dal 1961; stagione 2027 dal 23 aprile al 10 ottobre."),
 dict(n="Camping Solaris",p="Poreč (Lanterna), Croazia",u="https://www.valamarcamping.com/solaris-naturist-resort-porec",src="Valamar (sito ufficiale)",su="https://www.valamarcamping.com/solaris-naturist-resort-porec",note="Resort naturista con 2,5 km di costa, piazzole e appartamenti."),
 dict(n="Euronat",p="Gironde, Francia",u="https://www.euronat.com/",src="Sito ufficiale",su="https://www.euronat.com/",note="Centro vacanze naturista sull’Atlantico."),
 dict(n="Vritomartis Naturist Resort",p="Creta, Grecia",u="https://www.vritomartis.com/",src="Sito ufficiale",su="https://www.vritomartis.com/",note="Resort naturista sull’isola di Creta."),
 dict(n="Costa Natura",p="Estepona (Málaga), Spagna",u="https://costanatura.com/",src="Sito ufficiale",su="https://costanatura.com/",note="Resort naturista sulla Costa del Sol; sede dell’EuNat Meeting 2025 (fonte FENAIT)."),
]

EU_FED = [
 dict(n="FFN · Fédération Française de Naturisme",p="Francia",u="https://ffn-naturisme.com/"),
 dict(n="DFK · Deutscher Verband für Freikörperkultur",p="Germania",u="https://www.dfk.org/"),
 dict(n="DNH · Društvo naturista Hrvatske",p="Croazia",u="https://www.dnh.hr/"),
 dict(n="British Naturism",p="Regno Unito",u="https://bn.org.uk/"),
]

CLUBS = [
 dict(n="Bad Romance",p="Roma · Testaccio",u="https://badromanceclub.com/",src="Sito ufficiale · eventi",su="https://badromanceclub.com/ita_eventi/",note="Piccolo club privé per coppie e donne single; riservato ai soci 21+, tesseramento in sede con documento d’identità."),
 dict(n="Olimpo Club Privé",p="Ladispoli (RM)",u="https://www.olimpoclub.com/",src="Sito ufficiale",su="https://www.olimpoclub.com/",note="Club privato per soci maggiorenni, aperto giovedì, venerdì e sabato. Dichiara: consenso e rispetto sempre, niente telefoni né fotocamere in sala."),
 dict(n="Infinito Club Privé",p="Melzo (MI)",u="https://www.infinitoclubmilano.com/",src="Sito ufficiale",su="https://www.infinitoclubmilano.com/",note="Club alle porte di Milano con sala da ballo e bar; serate a tema su prenotazione, informazioni sul sito."),
 dict(n="Club Privé Milano 369",p="Carnate (MB) · Brianza",u="https://www.club369milano.it/",src="Sito ufficiale · eventi",su="https://www.club369milano.it/eventi/",note="Club per coppie e single, serate a tema per un pubblico adulto."),
 dict(n="Oops Barcelona",p="Barcellona, Spagna",u="https://oops.barcelona/en/",src="Sito ufficiale",su="https://oops.barcelona/en/",note="Club social per coppie nella parte alta della città."),
 dict(n="Le Tantra",p="Cap d’Agde, Francia",u="https://tantraclub.fr/",src="Sito ufficiale",su="https://tantraclub.fr/",note="Club libertin situato nel Village Naturiste di Cap d’Agde."),
]

EVENTS = [
 dict(d="2026-12-30",lab="30 dic 2026",t="Il brindisi di fine anno",w="Bad Romance · Roma",note="Serata per soci 21+ e per chi vuole conoscere il club; apertura 22:30. Il 31 dicembre il club resta chiuso.",src="badromanceclub.com · eventi",su="https://badromanceclub.com/ita_eventi/"),
 dict(d="2026-12-31",lab="31 dic 2026",t="Capodanno 2027",w="Club Privé Milano 369 · Carnate (MB)",note="Serata di Capodanno, ore 20:30 secondo il calendario del club.",src="club369milano.it · eventi",su="https://www.club369milano.it/eventi/"),
 dict(d="2027-01-02",lab="2 gen 2027",t="After party di Capodanno",w="Infinito Club · Melzo (MI)",note="Evento in calendario sul sito del club; informazioni e prenotazioni dai contatti ufficiali.",src="infinitoclubmilano.com",su="https://www.infinitoclubmilano.com/"),
 dict(d="2027-04-23",lab="23 apr 2027",t="Apertura stagione 2027",w="Koversada Uncovered Naturist · Vrsar (HR)",note="Apertura dal 23 aprile al 10 ottobre 2027.",src="Maistra",su="https://www.maistra.com/properties/koversada-park-camping-resort/koversada-uncovered-naturist-campsite/"),
 dict(d="2027-04-24",lab="24 apr 2027",t="International Naturist Indoor Beach Volleyball Tournament",w="Sand Fabrik · Parigi",note="Torneo organizzato dalla Federazione Francese di Naturismo.",src="events.inf-fni.org",su="https://events.inf-fni.org/calendar/"),
 dict(d="2027-05-01",lab="1 mag 2027",t="Apertura stagione 2027",w="FKK Valalta · Rovinj (HR)",note="Aperto dall’1 maggio al 30 settembre 2027.",src="valalta.hr",su="https://www.valalta.hr/en/"),
 dict(d="2027-06-06",lab="6 giu 2027",t="Giornata Mondiale del Naturismo (emisfero nord)",w="Ovunque · federazioni e centri",note="Tradizionalmente la prima domenica di giugno; le federazioni possono organizzare eventi dall’1 all’8 giugno.",src="inf-fni.org · World Naturist Day",su="https://inf-fni.org/world_naturist_day/"),
 dict(d="2027-07-31",lab="31 lug 2027",t="18° Internationaler Naturistenlauf",w="FKK Camping Ostsee · Germania",note="Corsa naturista internazionale, dalle 11:00 alle 18:00.",src="dfk.org · eventi",su="https://www.dfk.org/veranstaltungen/2718752/2027/07/31/18.-internationaler-naturistenlauf"),
]

# Hub di viaggio: nome, booking ss, airbnb slug, booking cars path, discovercars slug, zone collegate
HUBS = [
 ("Roma · Ostia · Fiumicino","Roma, Lazio, Italia","Roma--Italia","it/rome","italy-mainland","Capocotta, Focene, Sabbie Nere, Bad Romance, Olimpo"),
 ("Milano e Brianza","Milano, Lombardia, Italia","Milano--Italia","it/milan","italy-mainland","Infinito, Club 369"),
 ("Ravenna · Bologna","Ravenna, Emilia-Romagna, Italia","Ravenna--Italia","it/bologna","italy-mainland","Bassona, Camping Classe, Cà Le Scope, Lido di Volano"),
 ("Toscana · Etruria · Elba","Piombino, Toscana, Italia","Piombino--Italia","it/pisa","italy-mainland","Lecciona, Elba, BNatural, Sasso Corbo, Borgo Corniola"),
 ("Genova · Liguria","Genova, Liguria, Italia","Genova--Italia","it/genoa","italy-mainland","Il Costalunga"),
 ("Torino · Monferrato","Torino, Piemonte, Italia","Torino--Italia","it/turin","italy-mainland","Casale del Valla, Varallo Sesia"),
 ("Venezia · Veneto","Venezia, Veneto, Italia","Venezia--Italia","it/venice","italy-mainland","Ad Naturam (Noale)"),
 ("Abruzzo · Pescara","Pescara, Abruzzo, Italia","Pescara--Italia","it/pescara","italy-mainland","Punta Le Morge, La Sorgente"),
 ("Puglia · Brindisi","Brindisi, Puglia, Italia","Brindisi--Italia","it/brindisi","italy-mainland","Grottamiranda, Termitosa"),
 ("Calabria · Lamezia","Lamezia Terme, Calabria, Italia","Lamezia-Terme--Italia","it/lamezia-terme","italy-mainland","Pizzo Greco, Stignano"),
 ("Sardegna nord · Olbia","Olbia, Sardegna, Italia","Olbia--Italia","it/olbia","italy-sardinia","Club Le Peonie, Baia delle Ninfe, Porto Ferro"),
 ("Sardegna sud · Cagliari","Cagliari, Sardegna, Italia","Cagliari--Italia","it/cagliari","italy-sardinia","Piscinas, Feraxi, Is Benas"),
 ("Sicilia · Catania · Palermo","Catania, Sicilia, Italia","Catania--Italia","it/catania","italy-sicily","San Saba, Bulala"),
 ("Istria · Croazia","Pula, Croazia","Pola--Croazia","hr/pula","croatia","Valalta, Koversada, Solaris"),
 ("Cap d’Agde · Occitania","Cap d'Agde, Francia","Cap-d'Agde--Francia","fr/montpellier","france","Village Naturiste, Le Tantra"),
 ("Gironda · Atlantico","Bordeaux, Francia","Bordeaux--Francia","fr/bordeaux","france","Euronat"),
 ("Costa del Sol","Málaga, Spagna","Malaga--Spagna","es/malaga","spain","Costa Natura"),
 ("Barcellona","Barcellona, Spagna","Barcellona--Spagna","es/barcelona","spain","Oops Barcelona"),
 ("Creta","Heraklion, Grecia","Heraklion--Grecia","gr/heraklion","greece-crete","Vritomartis"),
]
