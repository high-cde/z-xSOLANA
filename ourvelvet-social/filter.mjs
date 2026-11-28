// Filtro testo OurVelvet Social: solo adulti, solo consenso. © 2026 ZDOS1.3
// Blocca riferimenti a minori, "teen", "step", non consenso e violenza non consensuale.
// Il testo viene normalizzato (minuscolo, senza accenti, leetspeak, separatori) prima del controllo.
const RULES = [
  /\bminor\w*/, /\bminorenn\w*/, /\bbambin\w*/, /\bragazzin\w*/, /\bteen\w*/, /\bpre ?teen\w*/, /\btween\w*/,
  /\blolit\w*/, /\bloli\b/, /\bshota\w*/, /\bjail ?bait/, /\bunder ?age\w*/, /\bunder ?18\b/, /\bsotto ?eta\b/, /\bsotto ?i ?18\b/,
  /\binfant\w*/, /\bchild\w*/, /\bkids?\b/, /\bbimb\w*/, /\bscolar\w*/, /\bschool ?girl\w*/, /\bschool ?boy\w*/, /\bstudentess\w*/, /\bliceal\w*/,
  /\badolescen\w*/, /\bpedo\w*/, /\bpaedo\w*/, /\bcp\b/,
  /\bstep\w*/, /\bpatrign\w*/, /\bmatrign\w*/, /\bfigliast\w*/, /\bfratellast\w*/, /\bsorellast\w*/, /\bincest\w*/,
  /\bstupr\w*/, /\brape\w*/, /\braping\b/, /\bforzat\w*/, /\bforced\b/, /\bnon ?consensual\w*/, /\bnon ?consenzien\w*/, /\bnoncon\b/, /\bcnc\b/,
  /\bsenza ?(il ?)?consenso\b/, /\bwithout ?consent\b/, /\bcontro ?(la ?sua|la ?propria) ?volonta\b/, /\bdrogat\w*/, /\bdrugged\b/, /\bpriva ?di ?sensi\b/, /\bunconscious\b/,
  /\bsnuff\b/, /\bviolenz\w* ?(sessual\w*|non ?consensual\w*)/, /\babus\w* ?sessual\w*/, /\bsexual ?assault\w*/, /\bmolest\w*/,
  /\b(1[0-7]|[1-9]) ?(anni|anno|years?|yrs?|yo|y ?o|enne)\b/, /\b(dodici|tredici|quattordici|quindici|sedici|diciassette)enne\b/, /\b(twelve|thirteen|fourteen|fifteen|sixteen|seventeen) ?(years?|yo)\b/,
];
export function normalize(t) {
  return String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/\$|5/g, "s").replace(/7/g, "t")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\b([a-z]) (?=[a-z]\b)/g, "$1").replace(/\s+/g, " ").trim();
}
// Versione con le cifre originali per le regole sull'età (il leetspeak trasformerebbe "17" in "it").
function normDigits(t) { return String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
export function check(text) {
  const a = normalize(text), b = normDigits(text);
  for (const r of RULES) if (r.test(a) || r.test(b)) return { ok: false, motivo: "Il testo contiene un termine non ammesso (minori, «teen», legami «step», non consenso o violenza non consensuale). Qui solo adulti e consenso." };
  return { ok: true };
}
