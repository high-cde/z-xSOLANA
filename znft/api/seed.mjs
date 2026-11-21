// Seed della collezione di esempio: opere ASTRATTE dichiarate "opera di esempio", mintate su devnet e intestate alla piattaforma.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
process.env.ZNFT_NO_LISTEN = "1";
const { internals: I } = await import("./server.mjs");
const dir = process.argv[2]; const done = I.q1("SELECT COUNT(*) n FROM works WHERE example=1").n; if (done) { console.log("seed già fatto:", done); process.exit(0); }
I.run("INSERT OR IGNORE INTO artists(wallet,nick,bio,created) VALUES(?,?,?,?)", I.chain.platform, "Studio esempio ZDOS", "Opere astratte generate per mostrare la galleria. Non sono opere di artisti reali.", new Date().toISOString());
const col = I.ensureCollection("Collezione di esempio", I.chain.platform, 1);
I.run("UPDATE collections SET description=? WHERE id=?", "Sei opere astratte di prova. Servono a mostrare certificati, annunci e acquisti in Velvet Pay su devnet.", col.id);
const titles = ["Velluto I", "Soglia Rossa", "Eco Viola", "Trama di Seta", "Battito Notturno", "Rosso Silenzio"];
const tech = ["vettoriale generativo", "linee generative", "forme generative"];
for (let i = 0; i < 6; i++) {
  const file = path.join(dir, `esempio-${i + 1}.svg`); const buf = fs.readFileSync(file); const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const name = `esempio-${i + 1}-${sha.slice(0, 8)}.svg`; fs.copyFileSync(file, path.join(I.CFG.data, "previews", name));
  const title = titles[i] + " · esempio"; const slug = I.uniqueWorkSlug(title);
  const id = Number(I.run(`INSERT INTO works(slug,collection_id,artist,title,technique,year,description,sha256,people,status,example,preview,preview_type,artist_msg,artist_sig,royalty_bps,owner,created,updated)
    VALUES(?,?,?,?,?,?,?,?,0,'esempio',1,?,?,?,?,0,?,?,?)`, slug, col.id, I.chain.platform, title, tech[i % 3], "2026",
    "Opera astratta di esempio, senza persone ritratte. Serve solo a provare la galleria su devnet.", sha, name, "image/svg+xml", "seed piattaforma", "esempio-piattaforma",
    I.chain.platform, new Date().toISOString(), new Date().toISOString()).lastInsertRowid);
  const w = I.q1("SELECT * FROM works WHERE id=?", id); const rr = I.ZR.run(I.RULES.znft_regole.bc, I.rulesInput(w));
  I.run("UPDATE works SET rules_json=? WHERE id=?", JSON.stringify({ esito: rr.esito, trace: rr.trace, sha: I.RULES.znft_regole.sha }), id);
  const m = await I.mintWork(w); console.log(title, m.asset);
  if (i < 4) { const price = [250, 400, 120, 900][i];
    I.run("INSERT INTO listings(work_id,seller,price,status,created,updated) VALUES(?,?,?,'attivo',?,?)", id, I.chain.platform, (BigInt(price) * 1000000n).toString(), new Date().toISOString(), new Date().toISOString());
    I.history(id, "annuncio", I.chain.platform, null, null, `in vendita a ${price} VPAY`); }
}
console.log("seed ok"); process.exit(0);
