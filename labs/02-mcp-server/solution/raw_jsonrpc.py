"""The MCP stdio protocol with no SDK on the client side: newline-delimited JSON-RPC 2.0.

Spawns server.py, writes requests to its stdin, reads responses from its stdout and prints
both sides verbatim. Standard library only.

    python raw_jsonrpc.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parent / "server.py"
PROTOCOL_VERSION = "2025-11-25"  # an initialize-handshake revision both mcp 1.x and 2.x speak


def main() -> None:
    proc = subprocess.Popen(
        [sys.executable, str(SERVER)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,  # server logs go to stderr; hide them here
        text=True,
        env={**os.environ, "INVENTORY_API_TOKEN": "demo-token"},
    )

    def send(msg: dict) -> None:
        line = json.dumps(msg)
        print(f"\n>>> {line}")
        proc.stdin.write(line + "\n")
        proc.stdin.flush()

    def recv() -> dict:
        line = proc.stdout.readline()
        print(f"<<< {line.strip()[:1200]}")
        return json.loads(line)

    send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {},
        "clientInfo": {"name": "raw-client", "version": "0.1"},
    }})
    recv()
    send({"jsonrpc": "2.0", "method": "notifications/initialized"})  # a notification: no id, no reply

    send({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    recv()

    send({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
          "params": {"name": "lookup_inventory", "arguments": {"sku": "SKU-1002"}}})
    recv()

    send({"jsonrpc": "2.0", "id": 4, "method": "tools/call",
          "params": {"name": "lookup_inventory", "arguments": {"sku": "SKU-1002", "warehouse": "WH-SOUTH"}}})
    recv()

    # A protocol-level error (unknown method) is a JSON-RPC "error", not a result with isError.
    send({"jsonrpc": "2.0", "id": 5, "method": "tools/explode"})
    recv()

    proc.stdin.close()
    proc.wait(timeout=10)


if __name__ == "__main__":
    main()
