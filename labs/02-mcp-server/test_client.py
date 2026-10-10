"""Talk to server.py over stdio with the official MCP Python client and print what comes back.

No API key, no model. This is what Claude Code (the "host") does behind the scenes before
Claude ever sees a tool: spawn the server, handshake, discover, then call.

    python test_client.py               # uses ./server.py
    python test_client.py path/to/server.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = Path(__file__).resolve().parent


async def dump(title: str, awaitable) -> None:
    """Await one request and print the result the way it travels on the wire
    (camelCase aliases, no nulls). A failure is printed and the walk-through continues,
    so this also works against the half-finished starter server."""
    print(f"\n=== {title} ===")
    try:
        obj = await awaitable
    except Exception as e:  # protocol-level error (JSON-RPC "error"), not an isError result
        print(f"!! {type(e).__name__}: {e}")
        return
    data = obj.model_dump(mode="json", by_alias=True, exclude_none=True) if hasattr(obj, "model_dump") else obj
    print(json.dumps(data, indent=2)[:2500])


async def main(server_path: Path) -> None:
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(server_path)],
        # What .mcp.json's "env" block does: hand the server its credentials.
        env={**os.environ, "INVENTORY_API_TOKEN": os.environ.get("INVENTORY_API_TOKEN", "demo-token")},
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            # 1. Handshake: protocol version + capabilities in both directions.
            await dump("initialize -> result (server capabilities)", session.initialize())

            # 2. Discovery. A host does this at connect time; Claude then sees every tool at once.
            await dump("tools/list", session.list_tools())
            await dump("resources/list", session.list_resources())
            await dump("resources/templates/list", session.list_resource_templates())
            await dump("prompts/list", session.list_prompts())

            # 3. Reads and calls.
            await dump("resources/read catalog://products", session.read_resource("catalog://products"))
            await dump("resources/read catalog://products/SKU-1002", session.read_resource("catalog://products/SKU-1002"))
            await dump("prompts/get restock_report", session.get_prompt("restock_report", {"warehouse": "WH-WEST"}))

            await dump("tools/call lookup_product SKU-1001 (success)", session.call_tool("lookup_product", {"sku": "SKU-1001"}))
            await dump("tools/call lookup_inventory SKU-1003 (valid empty: 0 units)", session.call_tool("lookup_inventory", {"sku": "SKU-1003"}))
            await dump("tools/call lookup_product SKU-9 (validation error, isError=true)", session.call_tool("lookup_product", {"sku": "SKU-9"}))
            await dump("tools/call lookup_inventory WH-SOUTH (transient error, isRetryable=true)", session.call_tool("lookup_inventory", {"sku": "SKU-1001", "warehouse": "WH-SOUTH"}))
            await dump("tools/call lookup_product with NO arguments (SDK-level argument validation)", session.call_tool("lookup_product", {}))


if __name__ == "__main__":
    target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "server.py"
    asyncio.run(main(target))
