# Stato reale di zdos-hybrid (audit 14/11/2026, branch dsnx/sanitize)

Questo repo contiene prototipi. Le voci marcate **MOCK** non fanno ciò che il nome promette.

| Percorso | Stato | Nota |
| --- | --- | --- |
| `zlang/src/runtime.rs` (`execute`, `execute_with_vars`) | **MOCK** | esegue un programma vuoto e restituisce sempre `result: 0.0` |
| `cortex/src/policy.rs` | dipende dal mock | il test `zlang_policy_allows_non_null_block` fallisce proprio per questo |
| `organism-bin` | compila, va in panic | il parser ZLang non accetta il sorgente di esempio (`Err(Eof)`) |
| `miner/` | **DEMO** | PoW SHA-256 giocattolo: un blocco, difficoltà `0000`, transazione finta, ACK solo su 127.0.0.1 |
| `llm-mock.py` | **MOCK** | eco fisso, non è un LLM (ora ascolta solo su 127.0.0.1) |
| `zdos_master_dashboard.py`, `zdos_omni_os.py` | **MOCK parziale** | CPU casuale e stati fissi; vero solo il prezzo $DSN da DexScreener. Bridge 8888 ora su 127.0.0.1 (`ZDOS_BRIDGE_HOST`) |
| `z_kali_*.py` | **MOCK** | chat con risposte preconfezionate/casuali, nessun LLM né Telegram |
| `webapp/` | statico | pagina vetrina senza chiamate API |
| `zdos_bridge.py`, `src/neural/z_kali_cortex.py` | reale, minimo | append JSONL locale senza hash né firma |
| `autobuild-*.sh`, `zdos-*.sh` | sperimentale | riscrivono file: non eseguire senza revisione |

Il linguaggio ZLang reale è nel submodule `Zlang` (`high-cde/Zlang`, `tools/zlangc.py`).
