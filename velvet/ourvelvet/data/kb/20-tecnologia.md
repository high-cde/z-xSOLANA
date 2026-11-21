# ZDOS sistema operativo
ZDOS è un sistema operativo con ISO live x86_64 (BusyBox, kernel Debian 6.1). Build e selftest 25/25 OK. Avvio solo BIOS. L'installer su disco reale non è stato ancora provato: non installarlo su un disco con dati importanti.

# Zlang
Zlang (ZLang) è il linguaggio di programmazione di ZDOS: compilatore zlangc, bytecode ZLB2, VM e CLI. Esiste un IDE web in stile Remix su https://x-zdos.it/ide con compilatore in JavaScript e compilatore/VM Rust in WebAssembly. Zlang oggi è un linguaggio minimale: non genera programmi Solana.
Zlang by ZDOS è il marchio con cui ZDOS1.3 presenta la collaborazione tecnica che ha costruito OurVelvet.

# zRoute e K.I.R.A.
zRoute confronta le quotazioni di swap su Solana tramite Jupiter, fa i controlli di sicurezza K.I.R.A. (con RugCheck) sul token e firma solo nel wallet Phantom dell'utente. Zero commissioni aggiunte.
K.I.R.A. è il controllo di sicurezza dei token Solana: autorità di mint e freeze, liquidità, segnali di rischio. Su Discord: /kira <mint>. Informativo, non è consulenza finanziaria.

# Æsir
Æsir è il policy engine in Rust che fa da gate con $DSN su Polygon e Solana.
