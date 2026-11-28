// zbus · client unico per pubblicare eventi sul bus zcomm (HMAC). Uso:
//   import { publish } from "/opt/zdos-filiera/zbus.mjs";
//   await publish({ key: "zpool:snap:2026-11-28T02", type: "service_health", source: "zpool", data: { ok: true } });
// Tipi e sorgenti ammessi: vedi EVENT_TYPES / SOURCES in /opt/zcomm/lib.mjs. Solo da 127.0.0.1.
import fs from "node:fs"; import crypto from "node:crypto";
const KEY = () => fs.readFileSync(process.env.ZCOMM_KEY_FILE || "/etc/zcomm/hmac.key", "utf8").trim();
export async function publish(ev) {
  const body = JSON.stringify(ev); const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", KEY()).update(ts + "." + body).digest("hex");
  const r = await fetch("http://127.0.0.1:4192/zcomm/api/events", { method: "POST", headers: { "content-type": "application/json", "x-zcomm-ts": String(ts), "x-zcomm-signature": sig }, body });
  return r.json();
}
