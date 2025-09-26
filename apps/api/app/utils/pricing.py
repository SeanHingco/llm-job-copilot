import os
from typing import Optional, TypedDict, Literal

Kind = Literal["pack", "subscription"]

class PriceItem(TypedDict, total=False):
    kind: Kind
    stripe_price: str
    grant: int                   # packs only
    plan: str                    # subscriptions only: "starter" | "plus" | "pro"
    monthly_allowance: int       # subscriptions only
    unlimited: bool

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
    "pack_20": {
        "kind": "pack",
        "stripe_price": _env("STRIPE_PRICE_PACK_20"),
        "grant": 20,
    },
    "pack_60": {
        "kind": "pack",
        "stripe_price": _env("STRIPE_PRICE_PACK_60"),
        "grant": 60,
    },
    "pack_200": {
        "kind": "pack",
        "stripe_price": _env("STRIPE_PRICE_PACK_200"),
        "grant": 200,
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
    "sub_unlimited_monthly": {
        "kind": "subscription",
        "plan": "unlimited",
        "monthly_allowance": 0,  # your “unlimited” sentinel
        "stripe_price": _env("STRIPE_PRICE_UNLIM_MONTHLY"),
        "unlimited": True,
    },
    "sub_unlimited_quarterly": {
        "kind": "subscription",
        "plan": "unlimited",
        "monthly_allowance": 0,  # your “unlimited” sentinel
        "stripe_price": _env("STRIPE_PRICE_UNLIM_QUARTERLY"),
        "unlimited": True,
    },
    "sub_unlimited_yearly": {
        "kind": "subscription",
        "plan": "unlimited",
        "monthly_allowance": 0,  # your “unlimited” sentinel
        "stripe_price": _env("STRIPE_PRICE_UNLIM_YEARLY"),
        "unlimited": True,
    },
}

def is_subscription_key(key: str) -> bool:
    return PRICE_CATALOG.get(key, {}).get("kind") == "subscription"

def is_unlimited_key(key: str) -> bool:
    return bool(PRICE_CATALOG.get(key, {}).get("unlimited"))

def is_unlimited_price_id(price_id: str) -> bool:
    for item in PRICE_CATALOG.values():
        if item.get("stripe_price") == price_id:
            return bool(item.get("unlimited"))
    return False

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
                "unlimited": bool(item.get("unlimited", False)), 
            }
    return None
