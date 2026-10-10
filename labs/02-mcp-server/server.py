"""STARTER - Lab 02: an MCP server for a small product catalog. Fill in the TODOs.
The finished version is solution/server.py.

Exposes:
  tools      lookup_product     static catalog facts for ONE sku (price, specs)
             lookup_inventory   LIVE stock counts for ONE sku, per warehouse
  resource   catalog://products             the whole catalog index (sku, name, category)
  template   catalog://products/{sku}       one product rendered as markdown
  prompt     restock_report(warehouse)      a reusable, user-invoked prompt

Run it directly (stdio):  python server.py
Talk to it:               python test_client.py      or      python raw_jsonrpc.py

stdout is the JSON-RPC channel. Anything else printed to stdout corrupts the
protocol, so every log line goes to stderr.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys

# mcp >= 2.0 renamed FastMCP to MCPServer. mcp 1.x still has FastMCP. The
# decorators used below (tool / resource / prompt / run) behave the same in both.
try:
    from mcp.server.mcpserver import MCPServer  # mcp >= 2
except ImportError:  # pragma: no cover - exercised with mcp<2
    from mcp.server.fastmcp import FastMCP as MCPServer  # mcp 1.x

from mcp.types import CallToolResult, TextContent, ToolAnnotations

logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="[catalog-server] %(message)s")
log = logging.getLogger("catalog")

mcp = MCPServer("catalog")  # Claude Code names its tools mcp__catalog__<tool>

# ---------------------------------------------------------------------------
# Fake data
# ---------------------------------------------------------------------------
PRODUCTS = {
    "SKU-1001": {"name": "Trail Runner 2 shoe", "category": "footwear", "price_usd": 129.0,
                 "specs": {"weight_g": 280, "drop_mm": 6}, "discontinued": False},
    "SKU-1002": {"name": "Merino base layer", "category": "apparel", "price_usd": 79.0,
                 "specs": {"material": "100% merino"}, "discontinued": False},
    "SKU-1003": {"name": "Headlamp 400lm", "category": "gear", "price_usd": 49.5,
                 "specs": {"lumens": 400, "battery": "USB-C"}, "discontinued": True},
}
STOCK = {
    "SKU-1001": {"WH-EAST": 42, "WH-WEST": 0},
    "SKU-1002": {"WH-EAST": 7, "WH-WEST": 15},
    "SKU-1003": {"WH-EAST": 0, "WH-WEST": 0},
}
DOWN_WAREHOUSES = {"WH-SOUTH"}  # simulates an outage
SKU_RE = re.compile(r"^SKU-\d{4}$")


# ---------------------------------------------------------------------------
# Helpers: one success shape, one error shape
# ---------------------------------------------------------------------------
def ok(data: dict) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=json.dumps(data))])


def tool_error(category: str, message: str, *, retryable: bool, **extra) -> CallToolResult:
    """isError=true tells the client 'this tool call failed' (a result, not a protocol error).

    The JSON body tells the model WHAT failed and whether retrying makes sense.
    """
    # TODO(2): return a structured body {errorCategory, isRetryable, message, **extra} AND set
    # isError=True on the CallToolResult. Right now the model gets a useless generic string and
    # the client can't even tell the call failed.
    return CallToolResult(content=[TextContent(type="text", text="Operation failed")])


def _check_sku(sku: str) -> CallToolResult | None:
    if not SKU_RE.match(sku):
        return tool_error("validation", f"sku must look like SKU-1234, got {sku!r}.", retryable=False)
    if sku not in PRODUCTS:
        return tool_error("validation", f"No product {sku}. Read resource catalog://products for valid SKUs.",
                          retryable=False)
    return None


# ---------------------------------------------------------------------------
# Tools: two similar-sounding lookups, separated by their descriptions
# ---------------------------------------------------------------------------
@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
def lookup_product(sku: str) -> CallToolResult:
    """Looks up a product."""
    # TODO(1): this description is all Claude gets to choose between the two tools. Say what it
    # returns (catalog facts: price, specs, discontinued), when to use it, when NOT to (stock ->
    # lookup_inventory), the input format, and where to find SKUs (catalog://products).
    if (err := _check_sku(sku)) is not None:
        return err
    log.info("lookup_product %s", sku)
    return ok({"sku": sku, **PRODUCTS[sku]})


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=True))
def lookup_inventory(sku: str, warehouse: str | None = None) -> CallToolResult:
    """Looks up product information."""
    # TODO(1): differentiate from lookup_product: LIVE stock per warehouse, 0 is a valid answer,
    # isRetryable errors mean "retry once".
    if (err := _check_sku(sku)) is not None:
        return err
    if not os.environ.get("INVENTORY_API_TOKEN"):
        return tool_error("permission", "Inventory API token missing on the server (INVENTORY_API_TOKEN).",
                          retryable=False, customerMessage="Stock levels are unavailable right now.")
    if warehouse in DOWN_WAREHOUSES:
        return tool_error("transient", f"{warehouse} inventory service timed out after 2s.", retryable=True,
                          attempted={"sku": sku, "warehouse": warehouse})
    counts = STOCK[sku] if warehouse is None else {warehouse: STOCK[sku].get(warehouse, 0)}
    log.info("lookup_inventory %s %s", sku, warehouse or "*")
    return ok({"sku": sku, "on_hand": counts, "total": sum(counts.values())})


# ---------------------------------------------------------------------------
# TODO(3): RESOURCE catalog://products - JSON list of {sku, name, category} for every product.
#          Use @mcp.resource("catalog://products", name=..., mime_type="application/json",
#          description=...). This lets a client see the catalog without exploratory tool calls.
# TODO(4): RESOURCE TEMPLATE catalog://products/{sku} - one product as markdown. A URI with a
#          {param} becomes a template; the function takes `sku: str`.
# TODO(5): PROMPT restock_report(warehouse: str) -> str with @mcp.prompt().
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # TODO(6): this print() goes to stdout, the JSON-RPC channel. Run test_client.py and watch it
    # break, then remove it (log to stderr instead, as `log` already does).
    print("catalog server starting")
    log.info("starting (stdio); token %s", "present" if os.environ.get("INVENTORY_API_TOKEN") else "MISSING")
    mcp.run()  # stdio transport by default
