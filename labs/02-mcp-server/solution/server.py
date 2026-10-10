"""Lab 02 solution: an MCP server for a small product catalog.

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
    body = {"errorCategory": category, "isRetryable": retryable, "message": message, **extra}
    return CallToolResult(content=[TextContent(type="text", text=json.dumps(body))], isError=True)


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
    """Get the CATALOG ENTRY for one product: name, category, list price, specs, and whether it is
    discontinued. This data changes rarely and says nothing about availability.

    Use for: "what does SKU-1001 cost?", "what are the specs of the headlamp?".
    Do NOT use for "is it in stock?" or "how many are left?" - use lookup_inventory.
    Input: sku in the form SKU-1234. To find a SKU from a product name, read the
    catalog://products resource instead of guessing.
    """
    if (err := _check_sku(sku)) is not None:
        return err
    log.info("lookup_product %s", sku)
    return ok({"sku": sku, **PRODUCTS[sku]})


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=True))
def lookup_inventory(sku: str, warehouse: str | None = None) -> CallToolResult:
    """Get LIVE STOCK COUNTS for one product from the warehouse system: units on hand per
    warehouse (WH-EAST, WH-WEST, WH-SOUTH). Counts change minute to minute.

    Use for: "is SKU-1002 in stock?", "how many are in WH-WEST?".
    Do NOT use for price, specs or descriptions - use lookup_product.
    Input: sku (SKU-1234) and optionally one warehouse code; omit it for all warehouses.
    A count of 0 is a real answer (out of stock), not an error. Errors with
    isRetryable=true are outages: retry once, then report the warehouse as unavailable.
    """
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
# Resources: content the client can read WITHOUT a model-driven tool call
# ---------------------------------------------------------------------------
@mcp.resource("catalog://products", name="product_index", mime_type="application/json",
              description="Index of every product: sku, name, category. Read this to find a SKU.")
def product_index() -> str:
    return json.dumps([{"sku": s, "name": p["name"], "category": p["category"]} for s, p in PRODUCTS.items()])


@mcp.resource("catalog://products/{sku}", name="product_page", mime_type="text/markdown",
              description="One product as a markdown page.")
def product_page(sku: str) -> str:
    p = PRODUCTS.get(sku)
    if p is None:
        raise ValueError(f"unknown sku {sku}")
    specs = "\n".join(f"- {k}: {v}" for k, v in p["specs"].items())
    return f"# {p['name']} ({sku})\n\nCategory: {p['category']}\nPrice: ${p['price_usd']:.2f}\n\n{specs}\n"


# ---------------------------------------------------------------------------
# Prompt: a template the USER picks (in Claude Code it shows up as a slash command)
# ---------------------------------------------------------------------------
@mcp.prompt()
def restock_report(warehouse: str) -> str:
    """Draft a restock report for one warehouse."""
    return (
        f"Using lookup_inventory, list every SKU in catalog://products with 0 units in {warehouse}. "
        "For each, use lookup_product to skip discontinued items. Output a table: sku, name, price."
    )


if __name__ == "__main__":
    log.info("starting (stdio); token %s", "present" if os.environ.get("INVENTORY_API_TOKEN") else "MISSING")
    mcp.run()  # stdio transport by default
