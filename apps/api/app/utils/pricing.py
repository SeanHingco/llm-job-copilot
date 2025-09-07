import os
from typing import Optional, TypedDict, Literal

Kind = Literal["pack", "subscription"]

class PriceItem(TypedDict, total=False):
    kind: Kind
    stripe_price: str
    grant: int                   # packs only
    plan: str                    # subscriptions only: "starter" | "plus" | "pro"
    monthly_allowance: int       # subscriptions only

def _env(name: str) -> str:
    val = os.getenv(name, "")
    if not val:
        # Don’t crash; just warn so staging still runs.
        print(f"[pricing] WARNING: {name} is not set")
    return val

PRICE_CATALOG: dict[str, PriceItem] = {
    "pack_100": {
        "kind": "pack",
        "stripe_price": _env("STRIPE_PRICE_PACK_100"),
        "grant": 100,
    },
    "pack_500": {
        "kind": "pack",
        "stripe_price": _env("STRIPE_PRICE_PACK_500"),
        "grant": 500,
    },
    "sub_starter": {
        "kind": "subscription",
        "plan": "starter",
        "monthly_allowance": 100,
        "stripe_price": _env("STRIPE_PRICE_STARTER_MONTHLY"),
    },
    "sub_plus": {
        "kind": "subscription",
        "plan": "plus",
        "monthly_allowance": 250,
        "stripe_price": _env("STRIPE_PRICE_PLUS_MONTHLY"),
    },
    "sub_pro": {
        "kind": "subscription",
        "plan": "pro",
        "monthly_allowance": 100000,  # your “unlimited” sentinel
        "stripe_price": _env("STRIPE_PRICE_PRO_MONTHLY"),
    },
}

def is_subscription_key(key: str) -> bool:
    return PRICE_CATALOG.get(key, {}).get("kind") == "subscription"

def resolve_subscription_by_price_id(price_id: str) -> Optional[dict]:
    """
    Given a Stripe price ID from an invoice/subscription, return the plan + allowance.
    """
    for key, item in PRICE_CATALOG.items():
        if item.get("kind") == "subscription" and item.get("stripe_price") == price_id:
            return {
                "key": key,
                "plan": item["plan"],
                "monthly_allowance": int(item["monthly_allowance"]),
            }
    return None
