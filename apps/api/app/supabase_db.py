from __future__ import annotations
import os, httpx
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Any, Dict

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY  = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

async def upsert_user(user_id: str, email: str) -> None:
    payload = {"id": user_id, "email": email}
    params  = {"on_conflict": "id"}
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/users", params=params, headers=headers, json=payload)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"users upsert failed: {r.status_code} {r.text}")

async def get_user_summary(user_id: str) -> dict:
    params = {"id": f"eq.{user_id}", "select": "id,email,plan,free_uses_remaining,unlimited,created_at"}
    headers = {**HEADERS, "Accept": "application/vnd.pgrst.object+json"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{REST}/users", params=params, headers=headers)
        if r.status_code == 406:
            return {}
        r.raise_for_status()
        return r.json()

async def consume_free_use(user_id: str) -> int:
    """Decrement one credit atomically. Return remaining; return -1 if none left (no decrement)."""
    payload = {"uid": user_id}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/rpc/consume_free_use", headers=HEADERS, json=payload)

    if r.status_code != 200:
        raise RuntimeError(f"consume_free_use failed: {r.status_code} {r.text}")

    data = r.json()
    if isinstance(data, int):
        return int(data)
    if isinstance(data, dict) and "consume_free_use" in data:
        return int(data["consume_free_use"])
    # null or unexpected → treat as “no decrement”
    return -1

async def set_plan_and_grant(
    user_id: str,
    plan: str,
    allowance: int,
    *,
    unlimited: bool = False,
    overwrite_credits: bool = True,
) -> dict:
    """
    Update the user's plan/unlimited flag and (optionally) overwrite credits.

    - If overwrite_credits is False, we leave free_uses_remaining untouched.
    - For unlimited plans, you’ll typically call with overwrite_credits=False.
    """
    payload: Dict[str, Any] = {
        "plan": plan,
        "unlimited": bool(unlimited),
    }
    if overwrite_credits:
        payload["free_uses_remaining"] = int(allowance)

    params  = {"id": f"eq.{user_id}"}
    headers = {**HEADERS, "Prefer": "return=representation"}

    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.patch(f"{REST}/users", params=params, headers=headers, json=payload)
        r.raise_for_status()
        body = r.json()
        return body[0] if isinstance(body, list) else body
    
async def upsert_customer(user_id: str, stripe_customer_id: str) -> None:
    """
    Insert or update the mapping of your user -> Stripe customer id
    Uses PostgREST upsert with primary key 'id'.
    """
    payload = [{"id": user_id, "stripe_customer_id": stripe_customer_id}]
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/customers", headers=headers, json=payload)
        r.raise_for_status()

async def get_stripe_customer_id(user_id: str) -> str | None:
    params = {"id": f"eq.{user_id}", "select": "stripe_customer_id"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{REST}/customers", params=params, headers=HEADERS)
        r.raise_for_status()
        rows = r.json()
        return rows[0].get("stripe_customer_id") if rows else None

async def get_user_id_by_customer(stripe_customer_id: str) -> str | None:
    params = {"stripe_customer_id": f"eq.{stripe_customer_id}", "select": "id"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{REST}/customers", params=params, headers=HEADERS)
        r.raise_for_status()
        rows = r.json()
        return rows[0]["id"] if rows else None

async def insert_webhook_event_once(eid: str, etype: str) -> bool:
    """
    Try to insert the event id once. Returns True if inserted (first time),
    False if it already existed.
    """
    headers = {**HEADERS, "Prefer": "resolution=ignore-duplicates"}
    params  = {"on_conflict": "id"}
    payload = [{"id": eid, "type": etype}]
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/webhook_events", params=params, headers=headers, json=payload)
        if r.status_code in (201, 204):
            # 201 -> inserted; 204 -> ignored duplicate (depending on config)
            return r.status_code == 201
        r.raise_for_status()
        return False

async def set_remaining_and_mark_refill(user_id: str, remaining: int) -> dict:
    """
    Update free_uses_remaining and last_free_refill_at in one PATCH.
    Returns the updated row.
    """
    payload = {
        "free_uses_remaining": int(remaining),
        "last_free_refill_at": datetime.now(timezone.utc).isoformat(),
    }
    params  = {"id": f"eq.{user_id}"}
    headers = {**HEADERS, "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.patch(f"{REST}/users", params=params, headers=headers, json=payload)
        r.raise_for_status()
        j = r.json()
        return j[0] if isinstance(j, list) else j
