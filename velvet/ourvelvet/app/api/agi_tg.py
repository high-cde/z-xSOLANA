"""Rubina e Zara su Telegram (@RedVelvetOfficial_bot), registrate sul Dispatcher di app.api.bot.

Comandi: /rubina, /zara, /eventi, /condividi (admin del gruppo), /bozza (bozza X con link intent),
/ricordami, /dimentica, /velvet18 on|off (admin del gruppo), /invita.
- Quando un admin aggiunge il bot a un gruppo: un solo messaggio di presentazione. Nessun altro messaggio non richiesto.
- Il bot non entra da solo nei gruppi e non scrive in privato a chi non l'ha avviato.
- Nei gruppi le AGI sono in modalità pubblica (niente flirt) finché un admin non attiva /velvet18 on.
  In privato: modalità club (l'utente ha confermato i 18 anni con /start). Mai contenuti espliciti.
- Le conversazioni restano solo in memoria (30 min) e non vengono loggate.

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.
"""

from __future__ import annotations

import asyncio
import html
import logging
import os
import sqlite3
import time
from typing import Dict, List

from aiogram import F, types
from aiogram.enums import ChatMemberStatus
from aiogram.filters import Command, CommandObject
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.api import bot as B
from app.api import personas as P

logger = logging.getLogger("ourvelvet.agi_tg")
dp = B.dp
GROUPS_DB = os.environ.get("AGI_TG_GROUPS_DB", os.path.join(os.path.dirname(P.MEM_DB), "agi_tg_groups.db"))
SESS_TTL = 1800
_sess: Dict[str, dict] = {}
_tasks: set = set()

INTRO = (
    "🖤 <b>Rubina e Zara</b> di <b>OurVelvet</b> (by ZDOS1.3) sono qui perché un admin ci ha invitate.\n\n"
    "Siamo due intelligenze artificiali. Rispondiamo solo quando ci chiamate:\n"
    "• /rubina &lt;messaggio&gt; · /zara &lt;messaggio&gt;\n"
    "• /eventi — eventi e attività OurVelvet\n"
    "• /bozza &lt;tema&gt; — bozza di post per X (la pubblichi tu)\n"
    "• /ricordami · /dimentica — memoria solo se la chiedi\n\n"
    "In questo gruppo restiamo in modalità pubblica, senza contenuti 18+. "
    "Un admin può attivare la modalità club con /velvet18 on solo se il gruppo è per adulti.\n"
    "Regole: consenso sempre, safeword ROSSO, niente minori. Nessun DM non richiesto, nessuno spam."
)


def _kb() -> InlineKeyboardMarkup:  # niente web_app: nei gruppi Telegram non è ammesso
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🌐 OurVelvet", url=B.SITE_URL),
        InlineKeyboardButton(text="📢 Canale", url=B.CHANNEL_URL),
        InlineKeyboardButton(text="💬 Discord", url=P.DISCORD_SERVER),
    ]])


def _gdb() -> sqlite3.Connection:
    con = sqlite3.connect(GROUPS_DB, timeout=5)
    con.execute("CREATE TABLE IF NOT EXISTS groups (chat_id INTEGER PRIMARY KEY, title TEXT, adult INTEGER NOT NULL DEFAULT 0,"
                " intro_at INTEGER, added_at INTEGER, left_at INTEGER)")
    return con


def group_get(chat_id: int) -> dict:
    con = _gdb()
    try:
        r = con.execute("SELECT adult, intro_at FROM groups WHERE chat_id=?", (chat_id,)).fetchone()
        return {"adult": bool(r and r[0]), "intro_at": r[1] if r else None}
    finally:
        con.close()


def group_set(chat_id: int, **kw) -> None:
    con = _gdb()
    try:
        con.execute("INSERT OR IGNORE INTO groups (chat_id) VALUES (?)", (chat_id,))
        for k, v in kw.items():
            if k in ("title", "adult", "intro_at", "added_at", "left_at"):
                con.execute(f"UPDATE groups SET {k}=? WHERE chat_id=?", (v, chat_id))
        con.commit()
    finally:
        con.close()


def _private(m: types.Message) -> bool:
    return B._is_private_chat(m)


async def _is_admin(m: types.Message) -> bool:
    if _private(m) or not m.from_user:
        return _private(m)
    try:
        cm = await m.bot.get_chat_member(m.chat.id, m.from_user.id)
        return cm.status in (ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.CREATOR)
    except Exception:
        return False


def _mode(m: types.Message) -> str:
    if _private(m):
        return "club"
    return "club" if group_get(m.chat.id)["adult"] else "public"


async def _safe(coro) -> None:
    try:
        await coro
    except Exception as e:  # niente contenuti nei log, solo il tipo di errore
        logger.warning("risposta AGI non inviata: %s", type(e).__name__)


def _spawn(coro) -> None:
    t = asyncio.get_event_loop().create_task(_safe(coro))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


async def _talk(m: types.Message, persona: str, text: str) -> None:
    uid = str(m.from_user.id if m.from_user else m.chat.id)
    key = f"{persona}:{m.chat.id}:{uid}"
    now = time.time()
    for k in [k for k, s in _sess.items() if now - s["at"] > SESS_TTL]:
        _sess.pop(k, None)
    s = _sess.setdefault(key, {"msgs": [], "at": 0, "hits": []})
    s["hits"] = [x for x in s["hits"] if now - x < 3600]
    if s["hits"] and now - s["hits"][-1] < 8:
        await m.reply("Piano. Un messaggio ogni 8 secondi.")
        return
    if len(s["hits"]) >= 30:
        await m.reply("Basta per quest'ora. Torna più tardi.")
        return
    s["hits"].append(now)
    s["at"] = now
    msgs = (s["msgs"] + [{"role": "user", "content": text}])[-10:]
    try:
        await m.bot.send_chat_action(m.chat.id, "typing")
    except Exception:
        pass
    r = await P.respond(persona, _mode(m), msgs, "telegram", uid)
    if r.get("safeword"):
        s["msgs"] = []
    elif r["source"] in ("llm", "kb"):
        s["msgs"] = (msgs + [{"role": "assistant", "content": r["reply"]}])[-10:]
    name = P.PERSONAS[persona]["name"]
    body = html.escape(r["reply"]).replace("**", "")
    foot = "IA che interpreta " + name + " · ROSSO la ferma"
    await m.reply(f"<b>{name}:</b> {body}\n<i>{foot}</i>", parse_mode="HTML", disable_web_page_preview=True)


def _persona_handler(persona: str):
    async def handler(message: types.Message, command: CommandObject) -> None:
        text = (command.args or "").strip()
        if not text and message.reply_to_message and message.reply_to_message.text:
            text = message.reply_to_message.text.strip()
        if not text:
            await message.reply(f"Scrivi: /{persona} il tuo messaggio. Esempio: /{persona} cos'è OurVelvet?")
            return
        _spawn(_talk(message, persona, text[:1000]))  # risposta in background: il webhook torna subito
    return handler


dp.message.register(_persona_handler("rubina"), Command("rubina"))
dp.message.register(_persona_handler("zara"), Command("zara"))


def _events(limit: int = 5) -> List[dict]:
    try:
        from app.api import events as E
        con = E._connect()
        try:
            rows = con.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return [E._row(r) for r in rows]
        finally:
            con.close()
    except Exception:
        logger.exception("eventi non disponibili")
        return []


def _events_text(evs: List[dict]) -> str:
    if not evs:
        return ("Per ora non ci sono eventi pubblicati. Le novità arrivano sul canale @OurVelvetHub "
                "e nel Discord ufficiale.")
    out = ["🎟️ <b>Eventi e attività OurVelvet</b>"]
    for e in evs:
        line = f"• <b>{html.escape(e.get('title') or '')}</b>"
        if e.get("body"):
            line += " — " + html.escape(str(e["body"])[:160])
        if e.get("url"):
            line += f"\n  {html.escape(e['url'])}"
        out.append(line)
    return "\n".join(out)


@dp.message(Command("eventi"))
async def cmd_eventi(message: types.Message) -> None:
    await message.reply(_events_text(_events()), parse_mode="HTML", reply_markup=_kb(), disable_web_page_preview=True)


@dp.message(Command("condividi"))
async def cmd_condividi(message: types.Message) -> None:
    if not await _is_admin(message):
        await message.reply("Solo gli admin del gruppo possono condividere gli eventi qui.")
        return
    evs = _events(1)
    txt = _events_text(evs) if evs else "🖤 <b>OurVelvet</b> by ZDOS1.3 — club 18+ basato sul consenso. Eventi e contest sul canale @OurVelvetHub."
    await message.answer(txt, parse_mode="HTML", reply_markup=_kb(), disable_web_page_preview=True)


@dp.message(Command("bozza"))
async def cmd_bozza(message: types.Message, command: CommandObject) -> None:
    topic = (command.args or "").strip()

    async def run():
        try:
            d = await P.x_draft("zara" if topic.lower().startswith("zara") else "rubina", topic)
        except ValueError:
            await message.reply("Tema non ammesso.")
            return
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✍️ Apri la bozza su X", url=d["intent"])]])
        await message.reply("<b>Bozza per X</b> (la pubblichi tu, il bot non pubblica):\n\n" + html.escape(d["text"]),
                            parse_mode="HTML", reply_markup=kb, disable_web_page_preview=True)
    _spawn(run())


@dp.message(Command("ricordami"))
async def cmd_ricordami(message: types.Message, command: CommandObject) -> None:
    note = (command.args or "").strip()
    uid = str(message.from_user.id if message.from_user else message.chat.id)
    uh = P.user_hash("telegram", uid)
    if not note:
        notes = P.mem_get(uh)
        await message.reply("Cosa ricordo di te: " + ("; ".join(notes) if notes else "niente.") +
                            "\nPer aggiungere: /ricordami mi chiamo Leo, amo la techno. Per cancellare: /dimentica")
        return
    try:
        notes = P.mem_add(uh, note)
    except ValueError:
        await message.reply("Questa nota non la salvo.")
        return
    await message.reply(f"Fatto. Ricordo {len(notes)} nota/e per 30 giorni (max 3). /dimentica cancella tutto.")


@dp.message(Command("dimentica"))
async def cmd_dimentica(message: types.Message) -> None:
    uid = str(message.from_user.id if message.from_user else message.chat.id)
    n = P.mem_forget(P.user_hash("telegram", uid))
    await message.reply(f"Cancellato: {n} nota/e. Non ricordo più niente di te.")


@dp.message(Command("velvet18"))
async def cmd_velvet18(message: types.Message, command: CommandObject) -> None:
    if _private(message):
        await message.reply("In privato sei già in modalità club (hai confermato i 18 anni con /start).")
        return
    if not await _is_admin(message):
        await message.reply("Solo gli admin del gruppo possono cambiare la modalità.")
        return
    on = (command.args or "").strip().lower() in ("on", "si", "sì", "1")
    group_set(message.chat.id, adult=1 if on else 0)
    await message.reply("Modalità club 18+ attiva: flirt soft, mai contenuti espliciti, safeword ROSSO. Confermate che il gruppo è solo per adulti."
                        if on else "Modalità pubblica: nessun contenuto 18+.")


@dp.message(Command("invita"))
async def cmd_invita(message: types.Message) -> None:
    await message.reply(
        "Per portare Rubina e Zara altrove (solo se sei admin lì):\n"
        f"• Telegram: {P.INVITE_TELEGRAM_BOT}\n• Discord: {P.INVITE_DISCORD_BOT}\n"
        f"Server Discord ufficiale: {P.DISCORD_SERVER}", disable_web_page_preview=True)


@dp.my_chat_member()
async def on_my_chat_member(event: types.ChatMemberUpdated) -> None:
    chat = event.chat
    kind = getattr(chat.type, "value", chat.type)
    if str(kind) not in ("group", "supergroup"):
        return
    new = event.new_chat_member.status
    if new in (ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR):
        old = event.old_chat_member.status
        if old in (ChatMemberStatus.MEMBER, ChatMemberStatus.ADMINISTRATOR):
            return  # solo cambio permessi
        g = group_get(chat.id)
        group_set(chat.id, title=(chat.title or "")[:100], added_at=int(time.time()), left_at=None)
        if g["intro_at"] and time.time() - g["intro_at"] < 7 * 86400:
            return  # niente presentazioni ripetute
        try:
            await event.bot.send_message(chat.id, INTRO, parse_mode="HTML", reply_markup=_kb(), disable_web_page_preview=True)
            group_set(chat.id, intro_at=int(time.time()))
        except Exception as e:
            logger.warning("presentazione non inviata: %s", type(e).__name__)
    elif new in (ChatMemberStatus.LEFT, ChatMemberStatus.KICKED):
        group_set(chat.id, left_at=int(time.time()))
