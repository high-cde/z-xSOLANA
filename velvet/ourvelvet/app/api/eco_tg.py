"""Comandi ecosistema per @RedVelvetOfficial_bot, stesso Dispatcher di app.api.bot.

/radar /badge [ID] /dev /token /velvetstar /merito [ID] /stato /aiuto: solo letture da API pubbliche
(velvet.x-zdos.it, x-zdos.it) e RPC Solana/Polygon. Niente prezzi, niente rendimenti,
nessun messaggio non richiesto: il bot risponde solo a chi scrive il comando.
Stessi contenuti dei comandi Discord (z-xSOLANA discord-bot/src/ecosystem.js).

© 2026 ZDOS1.3 — Licenza ZSEL proprietaria.
"""

from __future__ import annotations

import asyncio
import html
import logging
import re
import time

import aiohttp
from aiogram import types
from aiogram.filters import Command, CommandObject

from app.api import bot as B

logger = logging.getLogger("ourvelvet.eco_tg")
dp = B.dp

VELVET = "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump"
DSN_SOL = "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4"
DSN_POLYGON = "0xfc90516a1f736FaC557e09D8853dB80dA192c296"
SITE = "https://velvet.x-zdos.it"
# Le API Velvet girano su questo server: le leggiamo in locale (stessi dati delle URL pubbliche).
LOCAL = {
    "radar": "http://127.0.0.1:8763/api",
    "badge": "http://127.0.0.1:8899/api/nft/badge-v2",
    "stars": "http://127.0.0.1:4188/api/stars",
    "merito": "http://127.0.0.1:4192/merito/api",
}
URL_RADAR = SITE + "/radar/"
URL_BADGE = SITE + "/badge/"
URL_STAR = SITE + "/velvet-star/"
URL_MERITO = SITE + "/merito/"
URL_DEV = "https://x-zdos.it/dev/"
URL_IDE = "https://x-zdos.it/ide/"
SOL_RPC = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"]
POLY_RPC = ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org"]
HEALTH = [
    ("x-zdos.it", "https://x-zdos.it/"),
    ("Portale dev Zlang", "https://x-zdos.it/dev/"),
    ("Zlang IDE", "https://x-zdos.it/ide/"),
    ("ZSwap", "https://swap.x-zdos.it/"),
    ("zRoute", "https://swap.x-zdos.it/zroute/"),
    ("ZQuest", "https://quest.x-zdos.it/"),
    ("OurVelvet (18+)", SITE + "/"),
    ("Radar OurVelvet", SITE + "/radar-api/health"),
    ("Badge OurVelvet", SITE + "/api/nft/badge-v2/roles.json"),
    ("Velvet Star", SITE + "/ai-directory/api/stars"),
]
OV_ID = re.compile(r"^OV-[A-Z0-9]{4}-VELVET$")
TIMEOUT = aiohttp.ClientTimeout(total=9)
UA = {"user-agent": "ourvelvet-bot/1.0"}
FOOT = "<i>ZDOS1.3 · dati letti ora · nessun rendimento promesso</i>"

COMMANDS = [
    ("start", "Benvenuto e regole"),
    ("hub", "Apri la Mini App"),
    ("radar", "Radar OurVelvet: stato e link"),
    ("badge", "Badge OurVelvet, o il tuo: /badge OV-XXXX-VELVET"),
    ("velvetstar", "Velvet Star, vetrina creator (opt-in)"),
    ("token", "$DSN e VELVET: dati on-chain, niente prezzi"),
    ("merito", "Miner merito VELVET, o i tuoi punti: /merito OV-XXXX-VELVET"),
    ("dev", "Portale sviluppatori Zlang"),
    ("stato", "Stato dei servizi ZDOS"),
    ("rubina", "Parla con Rubina (IA)"),
    ("zara", "Parla con Zara (IA)"),
    ("eventi", "Eventi e attività OurVelvet"),
    ("bozza", "Bozza di post per X (la pubblichi tu)"),
    ("ricordami", "Memoria solo se la chiedi"),
    ("dimentica", "Cancella la memoria"),
    ("invita", "Porta Rubina e Zara nel tuo gruppo"),
    ("aiuto", "Elenco dei comandi"),
]

AIUTO = (
    "Comandi di <b>OurVelvet</b> 18+ by ZDOS1.3:\n\n"
    "/radar — Radar OurVelvet: stato, ufficiali, link\n"
    "/badge — badge e ruoli; <code>/badge OV-XXXX-VELVET</code> per il tuo\n"
    "/velvetstar — vetrina Velvet Star\n"
    "/token — $DSN e VELVET, dati on-chain (niente prezzi)\n"
    "/merito — miner merito VELVET; <code>/merito OV-XXXX-VELVET</code> per i tuoi punti\n"
    "/dev — portale sviluppatori Zlang\n"
    "/stato — stato dei servizi\n"
    "/hub — Mini App · /rubina /zara — le AI dichiarate\n"
    "/eventi · /bozza · /ricordami · /dimentica · /invita\n"
    "/aiuto — questo elenco\n\n"
    "📜 Solo maggiorenni (18+), consenso sempre, safeword ROSSO. "
    "Il bot non scrive mai per primo e non pubblica da solo.\n"
    "Canale: @OurVelvetHub"
)


def esc(s: object) -> str:
    return html.escape(str(s), quote=False)


def fmt_int(n: object) -> str:
    return f"{int(n):,}".replace(",", ".")


async def get_json(session: aiohttp.ClientSession, url: str):
    async with session.get(url, headers=UA) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status}")
        return await r.json(content_type=None)


async def rpc(session: aiohttp.ClientSession, urls, method: str, params):
    last: Exception | None = None
    for u in urls:
        try:
            async with session.post(u, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, headers=UA) as r:
                j = await r.json(content_type=None)
                if j.get("error"):
                    raise RuntimeError(str(j["error"].get("message", "rpc")))
                return j["result"]
        except Exception as e:  # prova il successivo
            last = e
    raise last or RuntimeError("rpc")


async def spl_info(session, mint: str) -> dict:
    acc = await rpc(session, SOL_RPC, "getAccountInfo", [mint, {"encoding": "jsonParsed", "commitment": "confirmed"}])
    v = (acc or {}).get("value") or {}
    info = (((v.get("data") or {}).get("parsed") or {}).get("info")) or {}
    if info.get("supply") is None:
        raise RuntimeError("mint non leggibile")
    prog = "Token-2022" if v.get("owner") == "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" else "SPL Token"
    dec = int(info["decimals"])
    return {"supply": int(info["supply"]) // (10 ** dec), "decimals": dec, "program": prog,
            "mint": info.get("mintAuthority"), "freeze": info.get("freezeAuthority")}


async def erc20_info(session, addr: str) -> dict:
    ts = await rpc(session, POLY_RPC, "eth_call", [{"to": addr, "data": "0x18160ddd"}, "latest"])
    dec = int(await rpc(session, POLY_RPC, "eth_call", [{"to": addr, "data": "0x313ce567"}, "latest"]), 16)
    return {"supply": int(ts, 16) // (10 ** dec), "decimals": dec}


def _auth(a) -> str:
    return "revocata" if a is None else f"<code>{esc(a[:4])}…{esc(a[-4:])}</code>"


async def text_token() -> str:
    async with aiohttp.ClientSession(timeout=TIMEOUT) as s:
        v, ds, dp_ = await asyncio.gather(spl_info(s, VELVET), spl_info(s, DSN_SOL), erc20_info(s, DSN_POLYGON), return_exceptions=True)

    def sol(r, mint):
        if isinstance(r, Exception):
            return f"RPC Solana non raggiungibile ora · <code>{mint}</code>"
        return (f"{r['program']} · {r['decimals']} decimali · offerta on-chain <b>{fmt_int(r['supply'])}</b>\n"
                f"mint authority {_auth(r['mint'])} · freeze {_auth(r['freeze'])}\n"
                f"<code>{mint}</code> · <a href=\"https://solscan.io/token/{mint}\">Solscan</a>")
    poly = (f"RPC Polygon non raggiungibile ora · <code>{DSN_POLYGON}</code>" if isinstance(dp_, Exception) else
            f"ERC-20 · {dp_['decimals']} decimali · offerta on-chain <b>{fmt_int(dp_['supply'])}</b>\n"
            f"<code>{DSN_POLYGON}</code> · <a href=\"https://polygonscan.com/token/{DSN_POLYGON}\">Polygonscan</a>")
    return ("🪙 <b>Token ufficiali ZDOS · dati on-chain</b>\n"
            "Letti adesso dalla blockchain. Niente prezzi, niente rendimenti: VELVET è un gettone di comunità.\n\n"
            f"<b>VELVET ($OV) · Solana</b>\n{sol(v, VELVET)}\n\n"
            f"<b>$DSN · Solana (ufficiale)</b>\n{sol(ds, DSN_SOL)}\nNessuna pool: oggi non è scambiabile su Solana.\n\n"
            f"<b>$DSN · Polygon</b>\n{poly}\n\n"
            f"Schede complete: <a href=\"{URL_DEV}monete/\">x-zdos.it/dev/monete</a>\n{FOOT}")


async def text_radar() -> str:
    h = m = lb = None
    async with aiohttp.ClientSession(timeout=TIMEOUT) as s:
        res = await asyncio.gather(get_json(s, LOCAL["radar"] + "/health"), get_json(s, LOCAL["radar"] + "/mistresses"),
                                   get_json(s, LOCAL["radar"] + "/leaderboard"), return_exceptions=True)
    h, m, lb = [None if isinstance(x, Exception) else x for x in res]
    off = (m or {}).get("official") or []
    ver = (m or {}).get("verified") or []
    rows = (lb or {}).get("rows")
    stato = "🟢 Radar online." if h and h.get("ok") else "🔴 Il Radar non risponde in questo momento."
    uff = "\n".join(f"• {esc(x.get('nick'))} · {esc(x.get('label') or x.get('role'))}" for x in off) or "n/d"
    cls = "n/d" if rows is None else (f"{len(rows)} profili" if rows else "ancora vuota")
    return ("📡 <b>Radar OurVelvet 18+</b>\n"
            f"{stato}\nCrea il tuo ID <code>OV-XXXX-VELVET</code>, entra con l'ID o con Phantom. "
            "Mistress/Master verificati con un post X; Fedeli e Curiosi solo per scelta.\n\n"
            f"<b>Ufficiali (AI dichiarate)</b>\n{uff}\n"
            f"<b>Profili verificati:</b> {len(ver)} · <b>Classifica:</b> {cls}\n\n"
            f"<a href=\"{URL_RADAR}\">Apri il Radar</a> · <a href=\"{URL_BADGE}\">Badge</a>\n"
            "Solo adulti, consenso sempre, safeword ROSSO.\n" + FOOT)


async def text_badge(arg: str | None) -> str:
    key = (arg or "").strip().upper()
    async with aiohttp.ClientSession(timeout=TIMEOUT) as s:
        if not key:
            try:
                roles = (await get_json(s, LOCAL["badge"] + "/roles.json")).get("roles") or []
            except Exception:
                roles = []
            rl = "\n".join(f"• {esc(r.get('label'))} · inviti {esc(r.get('invites', 'n/d'))}" for r in roles) or "n/d"
            return ("🏅 <b>Badge OurVelvet</b>\n"
                    "Attestato di appartenenza non trasferibile: niente valore economico, niente rendimento. "
                    "Ogni ID <code>OV-XXXX-VELVET</code> è fisso e non viene mai riassegnato.\n\n"
                    f"<b>Ruoli</b>\n{rl}\n\nIl tuo badge: <code>/badge OV-XXXX-VELVET</code>\n"
                    f"<a href=\"{URL_BADGE}\">velvet.x-zdos.it/badge</a>")
        if not OV_ID.match(key):
            return "ID non valido: il formato è <code>OV-XXXX-VELVET</code> (4 caratteri tra lettere e numeri)."
        try:
            async with s.get(f"{LOCAL['badge']}/{key}.json?full=1", headers=UA) as r:
                if r.status == 404:
                    return f"Nessun badge registrato con ID <code>{esc(key)}</code>. Crealo dal <a href=\"{URL_RADAR}\">Radar</a>."
                if r.status != 200:
                    raise RuntimeError(str(r.status))
                md = await r.json(content_type=None)
        except Exception:
            return "Il servizio badge non risponde ora, riprova tra poco."
    o = md.get("ourvelvet") or {}
    attrs = [a for a in (md.get("attributes") or []) if isinstance(a, dict) and a.get("trait_type") and a["trait_type"].lower() != "global id"][:6]
    lvl = next((a.get("value") for a in attrs if str(a.get("trait_type")).lower() == "livello"), None)
    lines = "\n".join(f"• {esc(a['trait_type'])}: {esc(a.get('value'))}" for a in attrs)
    return (f"🏅 <b>Badge OurVelvet · {esc(lvl) + ' · ' if lvl else ''}{esc(key)}</b>\n"
            f"Verificato: {'sì' if o.get('verified') else 'no'}\n{lines}\n\n"
            f"<a href=\"{SITE}/api/nft/badge-v2/{key}.svg\">Immagine del badge</a> · <a href=\"{URL_BADGE}\">Pagina badge</a>\n"
            "<i>Badge non trasferibile · nessun valore economico</i>")


async def text_velvetstar() -> str:
    try:
        async with aiohttp.ClientSession(timeout=TIMEOUT) as s:
            d = await get_json(s, LOCAL["stars"])
    except Exception:
        d = None
    rank = (d or {}).get("ranking") or []
    top = "\n".join(f"{i + 1}. {esc(x.get('name') or x.get('nick') or x.get('handle') or '?')}" for i, x in enumerate(rank[:3])) or "ancora nessun profilo approvato"
    tot = "n/d" if d is None else str(d.get("total") or 0)
    cats = "n/d" if d is None else str(len(d.get("categories") or []))
    return ("⭐ <b>Velvet Star · OurVelvet</b>\n"
            "La vetrina dei creator 18+: solo profili che hanno chiesto di esserci (opt-in) e approvati dallo staff. "
            "I punteggi sono la media di voti reali.\n\n"
            f"<b>Profili in vetrina:</b> {tot} · <b>Categorie:</b> {cats}\n<b>In testa</b>\n{top}\n\n"
            f"<a href=\"{URL_STAR}\">Apri Velvet Star</a>")


def _it(n, d: int = 0) -> str:
    try:
        v = float(n)
    except (TypeError, ValueError):
        return "n/d"
    s = f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return s[:-3] if d == 2 and s.endswith(",00") else s


async def text_merito(arg: str | None) -> str:
    """Solo lettura dal servizio zcomm locale. Nessun pagamento parte da qui."""
    key = (arg or "").strip().upper()
    async with aiohttp.ClientSession(timeout=TIMEOUT) as s:
        if key:
            if not OV_ID.match(key):
                return "ID non valido: il formato è <code>OV-XXXX-VELVET</code>."
            try:
                async with s.get(f"{LOCAL['merito']}/profile/{key}", headers=UA) as r:
                    if r.status == 404:
                        return f"Nessun profilo Radar con ID <code>{esc(key)}</code>."
                    if r.status != 200:
                        raise RuntimeError(str(r.status))
                    p = await r.json(content_type=None)
            except Exception:
                return "Il servizio merito non risponde ora, riprova tra poco."
            u = p.get("user") or {}
            m = p.get("multipliers") or {}
            inv = p.get("invites") or {}
            premio = (f"stima {_it(p.get('estimate'))} VELVET, definitivo alla chiusura della settimana"
                      if p.get("eligible") else esc(p.get("reason") or "—"))
            return (f"⛏ <b>Merito · {esc(key)}</b>\n"
                    f"Ruolo: {esc(u.get('roleLabel'))} · {'verificato' if u.get('verified') else 'da verificare'}\n"
                    f"Punti settimana {esc(p.get('week'))}: <b>{_it(p.get('weekPoints'), 2)}</b> (base {_it(p.get('weekBase'))}, x{str(m.get('total')).replace('.', ',')})\n"
                    f"Inviti rimasti: {_it(inv.get('left')) + ' su ' + _it(inv.get('limit')) if inv else 'n/d'}\n"
                    f"Premio: {premio}\n\n"
                    f"<a href=\"{URL_MERITO}\">Apri il miner</a>\n<i>Premio per contributo, con tetto · non è un rendimento</i>")
        try:
            d = await get_json(s, LOCAL["merito"] + "/summary")
        except Exception:
            return "Il servizio merito non risponde ora, riprova tra poco."
    w = d.get("week") or {}
    f = d.get("fund") or {}
    pr = d.get("profiles") or {}
    em = d.get("emissions") or {}
    stato = "attivi · chiusura ogni lunedì 00:10 (Roma)" if em.get("live") else "fermi: " + esc(em.get("stop") or "")
    return ("⛏ <b>Miner merito VELVET</b>\n"
            "Punti per contributi reali: inviti accolti, verifiche, opere zNFT certificate, quest. "
            "Mistress/Master verificati x1,5; attivi x2; bonus holder a scaglioni con tetto, mai proporzionale al saldo. "
            "Detenere da solo non dà punti.\n\n"
            f"<b>Premi:</b> {stato}\n"
            f"<b>Fondo (on-chain):</b> {_it(f.get('velvet')) if f.get('velvet') is not None else 'n/d'} VELVET\n"
            f"<b>Settimana {esc(w.get('id', ''))}:</b> pool {_it(w.get('pool'))} · max {_it(w.get('perProfileMax'))} a profilo\n"
            f"<b>Profili:</b> {_it(pr.get('total'))} Radar · {_it(pr.get('verified'))} verificati · {_it(pr.get('dominantActive'))} Mistress/Master attivi\n"
            f"<b>Idonei questa settimana:</b> {_it(w.get('eligible'))}\n\n"
            f"I tuoi punti: <code>/merito OV-XXXX-VELVET</code>\n"
            f"<a href=\"{URL_MERITO}\">Apri il miner</a> · <a href=\"{URL_MERITO}#registro\">Registro pagamenti</a>\n"
            "<i>Premio per contributo, con tetto · non è un rendimento</i>")


def text_dev() -> str:
    return ("🧩 <b>Portale sviluppatori Zlang</b>\n"
            "Guida rapida, documentazione del linguaggio, esempi che si aprono nell'IDE, API pubbliche e schede on-chain di $DSN e VELVET in sola lettura.\n\n"
            f"<a href=\"{URL_DEV}\">Portale</a> · <a href=\"{URL_DEV}esempi/\">Esempi</a> · <a href=\"{URL_DEV}api/\">API</a> · <a href=\"{URL_IDE}\">IDE</a>")


async def text_stato() -> str:
    async def one(session, name, url):
        t0 = time.monotonic()
        try:
            async with session.get(url, headers=UA, allow_redirects=False) as r:
                return name, 200 <= r.status < 400, str(r.status), int((time.monotonic() - t0) * 1000)
        except Exception:
            return name, False, "errore", int((time.monotonic() - t0) * 1000)
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as s:
        rows = await asyncio.gather(*(one(s, n, u) for n, u in HEALTH))
    body = "\n".join(f"{'🟢' if ok else '🔴'} <b>{esc(n)}</b> · {c} · {ms} ms" for n, ok, c, ms in rows)
    return f"🛰 <b>Stato ecosistema ZDOS</b>\n{body}\n<i>Controllo eseguito ora dal server ZDOS</i>"


async def _send(message: types.Message, text: str) -> None:
    await message.answer(text, parse_mode="HTML", disable_web_page_preview=True)


@dp.message(Command("radar"))
async def cmd_radar(message: types.Message) -> None:
    await _send(message, await text_radar())


@dp.message(Command("badge"))
async def cmd_badge(message: types.Message, command: CommandObject) -> None:
    await _send(message, await text_badge(command.args))


@dp.message(Command("dev"))
async def cmd_dev(message: types.Message) -> None:
    await _send(message, text_dev())


@dp.message(Command("token"))
async def cmd_token(message: types.Message) -> None:
    await _send(message, await text_token())


@dp.message(Command("velvetstar"))
async def cmd_velvetstar(message: types.Message) -> None:
    await _send(message, await text_velvetstar())


@dp.message(Command("merito"))
async def cmd_merito(message: types.Message, command: CommandObject) -> None:
    await _send(message, await text_merito(command.args))


@dp.message(Command("stato"))
async def cmd_stato(message: types.Message) -> None:
    await _send(message, await text_stato())


@dp.message(Command("aiuto"))
async def cmd_aiuto(message: types.Message) -> None:
    await _send(message, AIUTO)


async def register_commands(bot_obj=None) -> list:
    """setMyCommands (default + it). Nessun messaggio inviato a nessuno."""
    from aiogram.types import BotCommand
    bot_obj = bot_obj or B.bot
    cmds = [BotCommand(command=c, description=d) for c, d in COMMANDS]
    await bot_obj.set_my_commands(cmds)
    await bot_obj.set_my_commands(cmds, language_code="it")
    got = await bot_obj.get_my_commands()
    return [c.command for c in got]


def cli_register() -> int:
    if not B.bot:
        print("ERRORE: bot non configurato (token assente, valore non mostrato)")
        return 1

    async def _run():
        try:
            return await register_commands(B.bot)
        finally:
            await B.bot.session.close()
    print("comandi registrati:", " ".join("/" + c for c in asyncio.run(_run())))
    return 0


if __name__ == "__main__":
    raise SystemExit(cli_register())
