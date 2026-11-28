
  // --- ZDOS MINER · radice Merkle delle prove di lavoro (solo locale, firma HMAC zcomm) ---
  if (req.method === "POST" && url.pathname === "/api/vchain/work-root") {
    const rip = req.socket.remoteAddress || "";
    if (!(rip === "127.0.0.1" || rip === "::1" || rip === "::ffff:127.0.0.1") || req.headers["x-real-ip"] || req.headers["x-forwarded-for"]) return sendJson(res, 403, { ok: false, error: "solo locale" });
    let body = ""; req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      try {
        const key = fs.readFileSync("/etc/zcomm/hmac.key", "utf8").trim();
        const ts = Number(req.headers["x-zcomm-ts"]); const sig = String(req.headers["x-zcomm-signature"] || "");
        const exp = crypto.createHmac("sha256", key).update(String(ts) + "." + body).digest("hex");
        if (!/^[0-9a-f]{64}$/.test(sig) || Math.abs(Date.now() / 1000 - ts) > 300 || !crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(exp, "hex"))) return sendJson(res, 401, { ok: false, error: "firma non valida" });
        const p = JSON.parse(body);
        if (p.type !== "ZMINER_WORK_ROOT" || !/^[0-9a-f]{64}$/.test(p.merkleRoot || "")) return sendJson(res, 400, { ok: false, error: "payload non valido" });
        const prev = ledger.blocks[ledger.blocks.length - 1];
        const last = [...ledger.blocks].reverse().find((b) => b.tx && b.tx.type === "ZMINER_WORK_ROOT");
        if (last && Date.now() - Date.parse(last.timestamp) < 55 * 60 * 1000) return sendJson(res, 429, { ok: false, error: "una radice all'ora al massimo" });
        const height = prev.height + 1; const timestamp = new Date().toISOString();
        const tx = { type: "ZMINER_WORK_ROOT", merkleRoot: p.merkleRoot, head: String(p.head || "").slice(0, 64), fromN: +p.fromN, toN: +p.toN, count: +p.count,
          workPoints: +p.workPoints, jobs: p.jobs || {}, from: +p.from, to: +p.to, rail: "zminer", vm: "ZLang + Solana SPL", note: "prove di lavoro ZDOS Miner: nessun token emesso" };
        const hash = sha256(JSON.stringify({ height, timestamp, prevHash: prev.hash, tx }));
        const block = { height, timestamp, prevHash: prev.hash, tx, hash };
        ledger.blocks.push(block); saveLedger();
        return sendJson(res, 200, { ok: true, block });
      } catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
    });
    return;
  }
