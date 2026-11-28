// Test locale: byte del messaggio SIWS + verifica ed25519 con keypair usa-e-getta (cancellata in finally).
// Non stampa chiavi. Nessun wallet reale.
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "node:crypto";

const STATEMENT = "ZDOS Firma v1 - Accesso con wallet. Questa firma non e una transazione: non muove fondi e non autorizza alcuna spesa.";
const LEGACY = "ZDOS Firma v1 · Accesso con wallet. Questa firma non è una transazione: non muove fondi e non autorizza alcuna spesa.";

function buildMessage(f) {
  return `${f.domain} wants you to sign in with your Solana account:\n${f.address}\n\n${f.statement}\n\n` +
    `URI: ${f.uri}\nVersion: ${f.version}\nChain ID: ${f.chainId}\nNonce: ${f.nonce}\n` +
    `Issued At: ${f.issuedAt}\nExpiration Time: ${f.expirationTime}`;
}
const isAsciiLine = (s) => typeof s === "string" && s.length > 0 && !/[^\x20-\x7E]/.test(s);
const isAsciiMsg = (s) => typeof s === "string" && !/[^\x20-\x7E\n]/.test(s);

let pass = 0, fail = 0, kp;
const t = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  → " + extra : "")); };

try {
  kp = nacl.sign.keyPair();
  const addr = bs58.encode(kp.publicKey);
  const f = {
    domain: "x-zdos.it",
    address: addr,
    statement: STATEMENT,
    uri: "https://x-zdos.it/",
    version: "1",
    chainId: "mainnet",
    nonce: "a".repeat(32),
    issuedAt: "2026-11-28T20:00:00.000Z",
    expirationTime: "2026-11-28T20:05:00.000Z",
  };
  const msg = buildMessage(f);
  const bytes = new TextEncoder().encode(msg);

  t("statement nuovo è ASCII stampabile", isAsciiLine(STATEMENT));
  t("statement legacy (quello che Phantom rifiuta) NON è ASCII", !isAsciiLine(LEGACY), "non-ascii attesi: · e è");
  t("messaggio nuovo è ASCII + LF", isAsciiMsg(msg));
  t("nessun caratteri oltre Latin-1 accidentali nel messaggio nuovo", [...msg].every((c) => c === "\n" || (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)));
  t("signMessage riceve Uint8Array utf8, non una stringa", bytes instanceof Uint8Array && bytes.length === Buffer.byteLength(msg, "utf8"));
  t("TextDecoder(bytes) === messaggio", new TextDecoder().decode(bytes) === msg);
  t("messaggio non eccessivamente lungo", bytes.length < 800, "len " + bytes.length);
  t("una sola riga di statement (nessun LF interno)", !STATEMENT.includes("\n"));

  const sig = nacl.sign.detached(bytes, kp.secretKey);
  t("firma ed25519 64 byte", sig.length === 64);
  t("verifica ed25519 OK sul messaggio utf8", nacl.sign.detached.verify(bytes, sig, kp.publicKey) === true);
  const tampered = new Uint8Array(bytes); tampered[10] ^= 1;
  t("verifica fallisce se i byte del messaggio cambiano", nacl.sign.detached.verify(tampered, sig, kp.publicKey) === false);
  const legacyMsg = buildMessage({ ...f, statement: LEGACY });
  t("lo stesso schema con statement legacy ha byte diversi (non ASCII)", new TextEncoder().encode(legacyMsg).some((b) => b > 127));
  // /api/firma/check accetta anche il messaggio legacy, ma Phantom non lo mostra: confermiamo solo la firma crittografica
  const sigL = nacl.sign.detached(new TextEncoder().encode(legacyMsg), kp.secretKey);
  t("firma sul messaggio legacy è comunque verificabile crittograficamente", nacl.sign.detached.verify(new TextEncoder().encode(legacyMsg), sigL, kp.publicKey));

  // hash pubblico solo per ancorare il test, mai la chiave
  t("pubkey 32 byte", kp.publicKey.length === 32, "sha256(pub)=" + createHash("sha256").update(kp.publicKey).digest("hex").slice(0, 12));
} finally {
  if (kp) {
    if (kp.secretKey) kp.secretKey.fill(0);
    if (kp.publicKey) kp.publicKey.fill(0);
    kp = null;
  }
}
console.log(`\nRisultato: ${pass} ok, ${fail} falliti`);
process.exit(fail ? 1 : 0);
