#!/usr/bin/env python3
"""Legge lo stato della PROPRIA antenna Starlink via gRPC locale (192.168.100.1:9200) con starlink-grpc-core
(sparky8512/starlink-grpc-tools, usa la gRPC reflection dell'antenna). Stampa JSON su stdout.
Progetto personale, non affiliato a SpaceX/Starlink. Sola lettura: nessun comando (reboot/stow) viene inviato."""
import json, os, sys
target = os.environ.get("STARLINK_TARGET", "192.168.100.1:9200")
try:
    import starlink_grpc
except ImportError:
    print(json.dumps({"ok": False, "error": "starlink-grpc-core non installato (pip install starlink-grpc-core)"})); sys.exit(0)
import socket
host, _, port = target.rpartition(':')
try:
    socket.create_connection((host, int(port)), timeout=1.5).close()
except OSError as e:
    print(json.dumps({"ok": False, "error": f"antenna non raggiungibile su {target} ({e.__class__.__name__})", "target": target})); sys.exit(0)
try:
    starlink_grpc.REQUEST_TIMEOUT = float(os.environ.get("STARLINK_TIMEOUT", "3"))
    ctx = starlink_grpc.ChannelContext(target=target)
    status, obstruction, alerts = starlink_grpc.status_data(ctx)
    dish_id = str(status.get("id") or "")
    out = {
        "ok": True, "target": target,
        "id": (dish_id[:6] + "…" + dish_id[-4:]) if len(dish_id) > 12 else dish_id,  # ID mascherato
        "hardware": status.get("hardware_version"), "software": status.get("software_version"),
        "state": status.get("state"), "uptime_s": status.get("uptime"),
        "down_bps": status.get("downlink_throughput_bps"), "up_bps": status.get("uplink_throughput_bps"),
        "latency_ms": status.get("pop_ping_latency_ms"), "drop_rate": status.get("pop_ping_drop_rate"),
        "fraction_obstructed": obstruction.get("fraction_obstructed"), "currently_obstructed": obstruction.get("currently_obstructed"),
        "gps_sats": obstruction.get("gps_sats"),
        "alerts": sorted(k.replace("alert_", "") for k, v in (alerts or {}).items() if v),
    }
    print(json.dumps(out))
except Exception as e:  # antenna non raggiungibile, timeout, ecc.
    print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {str(e)[:160]}", "target": target}))
