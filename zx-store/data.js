/* Dati statici del prototipo (nessun prezzo). slug = pagina paese Airalo verificata con curl per alcuni paesi (japan, united-states, united-kingdom, thailand, italy). */
window.ZX_COUNTRIES = [
  ["IT","Italia","italy","EUR"],["PT","Portogallo","portugal","EUR"],["ES","Spagna","spain","EUR"],["FR","Francia","france","EUR"],
  ["DE","Germania","germany","EUR"],["GR","Grecia","greece","EUR"],["NL","Paesi Bassi","netherlands","EUR"],["GB","Regno Unito","united-kingdom","GBP"],
  ["CH","Svizzera","switzerland","CHF"],["US","Stati Uniti","united-states","USD"],["CA","Canada","canada","CAD"],["MX","Messico","mexico","MXN"],
  ["BR","Brasile","brazil","BRL"],["JP","Giappone","japan","JPY"],["KR","Corea del Sud","south-korea","KRW"],["TH","Thailandia","thailand","THB"],
  ["ID","Indonesia","indonesia","IDR"],["AE","Emirati Arabi Uniti","united-arab-emirates","AED"],["TR","Turchia","turkey","TRY"],["EG","Egitto","egypt","EGP"],
  ["MA","Marocco","morocco","MAD"],["AU","Australia","australia","AUD"],["IN","India","india","INR"],["CN","Cina","china","CNY"],
  ["SG","Singapore","singapore","SGD"],["VN","Vietnam","vietnam","VND"],["PH","Filippine","philippines","PHP"],["ZA","Sudafrica","south-africa","ZAR"],
  ["CZ","Repubblica Ceca","czech-republic","CZK"],["PL","Polonia","poland","PLN"],["HU","Ungheria","hungary","HUF"],["HR","Croazia","croatia","EUR"]
];
window.ZX_BRANDS = { // marchi spesso imitati nel phishing di viaggi e crypto → domini ufficiali (registrabili)
  airbnb:["airbnb.com","airbnb.it"], booking:["booking.com"], phantom:["phantom.app","phantom.com"], solana:["solana.com"],
  jupiter:["jup.ag"], skyscanner:["skyscanner.it","skyscanner.net","skyscanner.com"], airalo:["airalo.com"], paypal:["paypal.com"]
};
window.ZX_OFFICIAL = {
  domains: ["x-zdos.it"],            // + qualsiasi sottodominio (swap., quest., zdesk., api.)
  brandLabels: ["xzdos","zdos"],     // usati per riconoscere i sosia
  addresses: {                        // indirizzi pubblici ufficiali (solo mint, mai wallet personali)
    "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4": "$DSN ufficiale (mint Solana, Token-2022)",
    "0xfc90516a1f736FaC557e09D8853dB80dA192c296": "$DSN ufficiale (Polygon)",
    "0xFC90516A1F736FaC557e09D8853dB80dA192c296": "$DSN ufficiale (Polygon)",
    "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump": "VELVET $OV (mint Solana)",
    "EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump": "xZDOS legacy (NON è $DSN)"
  }
};
