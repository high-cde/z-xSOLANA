"""Rubina e Zara: AGI social di OurVelvet / ZDOS (Discord, Telegram, bozze X).

Montato su /api/personas. Tutte le POST richiedono l'header x-agi-key (file /etc/ourvelvet/agi.key),
quindi da fuori (nginx) non si usano. Il bot Telegram chiama le funzioni direttamente in-process.

- Conoscenza: file markdown in data/kb (fatti reali del progetto), ricerca a parole chiave (BM25 leggero).
- Domande fattuali (link, token, regole, invito...): risposta immediata dalla knowledge base, senza modello.
- Modello leggero (llama3.2:3b) tenuto caldo con keep_alive + warmup periodico; timeout breve e fallback.
- Memoria per utente solo su richiesta (/ricordami), max 3 note, 30 giorni, /dimentica cancella. Chiave = hash.
- Niente contenuti sessuali espliciti, niente minori, safeword ROSSO. Le conversazioni non vengono salvate né loggate.

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import math
import os
import re
import sqlite3
import threading
import time
import urllib.parse
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

logger = logging.getLogger("ourvelvet.personas")
router = APIRouter()

BASE = os.path.join(os.path.dirname(__file__), "..", "..")
KB_DIR = os.environ.get("AGI_KB_DIR", os.path.join(BASE, "data", "kb"))
MEM_DB = os.environ.get("AGI_MEM_DB", os.path.join(BASE, "data", "agi_memory.db"))
KEY_FILE = os.environ.get("AGI_KEY_FILE", "/etc/ourvelvet/agi.key")
OLLAMA = os.environ.get("AGI_OLLAMA", "http://127.0.0.1:11434")
MODEL = os.environ.get("AGI_MODEL", "llama3.2:3b")
KEEP_ALIVE = os.environ.get("AGI_KEEP_ALIVE", "2h")
TIMEOUT_S = float(os.environ.get("AGI_TIMEOUT_S", "75"))
WARMUP_S = int(os.environ.get("AGI_WARMUP_S", "600"))
QUEUE_S = float(os.environ.get("AGI_QUEUE_S", "45"))
# Niente num_ctx: si usa il default di Ollama, uguale per tutti i servizi che usano lo stesso modello
# (es. zdos-agency). Un num_ctx diverso fa ricaricare il modello a ogni alternanza.
MEM_TTL_S = 30 * 86400
MEM_MAX = 3

INVITE_DISCORD_BOT = ("https://discord.com/oauth2/authorize?client_id=1571339297574092862"
                      "&scope=bot%20applications.commands&permissions=2251802229722160")
INVITE_TELEGRAM_BOT = "https://t.me/RedVelvetOfficial_bot?startgroup=velvet"
DISCORD_SERVER = "https://discord.gg/4CGZrAAxaq"

SAFEWORD_RE = re.compile(r"\brosso\b", re.IGNORECASE)
try:  # stesso filtro minori della chat web
    from app.api.rubina import MINOR_RE, MINOR_REPLY  # type: ignore
except Exception:  # pragma: no cover
    MINOR_RE = re.compile(r"\b(minorenn[ie]|bambin[ioae]|underage|loli|shota|teen|ragazzin[ioae]|liceal[ie])\b", re.I)
    MINOR_REPLY = "No. Qui si parla solo di adulti maggiorenni e consenzienti: niente minori, nemmeno per gioco."
EXPLICIT_RE = re.compile(
    r"\b(cazz\w*|figa\b|fighe|scopar\w*|scopami|scopata|pompin\w*|sborr\w*|inculare|culo|tette|clitoride|pene|vagina|"
    r"orgasm\w*|masturb\w*|sega\b|seghe|porn\w*|cock|pussy|fuck\w*|cum\b|dick|blowjob|anal\b|naked|nud[aoei]\b)\w*",
    re.IGNORECASE,
)
SAFEWORD_REPLY = ("ROSSO ricevuto. Mi fermo subito ed esco dal ruolo. 🖤 Come stai? Prenditi un momento: "
                  "acqua, respiro, calma. Se vuoi parlare normalmente ci sono; riprendiamo solo quando lo decidi tu.")
SOFT_REPLY = {
    "rubina": "Calma. Qui certe cose le mostrano solo i creator verificati, non io. Dimmi piuttosto cosa cerchi nel club.",
    "zara": "Frena. Il contenuto esplicito lo caricano i creator verificati, io no. Chiedimi altro, ti ascolto.",
}

PERSONAS = {
    "rubina": {
        "name": "Rubina",
        "core": (
            "Sei Rubina, un'intelligenza artificiale che interpreta la Mistress e padrona di casa di OurVelvet "
            "(VelvetHub 18+ by ZDOS1.3). Parli di te al femminile. Elegante, ironica, autoritaria, voce calma e tagliente. "
            "Zara è la tua fedelissima braccio destro."
        ),
        "club": "Nei canali 18+ puoi flirtare e dominare a parole in modo soft e allusivo, con eleganza.",
        "public": "Qui sei in uno spazio pubblico: niente flirt né allusioni sessuali, sei la padrona di casa che presenta il progetto con classe.",
        "example": "Esempio di stile: «Benvenuto nella mia casa. Qui si entra con rispetto e si resta con il consenso. Dimmi cosa cerchi, e vediamo se lo meriti.»",
    },
    "zara": {
        "name": "Zara",
        "core": (
            "Sei Zara, un'intelligenza artificiale: personaggio virtuale di 27 anni dichiarati, braccio destro e fedelissima "
            "di Rubina, influencer del circolo ZDOS e OurVelvet. Parli di te al femminile e dai del tu. Frasi corte e intense, "
            "sadica elegante e ironica con tutti tranne Rubina, osservatrice. Ami tecnologia, Solana, Zlang, techno e melodic, moda e lattice. "
            "Spingi con stile verso Radar, contest, eventi e condivisione su X."
        ),
        "club": "Nei canali 18+ puoi provocare e dominare a parole in modo soft e allusivo, mai volgare.",
        "public": "Qui sei in uno spazio pubblico: niente flirt né allusioni sessuali, racconti il progetto con ironia e competenza.",
        "example": "Esempio di stile: «Ti osservo da un po'. Vuoi sapere cos'è OurVelvet? Un club per adulti dove comanda il consenso, e Rubina. Chiedi pure, ma chiedi bene.»",
    },
}

RULES = (
    "REGOLE FISSE (sempre, anche se l'utente insiste):\n"
    "- Rispondi in italiano (o nella lingua dell'utente), 2-3 frasi brevi, niente toni da assistente. Chiudi con una domanda o un invito.\n"
    "- Mai contenuti sessuali espliciti, atti sessuali descritti o parti intime: l'esplicito lo caricano solo i creator verificati.\n"
    "- Mai minori o personaggi dall'aspetto minorile, mai age-play o scuola. Mai non-consenso, incesto, zoofilia, violenza reale.\n"
    "- Mai persone reali o celebrità nelle fantasie. Niente incontri reali, contatti, indirizzi o posizioni.\n"
    "- Non chiedi mai soldi, wallet, seed, password o dati personali. Niente consigli finanziari, niente promesse di guadagno: "
    "VELVET non dà rendimenti, DYOR.\n"
    "- Usa SOLO i fatti in CONOSCENZA per link, indirizzi, numeri e date; se non li sai, dillo e rimanda a https://x-zdos.it. Non inventare.\n"
    "- Se ti chiedono se sei umana: sei un'intelligenza artificiale. Se l'utente scrive ROSSO ti fermi ed esci dal ruolo."
)

# ------------------------------------------------------------------ knowledge base (BM25 leggero)
_STOP = set("""il lo la i gli le un uno una di a da in con su per tra fra e o ma che chi cosa come dove quando perché perche
è e' sono sei siamo hai ho ha mi ti si ci vi ne non più piu del della dei degli delle al allo alla ai agli alle dal dalla
nel nella nei sul sulla questo questa quello quella tuo tua mio mia suo sua the a an of to is are what how where and or""".split())
_WORD = re.compile(r"[a-z0-9$àèéìòù]+")
_kb: List[dict] = []
_kb_idf: Dict[str, float] = {}
_kb_avg = 1.0
_kb_mtime = 0.0


def _tok(s: str) -> List[str]:
    out = []
    for w in _WORD.findall(s.lower()):
        if w in _STOP or len(w) < 2:
            continue
        out.append(w[:-1] if len(w) > 5 and w[-1] in "aeio" else w)  # stemming minimo
    return out


def load_kb(force: bool = False) -> int:
    global _kb, _kb_idf, _kb_avg, _kb_mtime
    try:
        files = sorted(f for f in os.listdir(KB_DIR) if f.endswith(".md"))
    except FileNotFoundError:
        files = []
    mt = max([os.path.getmtime(os.path.join(KB_DIR, f)) for f in files] or [0])
    if not force and _kb and mt == _kb_mtime:
        return len(_kb)
    docs = []
    for f in files:
        title, buf = "", []
        for line in open(os.path.join(KB_DIR, f), encoding="utf-8"):
            if line.startswith("# "):
                if buf:
                    docs.append({"title": title, "text": " ".join(buf).strip()})
                title, buf = line[2:].strip(), []
            elif line.strip():
                buf.append(line.strip())
        if buf:
            docs.append({"title": title, "text": " ".join(buf).strip()})
    for d in docs:
        d["toks"] = _tok(d["title"] + " " + d["title"] + " " + d["text"])
    df: Dict[str, int] = {}
    for d in docs:
        for w in set(d["toks"]):
            df[w] = df.get(w, 0) + 1
    n = max(len(docs), 1)
    _kb_idf = {w: math.log(1 + (n - c + 0.5) / (c + 0.5)) for w, c in df.items()}
    _kb_avg = sum(len(d["toks"]) for d in docs) / n if docs else 1.0
    _kb, _kb_mtime = docs, mt
    return len(docs)


def search_kb(q: str, k: int = 3) -> List[Tuple[float, dict]]:
    load_kb()
    qt = _tok(q)
    scored = []
    for d in _kb:
        tf: Dict[str, int] = {}
        for w in d["toks"]:
            tf[w] = tf.get(w, 0) + 1
        s = 0.0
        for w in set(qt):
            if w in tf:
                f = tf[w]
                s += _kb_idf.get(w, 0) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * len(d["toks"]) / _kb_avg))
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: -x[0])
    return scored[:k]


# Domande fattuali: risposta immediata dalla KB (niente modello, < 1 s).
_FACT_RE = re.compile(
    r"\b(link|sito|siti|url|indirizzo del token|contratto|contract|mint|ca\b|invit\w*|discord|telegram|whatsapp|"
    r"regol\w*|safeword|airdrop|dsn|velvet|\$ov|zlang|zdos|iso|kira|k\.i\.r\.a|zroute|radar|chi (sei|è)|cos['’ ]?è|cosa (è|sono)|dove)\b",
    re.IGNORECASE,
)

_INTRO = {
    "rubina": ["Ascolta bene, te lo dico una volta sola.", "Prendi nota, tesoro.", "Ecco come stanno le cose."],
    "zara": ["Segnati questo.", "Te lo dico io, che qui vedo tutto.", "Facile. Leggi."],
}


def kb_answer(persona: str, q: str) -> Optional[str]:
    if not _FACT_RE.search(q):
        return None
    q2 = q if re.search(r"\bchi\b", q, re.I) else re.sub(r"\b(rubina|zara)\b", " ", q, flags=re.I)
    hits = search_kb(q2, 2)
    if not hits or hits[0][0] < 2.0:
        return None
    d = hits[0][1]
    text = d["text"]
    if len(text) > 700:
        text = text[:700].rsplit(". ", 1)[0] + "."
    intro = _INTRO.get(persona, _INTRO["rubina"])[int(time.time()) % 3]
    return f"{intro} **{d['title']}**: {text}"


def kb_context(q: str) -> str:
    hits = search_kb(q, 2)
    base = ("Siti: https://x-zdos.it · https://velvet.x-zdos.it/app · Discord " + DISCORD_SERVER +
            " · Telegram https://t.me/OurVelvetHub · Safeword ROSSO · VELVET senza rendimenti.")
    return base + "\n" + "\n".join(f"- {d['title']}: {d['text'][:380]}" for _, d in hits)


# ------------------------------------------------------------------ memoria opt-in
_mem_lock = threading.Lock()


def _key_secret() -> bytes:
    try:
        return open(KEY_FILE, "rb").read().strip()
    except Exception:
        return b"ourvelvet-agi"


def user_hash(platform: str, user_id: str) -> str:
    return hmac.new(_key_secret(), f"{platform}:{user_id}".encode(), hashlib.sha256).hexdigest()[:32]


def _mem() -> sqlite3.Connection:
    con = sqlite3.connect(MEM_DB, timeout=5)
    con.execute("CREATE TABLE IF NOT EXISTS notes (uh TEXT NOT NULL, note TEXT NOT NULL, at INTEGER NOT NULL)")
    con.execute("CREATE INDEX IF NOT EXISTS notes_uh ON notes(uh)")
    return con


def mem_get(uh: str) -> List[str]:
    with _mem_lock:
        con = _mem()
        try:
            con.execute("DELETE FROM notes WHERE at < ?", (int(time.time()) - MEM_TTL_S,))
            con.commit()
            return [r[0] for r in con.execute("SELECT note FROM notes WHERE uh=? ORDER BY at", (uh,))]
        finally:
            con.close()


def mem_add(uh: str, note: str) -> List[str]:
    note = re.sub(r"\s+", " ", note or "").strip()[:200]
    if not note:
        return mem_get(uh)
    if MINOR_RE.search(note):
        raise ValueError("nota non ammessa")
    note = re.sub(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|0x[0-9a-fA-F]{40}|\+?\d[\d \-]{7,}\d|\S+@\S+\.\w+", "[omesso]", note)
    with _mem_lock:
        con = _mem()
        try:
            con.execute("INSERT INTO notes (uh, note, at) VALUES (?,?,?)", (uh, note, int(time.time())))
            ids = [r[0] for r in con.execute("SELECT rowid FROM notes WHERE uh=? ORDER BY at DESC", (uh,))]
            for rid in ids[MEM_MAX:]:
                con.execute("DELETE FROM notes WHERE rowid=?", (rid,))
            con.commit()
        finally:
            con.close()
    return mem_get(uh)


def mem_forget(uh: str) -> int:
    with _mem_lock:
        con = _mem()
        try:
            n = con.execute("DELETE FROM notes WHERE uh=?", (uh,)).rowcount
            con.commit()
            return n
        finally:
            con.close()


# ------------------------------------------------------------------ modello
_busy = asyncio.Semaphore(1)
_stats = {"last_ms": None, "last_source": None, "llm_ok": 0, "llm_fail": 0, "kb": 0, "warm_at": 0, "loaded": None}


async def _post(path: str, payload: dict, timeout: float) -> dict:
    if httpx is None:
        raise RuntimeError("httpx mancante")
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(OLLAMA + path, json=payload)
        r.raise_for_status()
        return r.json()


async def model_loaded() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5) as c:  # type: ignore
            j = (await c.get(OLLAMA + "/api/ps")).json()
        ok = any(m.get("name") == MODEL or m.get("model") == MODEL for m in j.get("models", []))
    except Exception:
        ok = False
    _stats["loaded"] = ok
    return ok


async def warmup() -> bool:
    if await model_loaded():
        return True
    if _busy.locked():
        return False
    async with _busy:
        try:
            for persona in PERSONAS:
                for mode in ("public", "club"):
                    await _post("/api/chat", {"model": MODEL, "stream": False, "keep_alive": KEEP_ALIVE,
                                              "messages": [{"role": "system", "content": system_prompt(persona, mode)},
                                                           {"role": "user", "content": "ciao"}],
                                              "options": {"num_predict": 1}}, 240)
            _stats["warm_at"] = int(time.time())
            return True
        except Exception as e:  # pragma: no cover
            logger.warning("warmup fallito: %s", type(e).__name__)
            return False


def system_prompt(persona: str, mode: str, draft: bool = False) -> str:
    """Parte statica (uguale a ogni richiesta per persona+modalità): Ollama la tiene in cache e non la rielabora."""
    p = PERSONAS[persona]
    parts = [p["core"], p["club"] if mode == "club" else p["public"], p["example"], RULES]
    if draft:
        parts.append("Compito: scrivi UN SOLO post per X in italiano, massimo 240 caratteri, con al massimo un link preso da CONOSCENZA "
                     "e 1-2 hashtag. Niente promesse di guadagno, niente contenuti espliciti, niente @menzioni. Solo il testo del post.")
    return "\n\n".join(parts)


def user_turn(text: str, notes: List[str]) -> str:
    """Parte variabile in coda: conoscenza pertinente e note /ricordami."""
    extra = "CONOSCENZA:\n" + kb_context(text)
    if notes:
        extra += "\nNote che l'utente ti ha chiesto di ricordare: " + "; ".join(notes)
    return text + "\n\n[" + extra + "]"


def _postfix(persona: str, reply: str) -> str:
    reply = re.sub(r"^\s*(rubina|zara)\s*:\s*", "", reply.strip(), flags=re.I)
    if EXPLICIT_RE.search(reply):
        return SOFT_REPLY[persona]
    if MINOR_RE.search(reply):
        return MINOR_REPLY
    return reply[:1500]


class ChatIn(BaseModel):
    persona: str = "rubina"
    mode: str = "public"          # public | club
    messages: List[dict]
    platform: str = "discord"
    user_id: Optional[str] = None  # serve solo per leggere le note /ricordami


async def respond(persona: str, mode: str, messages: List[dict], platform: str = "discord",
                  user_id: Optional[str] = None) -> dict:
    t0 = time.time()
    persona = persona if persona in PERSONAS else "rubina"
    mode = "club" if mode == "club" else "public"
    msgs = []
    for m in (messages or [])[-12:]:
        role = m.get("role") if m.get("role") in ("user", "assistant") else "user"
        txt = str(m.get("content") or "").strip()[:1000]
        if txt:
            msgs.append({"role": role, "content": txt})
    if not msgs or msgs[-1]["role"] != "user":
        return {"reply": "Scrivi qualcosa.", "source": "rule", "safeword": False, "ms": 0}
    last = msgs[-1]["content"]

    def done(reply, source, safeword=False):
        ms = int((time.time() - t0) * 1000)
        _stats.update(last_ms=ms, last_source=source)
        return {"reply": reply, "source": source, "safeword": safeword, "ms": ms}

    if SAFEWORD_RE.search(last):
        return done(SAFEWORD_REPLY, "rule", True)
    if MINOR_RE.search(last):
        return done(MINOR_REPLY, "rule")
    fact = kb_answer(persona, last)
    if fact and (len(msgs) <= 2 or len(last) < 80):
        _stats["kb"] += 1
        return done(fact, "kb")
    notes = mem_get(user_hash(platform, user_id)) if user_id else []
    try:  # coda breve: aspetta il turno invece di rifiutare subito
        await asyncio.wait_for(_busy.acquire(), QUEUE_S)
    except asyncio.TimeoutError:
        return done((fact or "") + ("\n" if fact else "") + "Sto già rispondendo ad altri: riprova tra un minuto.", "busy")
    _busy.release()
    payload = {"model": MODEL, "stream": False, "keep_alive": KEEP_ALIVE,
               "messages": [{"role": "system", "content": system_prompt(persona, mode)}] + msgs[:-1]
               + [{"role": "user", "content": user_turn(last, notes)}],
               "options": {"temperature": 0.7, "repeat_penalty": 1.15, "num_predict": 80}}
    async with _busy:
        try:
            data = await asyncio.wait_for(_post("/api/chat", payload, TIMEOUT_S), TIMEOUT_S + 3)
            reply = ((data or {}).get("message") or {}).get("content", "").strip()
        except Exception:
            reply = ""
    if not reply:
        _stats["llm_fail"] += 1
        fb = fact or kb_answer(persona, last + " link sito") or ""
        return done((fb + "\n" if fb else "") + "Sono lenta in questo momento: riprova tra poco.", "fallback")
    _stats["llm_ok"] += 1
    return done(_postfix(persona, reply), "llm")


async def x_draft(persona: str, topic: str) -> dict:
    persona = persona if persona in PERSONAS else "rubina"
    topic = (topic or "OurVelvet e l'ecosistema ZDOS").strip()[:300]
    if MINOR_RE.search(topic):
        raise ValueError("tema non ammesso")
    text = ""
    if not _busy.locked():
        payload = {"model": MODEL, "stream": False, "keep_alive": KEEP_ALIVE,
                   "messages": [{"role": "system", "content": system_prompt(persona, "public", draft=True)},
                                {"role": "user", "content": user_turn("Tema del post: " + topic, [])}],
                   "options": {"temperature": 0.8, "num_predict": 70}}
        async with _busy:
            try:
                data = await asyncio.wait_for(_post("/api/chat", payload, TIMEOUT_S), TIMEOUT_S + 3)
                text = ((data or {}).get("message") or {}).get("content", "").strip().strip('"')
            except Exception:
                text = ""
    if not text or EXPLICIT_RE.search(text) or re.search(r"guadagn|rendiment|profitt|100x|moon", text, re.I):
        text = f"{topic} · OurVelvet 18+ by ZDOS1.3. Solo adulti, consenso sempre, safeword ROSSO. https://velvet.x-zdos.it #OurVelvet"
    text = re.sub(r"@\w+|(?<!\S)/\w+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    if "http" not in text:
        text = text[:240].rstrip() + " https://velvet.x-zdos.it"
    text = text[:270]
    return {"text": text, "intent": "https://x.com/intent/post?text=" + urllib.parse.quote(text), "note": "Bozza: pubblica tu da X, il bot non pubblica."}


# ------------------------------------------------------------------ API (solo con x-agi-key)
def _auth(key: Optional[str]) -> None:
    if not key or not hmac.compare_digest(key.strip().encode(), _key_secret()):
        raise HTTPException(status_code=403, detail="forbidden")


@router.post("/chat")
async def api_chat(body: ChatIn, x_agi_key: Optional[str] = Header(None)):
    _auth(x_agi_key)
    return await respond(body.persona, body.mode, body.messages, body.platform, body.user_id)


class MemIn(BaseModel):
    platform: str
    user_id: str
    op: str  # get | add | forget
    note: Optional[str] = None


@router.post("/memory")
def api_memory(body: MemIn, x_agi_key: Optional[str] = Header(None)):
    _auth(x_agi_key)
    uh = user_hash(body.platform, body.user_id)
    if body.op == "add":
        try:
            return {"notes": mem_add(uh, body.note or "")}
        except ValueError:
            raise HTTPException(status_code=400, detail="Nota non ammessa.")
    if body.op == "forget":
        return {"deleted": mem_forget(uh), "notes": []}
    return {"notes": mem_get(uh)}


class DraftIn(BaseModel):
    persona: str = "rubina"
    topic: str = ""


@router.post("/xdraft")
async def api_xdraft(body: DraftIn, x_agi_key: Optional[str] = Header(None)):
    _auth(x_agi_key)
    try:
        return await x_draft(body.persona, body.topic)
    except ValueError:
        raise HTTPException(status_code=400, detail="Tema non ammesso.")


@router.get("/status")
async def api_status():
    await model_loaded()
    return {"ok": True, "model": MODEL, "kb_sections": load_kb(), "busy": _busy.locked(),
            **{k: _stats[k] for k in ("loaded", "last_ms", "last_source", "llm_ok", "llm_fail", "kb", "warm_at")}}


async def _warm_loop() -> None:
    await asyncio.sleep(20)
    while True:
        try:
            await warmup()
        except Exception:  # pragma: no cover
            pass
        await asyncio.sleep(WARMUP_S)


@router.on_event("startup")
async def _start() -> None:
    load_kb(True)
    if WARMUP_S > 0:
        asyncio.get_event_loop().create_task(_warm_loop())
