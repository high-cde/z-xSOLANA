// Z-Sound · adattatore per la generazione musicale AI. © 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
// STATO PREDEFINITO: SPENTO ("in attivazione"). Si accende solo se doc scrive /etc/zdos-social/zsound-ai.json con
//   { "enabled": true, "provider": "stability" | "elevenlabs" | "selfhost", "keyFile": "/etc/zdos-social/zsound-ai.key", ... }
// e salva la chiave API nel file indicato (permessi 640 root:zdossocial). Nessuna chiave e nessun abbonamento sono inclusi.
// Nessun contenuto finto: se è spento risponde 503 e basta. L'audio generato non viene salvato sul server: torna al browser
// del creator, che poi decide se mixarlo/pubblicarlo (e passa dalla revisione staff come ogni traccia).
import fs from "node:fs";

const CFG_FILE = process.env.ZSOUND_AI_CONFIG || "/etc/zdos-social/zsound-ai.json";
const MAX_OUT = 30 * 1024 * 1024;

// Ogni provider riceve { prompt, seconds, key, cfg } e restituisce { buf, type }.
export const PROVIDERS = {
  // Stability AI · Stable Audio (API ufficiale). Testo → audio, fino a 3 min, 8 crediti ($0,08) a generazione riuscita.
  stability: {
    label: "Stability AI · Stable Audio",
    async run({ prompt, seconds, key, cfg }) {
      const f = new FormData();
      f.set("prompt", prompt); f.set("duration", String(seconds)); f.set("model", cfg.model || "stable-audio-2.5"); f.set("output_format", "mp3");
      const r = await fetch((cfg.baseUrl || "https://api.stability.ai") + "/v2beta/audio/stable-audio-2/text-to-audio", {
        method: "POST", headers: { authorization: "Bearer " + key, accept: "audio/*" }, body: f, signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw Object.assign(new Error("fornitore: HTTP " + r.status), { code: 502 });
      return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "audio/mpeg" };
    },
  },
  // ElevenLabs · Eleven Music (API ufficiale). $0,15 al minuto; uso commerciale dal piano Starter in su.
  elevenlabs: {
    label: "ElevenLabs · Eleven Music",
    async run({ prompt, seconds, key, cfg }) {
      const r = await fetch((cfg.baseUrl || "https://api.elevenlabs.io") + "/v1/music?output_format=mp3_44100_128", {
        method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ prompt, music_length_ms: seconds * 1000, force_instrumental: true, model_id: cfg.model || "music_v1" }), signal: AbortSignal.timeout(180_000) });
      if (!r.ok) throw Object.assign(new Error("fornitore: HTTP " + r.status), { code: 502 });
      return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "audio/mpeg" };
    },
  },
  // Server GPU nostro (MusicGen/Stable Audio Open/ACE-Step dietro un piccolo endpoint). Contratto: POST {baseUrl}/generate {prompt, seconds} → audio.
  selfhost: {
    label: "Server GPU ZDOS (self-hosted)",
    async run({ prompt, seconds, key, cfg }) {
      if (!cfg.baseUrl) throw Object.assign(new Error("baseUrl mancante"), { code: 500 });
      const r = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/generate", { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: "Bearer " + key } : {}) },
        body: JSON.stringify({ prompt, seconds }), signal: AbortSignal.timeout(300_000) });
      if (!r.ok) throw Object.assign(new Error("server GPU: HTTP " + r.status), { code: 502 });
      return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "audio/wav" };
    },
  },
};

export function createZsoundAi({ now }) {
  let cache = { at: 0, v: null };
  function config() {
    if (Date.now() - cache.at < 10_000) return cache.v;
    let v = { enabled: false };
    try { const c = JSON.parse(fs.readFileSync(CFG_FILE, "utf8")); if (c && c.enabled === true && PROVIDERS[c.provider]) { const key = c.keyFile ? fs.readFileSync(c.keyFile, "utf8").trim() : ""; if (key || c.provider === "selfhost") v = { ...c, key }; } } catch { /* spento */ }
    cache = { at: Date.now(), v }; return v;
  }
  let day = { d: "", n: 0 };
  const perWallet = new Map();
  async function handle(req, res, p, { me, mine, send, fail, readJson, limited, textCheck }) {
    const M = req.method, c = config();
    if (M === "GET" && p === "/api/social/zsound/ai/status") {
      return send(res, 200, c.enabled
        ? { ok: true, stato: "attivo", fornitore: PROVIDERS[c.provider].label, maxSecondi: c.maxSeconds || 30, soloStrumentale: true }
        : { ok: true, stato: "in_attivazione", messaggio: "La generazione musicale con AI è in attivazione: serve che ZDOS1.3 scelga il fornitore e inserisca la chiave. Nel frattempo Z-Sound funziona al 100% con i tuoi file e i campioni sintetici." });
    }
    if (M === "POST" && p === "/api/social/zsound/ai/generate") {
      if (!c.enabled) return send(res, 503, { ok: false, stato: "in_attivazione", errore: "Generazione AI in attivazione: non ancora disponibile." });
      if (!me || !mine) return fail(res, 401, "Accedi e crea il profilo creator per generare musica.");
      const b = await readJson(req);
      const prompt = String(b.prompt || "").trim().slice(0, 300);
      if (prompt.length < 5) return fail(res, 400, "Descrivi lo stile in almeno 5 caratteri (es. «techno scura 124 BPM, strumentale»).");
      const tc = textCheck(prompt); if (!tc.ok) return fail(res, 400, tc.motivo);
      const maxS = Math.max(5, Math.min(+c.maxSeconds || 30, 180));
      const seconds = Math.max(5, Math.min(Math.round(+b.seconds || 30), maxS));
      if (limited("zai:" + me, c.maxPerHour || 3, 3600)) return fail(res, 429, "Limite di generazioni raggiunto: riprova tra un'ora.");
      const d = new Date().toISOString().slice(0, 10); if (day.d !== d) day = { d, n: 0 };
      if (day.n >= (c.maxPerDay || 30)) return fail(res, 429, "Limite giornaliero della piattaforma raggiunto: riprova domani.");
      day.n++;
      try {
        const out = await PROVIDERS[c.provider].run({ prompt, seconds, key: c.key, cfg: c });
        if (!out.buf.length || out.buf.length > MAX_OUT) throw Object.assign(new Error("risposta non valida"), { code: 502 });
        res.writeHead(200, { "content-type": out.type, "content-length": out.buf.length, "cache-control": "no-store", "x-content-type-options": "nosniff", "x-zsound-provider": c.provider, "x-zsound-seconds": String(seconds) });
        return res.end(out.buf);
      } catch (e) { day.n--; console.error("[zsound-ai]", e.message); return fail(res, e.code === 502 ? 502 : 500, "Il fornitore AI non ha risposto: riprova più tardi."); }
    }
    return fail(res, 404, "non trovato");
  }
  return { handle, config };
}
