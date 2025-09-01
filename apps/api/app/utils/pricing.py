import os

PRICE_CATALOG = {
    "pack_100": {
        "kind": "pack",
        "stripe_price": os.getenv("STRIPE_PRICE_PACK_100"),
        "grant": 100,
    },
    "pack_500": {
        "kind": "pack",
        "stripe_price": os.getenv("STRIPE_PRICE_PACK_500"),
        "grant": 500,
    },
    "sub_starter": {
        "kind": "subscription",
        "plan": "starter",
        "monthly_allowance": 100,  # or 50 — pick one source of truth
        "stripe_price": os.getenv("STRIPE_PRICE_SUB_STARTER"),
    },
    "sub_plus": {
        "kind": "subscription",
        "plan": "plus",
        "monthly_allowance": 250,
        "stripe_price": os.getenv("STRIPE_PRICE_SUB_PLUS"),
    },
    "sub_pro": {
        "kind": "subscription",
        "plan": "pro",
        "monthly_allowance": 100000,  # your "unlimited" sentinel
        "stripe_price": os.getenv("STRIPE_PRICE_SUB_PRO"),
    },
}

