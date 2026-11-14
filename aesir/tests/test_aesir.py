"""Offline tests for the Æsir Python layer (no network: RPC calls are stubbed)."""
import importlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "hybrid"))

EVM = "0x" + "11" * 20
SOL_OWNER = "6C61wDacAtx3QHQYVw17fnm5GEaEAnc1XienNJKn2bsD"


def reload_gate(**env):
    keys = [k for k in os.environ if k.startswith(("DSN_", "POLYGON_", "SOLANA_", "VELVET_"))]
    for k in keys:
        os.environ.pop(k)
    os.environ.update(env)
    os.environ["DSN_ENV"] = "/nonexistent"
    import aesir_paths, dsn_gate
    importlib.reload(aesir_paths)
    with mock.patch.object(dsn_gate, "_LEGACY_ENV", Path("/nonexistent")):
        importlib.reload(dsn_gate)
    return dsn_gate


POLY = dict(DSN_CONTRACT="0xfc90516a1f736FaC557e09D8853dB80dA192c296", POLYGON_RPC="https://rpc.invalid")
SOL = dict(DSN_SOLANA_MINT="35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4", SOLANA_RPC="https://sol.invalid")


def acc(a):
    return {"account": {"data": {"parsed": {"info": {"tokenAmount": {"amount": str(a)}}}}}}


def fake_rpc(poly_units=0, sol_units=0, poly_chain=137, sol_indexed=True, sol_mint_for=None):
    by_mint = fake_rpc.by_mint
    def f(rpc, method, params):
        if method == "eth_chainId":
            return hex(poly_chain)
        if method == "eth_call":
            return hex(poly_units)
        if method == "getTokenAccountsByOwner":
            if not sol_indexed:
                raise RuntimeError("Indexed requests require a personal token")
            return {"value": [acc(by_mint.get(params[1]["mint"], sol_units) if by_mint else sol_units)]}
        if method == "getAccountInfo":
            mint = sol_mint_for.get(params[0], SOL["DSN_SOLANA_MINT"]) if sol_mint_for else SOL["DSN_SOLANA_MINT"]
            return {"value": {"data": {"parsed": {"info": {"mint": mint, "owner": SOL_OWNER,
                                                          "tokenAmount": {"amount": str(sol_units)}}}}}}
        raise AssertionError(method)
    return f


fake_rpc.by_mint = None
VELVET = "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump"


class GateTests(unittest.TestCase):
    def setUp(self):
        import dsn_gate
        dsn_gate._CHAIN_OK.clear()
        fake_rpc.by_mint = None

    def tearDown(self):
        fake_rpc.by_mint = None

    def test_velvet_off_by_default(self):
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        fake_rpc.by_mint = {VELVET: 10**15, SOL["DSN_SOLANA_MINT"]: 0}
        with mock.patch.object(g, "_call", side_effect=fake_rpc()):
            self.assertFalse(g._cfg()["velvet"]["enabled"])
            self.assertEqual(g.velvet_balance(SOL_OWNER), 0)
            self.assertFalse(g.has_min_dsn([SOL_OWNER]))

    def test_velvet_enabled_passes_with_scaled_threshold(self):
        g = reload_gate(DSN_CHAIN="both", VELVET_ENABLED="1", **POLY, **SOL)
        self.assertEqual(g._cfg()["velvet"]["min"], 100000 * 10**6)
        fake_rpc.by_mint = {VELVET: 150000 * 10**6, SOL["DSN_SOLANA_MINT"]: 0}
        with mock.patch.object(g, "_call", side_effect=fake_rpc()):
            self.assertTrue(g.has_min_dsn([SOL_OWNER]))
            self.assertEqual(g.get_limit_for([SOL_OWNER]), 500_000_000)
        fake_rpc.by_mint = {VELVET: 99999 * 10**6, SOL["DSN_SOLANA_MINT"]: 0}
        with mock.patch.object(g, "_call", side_effect=fake_rpc()):
            self.assertFalse(g.has_min_dsn([SOL_OWNER]))

    def test_velvet_never_counts_for_evm_wallet(self):
        g = reload_gate(DSN_CHAIN="both", VELVET_ENABLED="1", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=0, sol_units=10**18)):
            self.assertFalse(g.has_min_dsn([EVM]))

    def test_ata_fallback_rejects_wrong_mint(self):
        import solana_ata
        g = reload_gate(DSN_CHAIN="solana", **SOL)
        ata = solana_ata.associated_token_address(SOL_OWNER, SOL["DSN_SOLANA_MINT"])
        with mock.patch.object(g, "_call", side_effect=fake_rpc(sol_units=10**15, sol_indexed=False, sol_mint_for={ata: VELVET})):
            self.assertEqual(g.get_balance(SOL_OWNER), 0)

    def test_ata_missing_account_is_zero(self):
        g = reload_gate(DSN_CHAIN="solana", **SOL)
        def f(rpc, method, params):
            if method == "getTokenAccountsByOwner":
                raise g.RPCError("indexed")
            return {"value": None}
        with mock.patch.object(g, "_call", side_effect=f):
            self.assertEqual(g.get_balance(SOL_OWNER), 0)

    def test_unset_chain_fails_closed(self):
        g = reload_gate(**POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=AssertionError("no RPC expected")):
            self.assertEqual(g.get_balance(EVM), 0)
            self.assertFalse(g.has_min_dsn([EVM, SOL_OWNER]))
            self.assertEqual(g.get_limit_for(EVM), 0)

    def test_thresholds_scale_with_decimals(self):
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        c = g._cfg()
        self.assertEqual(c["polygon"]["min"], 1 * 10**18)
        self.assertEqual(c["polygon"]["high"], 10 * 10**18)
        self.assertEqual(c["solana"]["min"], 1000 * 10**6)
        self.assertEqual(c["solana"]["high"], 10000 * 10**6)

    def test_threshold_override_and_legacy_wei(self):
        g = reload_gate(DSN_CHAIN="both", DSN_SOLANA_MIN_TOKENS="2.5", DSN_MIN_BALANCE_WEI="7", **POLY, **SOL)
        c = g._cfg()
        self.assertEqual(c["solana"]["min"], 2_500_000)
        self.assertEqual(c["polygon"]["min"], 7)

    def test_both_passes_on_polygon_only(self):
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=20 * 10**18, sol_units=0)):
            self.assertTrue(g.has_min_dsn([EVM, SOL_OWNER]))
            self.assertEqual(g.get_limit_for([EVM, SOL_OWNER]), 5_000_000_000)

    def test_both_passes_on_solana_only(self):
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=0, sol_units=1500 * 10**6)):
            self.assertTrue(g.has_min_dsn([EVM, SOL_OWNER]))
            self.assertEqual(g.get_limit_for([EVM, SOL_OWNER]), 500_000_000)

    def test_both_denies_when_neither_meets(self):
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        # 999 SOL-side tokens and 0.5 POL-side tokens: both under threshold
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=5 * 10**17, sol_units=999 * 10**6)):
            self.assertFalse(g.has_min_dsn([EVM, SOL_OWNER]))
            self.assertEqual(g.get_limit_for([EVM, SOL_OWNER]), 0)

    def test_solana_units_never_count_on_polygon_scale(self):
        # 10^9 base units = 1000 SOL-side tokens (passes), but would be 1e-9 on Polygon scale
        g = reload_gate(DSN_CHAIN="both", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=10**9, sol_units=0)):
            self.assertFalse(g.has_min_dsn([EVM]))

    def test_polygon_mode_ignores_solana_wallet(self):
        g = reload_gate(DSN_CHAIN="polygon", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(sol_units=10**15)):
            self.assertFalse(g.has_min_dsn([SOL_OWNER]))

    def test_solana_mode_ignores_evm_wallet(self):
        g = reload_gate(DSN_CHAIN="solana", **POLY, **SOL)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=10**30)):
            self.assertFalse(g.has_min_dsn([EVM]))

    def test_polygon_wrong_chain_id_rejected(self):
        g = reload_gate(DSN_CHAIN="polygon", **POLY)
        with mock.patch.object(g, "_call", side_effect=fake_rpc(poly_units=10**30, poly_chain=1)):
            self.assertEqual(g.get_balance(EVM), 0)

    def test_solana_sums_token_accounts(self):
        g = reload_gate(DSN_CHAIN="solana", **SOL)
        with mock.patch.object(g, "_call", return_value={"value": [acc(60), acc(50)]}) as c:
            self.assertEqual(g.get_balance(SOL_OWNER), 110)
            self.assertEqual(c.call_args[0][1], "getTokenAccountsByOwner")

    def test_solana_falls_back_to_token2022_ata(self):
        import solana_ata
        g = reload_gate(DSN_CHAIN="solana", **SOL)
        seen = []
        def f(rpc, method, params):
            seen.append((method, params))
            return fake_rpc(sol_units=4242, sol_indexed=False)(rpc, method, params)
        with mock.patch.object(g, "_call", side_effect=f):
            self.assertEqual(g.get_balance(SOL_OWNER), 4242)
        ata = solana_ata.associated_token_address(SOL_OWNER, SOL["DSN_SOLANA_MINT"], solana_ata.TOKEN_2022_PROGRAM)
        self.assertEqual(seen[-1], ("getAccountInfo", [ata, {"encoding": "jsonParsed"}]))

    def test_solana_rpc_error_fails_closed(self):
        g = reload_gate(DSN_CHAIN="solana", **SOL)
        with mock.patch.object(g, "_call", side_effect=g.RPCError("boom")):
            self.assertEqual(g.get_balance(SOL_OWNER), 0)

    def test_chain_of(self):
        import dsn_gate
        self.assertEqual(dsn_gate.chain_of(EVM), "polygon")
        self.assertEqual(dsn_gate.chain_of(SOL_OWNER), "solana")
        self.assertIsNone(dsn_gate.chain_of("nope"))


class AtaTests(unittest.TestCase):
    def test_known_vector_token2022(self):
        import solana_ata
        # cross-checked against solders.Pubkey.find_program_address (400 random cases matched)
        self.assertEqual(solana_ata.associated_token_address(SOL_OWNER, "35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4"),
                         "DHfKZHhEqYnrnFi9Rb2nPssye2Fjo27vQdRpLHcYAmid")

    def test_base58_roundtrip(self):
        import solana_ata
        for s in (SOL_OWNER, "11111111111111111111111111111111"):
            self.assertEqual(solana_ata.b58encode(solana_ata.b58decode(s)), s)


class HybridTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        os.environ["AESIR_LOG_DIR"] = self.tmp
        os.environ["AESIR_SOCK_DIR"] = self.tmp
        reload_gate()
        import hybrid_core
        self.h = importlib.reload(hybrid_core)

    def intent(self, **kw):
        base = {"asset": "ZEPH", "amount_atomic": 10, "destination": EVM, "network_constraints": ["tor"], "requester": "kira"}
        base.update(kw)
        return base

    def test_non_human_without_requester_wallet_denied(self):
        r = self.h.handle_intent(self.intent(), policy=lambda i: {"approved": True}, sign=lambda *a: None)
        self.assertFalse(r["approved"])

    def test_gate_uses_requester_not_destination(self):
        seen = []
        with mock.patch.object(self.h, "has_min_dsn", side_effect=lambda w: seen.append(w) or False):
            r = self.h.handle_intent(self.intent(requester_wallet="0x" + "22" * 20, requester_wallets=[SOL_OWNER]),
                                     policy=lambda i: {"approved": True}, sign=lambda *a: None)
        self.assertEqual(seen, [["0x" + "22" * 20, SOL_OWNER]])
        self.assertEqual(r["reason"], "Insufficient DSN")

    def test_approved_intent_is_forwarded(self):
        signed = []
        with mock.patch.object(self.h, "has_min_dsn", return_value=True), \
             mock.patch.object(self.h, "get_limit_for", return_value=777):
            r = self.h.handle_intent(self.intent(requester_wallet=EVM),
                                     policy=lambda i: {"approved": i["hourly_limit_override"] == 777},
                                     sign=lambda a, i: signed.append(i))
        self.assertTrue(r["approved"])
        self.assertEqual(len(signed), 1)

    def test_paths_follow_env(self):
        import aesir_paths
        self.assertEqual(str(aesir_paths.LOG_DIR), self.tmp)
        self.assertEqual(aesir_paths.POLICY_BIN, ROOT / "policy/target/release/policy_engine")


class PolicyBinaryTests(unittest.TestCase):
    BIN = ROOT / "policy/target/release/policy_engine"

    @unittest.skipUnless(BIN.exists(), "build policy_engine first")
    def test_binary_roundtrip(self):
        run = lambda s: json.loads(subprocess.run([str(self.BIN)], input=s.encode(), capture_output=True).stdout)
        ok = run(json.dumps({"asset": "ZEPH", "amount_atomic": 1000000, "destination": "x",
                             "network_constraints": ["tor"], "requester": "kira"}))
        self.assertTrue(ok["approved"])
        self.assertFalse(run("garbage")["approved"])


if __name__ == "__main__":
    unittest.main()
