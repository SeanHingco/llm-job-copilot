from __future__ import annotations
import os, httpx
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TypedDict

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

class PremiumStatus(TypedDict):
    active: bool
    expires_at: Optional[str]
    days_left: Optional[int]

class Draft(TypedDict):
    # id: uuid (auto)
    user_id: str
    resume_text: str
    job_description_text: str       # Full text for user display
    job_description_context: str    # RAG chunks/context used for generation
    outputs_json: Dict[str, Any]
    model_version: str
    # optional metadata
    company_name: Optional[str]
    job_title: Optional[str]
    job_link: Optional[str]
    resume_label: Optional[str]
    bender_score: Optional[float] 
    # created_at, updated_at handled by DB/default

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

async def _rest_get_latest_premium_entitlement(user_id: str) -> Optional[dict]:
    """
    GET /rest/v1/entitlements?user_id=eq.<uid>&kind=eq.premium&select=expires_at&order=expires_at.desc&limit=1
    """
    params = {
        "user_id": f"eq.{user_id}",
        "kind": "eq.premium",
        "select": "expires_at",
        "order": "expires_at.desc",
        "limit": "1",
    }
    headers = {**HEADERS, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{REST}/entitlements", params=params, headers=headers)
        r.raise_for_status()
        rows = r.json() or []
        return rows[0] if rows else None

async def get_premium_override(user_id: str) -> PremiumStatus:
    row = await _rest_get_latest_premium_entitlement(user_id)
    if not row or not row.get("expires_at"):
        return {"active": False, "expires_at": None, "days_left": None}
    exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
    active = exp > now_utc()
    days_left = max(0, (exp - now_utc()).days)
    return {"active": bool(active), "expires_at": exp.isoformat(), "days_left": days_left}


async def upsert_user(user_id: str, email: str|None=None, name: str|None=None) -> None:
    payload = {"id": user_id}
    if email and email.strip(): payload["email"] = email.strip()
    if name and name.strip():  payload["full_name"] = name.strip()
    params  = {"on_conflict": "id"}
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/users", params=params, headers=headers, json=payload)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"users upsert failed: {r.status_code} {r.text}")

async def get_user_summary(user_id: str) -> dict:
    params = {"id": f"eq.{user_id}", "select": "id,email,plan,free_uses_remaining,unlimited,full_name,created_at"}
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

async def ensure_user_identity(user_id: str, email: str | None = None, name: str | None = None) -> None:
    """
    Make sure a row exists in users(id, ...).
    - If no row: insert with id (+ email/name if provided)
    - If row exists: PATCH only email/name if they changed
    Never touches plan/unlimited/credits.
    """
    snap = await get_user_summary(user_id) or {}

    if not snap:
        # create minimal row
        payload = [{"id": user_id}]
        if email is not None:
            payload[0]["email"] = email
        if name is not None:
            payload[0]["full_name"] = name

        headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(f"{REST}/users", headers=headers, json=payload)
            r.raise_for_status()
        return

    # already exists → update identity fields only if changed
    patch: Dict[str, Any] = {}
    if email and email != snap.get("email"):
        patch["email"] = email
    if name and name != snap.get("full_name"):
        patch["full_name"] = name

    if patch:
        params  = {"id": f"eq.{user_id}"}
        headers = {**HEADERS, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.patch(f"{REST}/users", params=params, headers=headers, json=patch)
            r.raise_for_status()

# at bottom of supabase_db.py

async def insert_analytics_event(
    name: str,
    props: dict[str, Any] | None = None,
    *,
    user_id: str | None = None,
    anon_id: str | None = None,
    path: str | None = None,
    ip: str | None = None,
    ua: str | None = None,
    client_event_id: str | None = None,
) -> bool:
    """
    Insert a row into analytics_events. Returns True if inserted, False if duplicate ignored.
    """
    row = {
        "name": name,
        "props": props or {},
        "path": path,
        "anon_id": anon_id,
        "user_id": user_id,
        "ip": ip,
        "ua": ua,
        "client_event_id": client_event_id,
    }

    headers = {**HEADERS, "Prefer": "resolution=ignore-duplicates"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/analytics_events", headers=headers, json=[row])

    if r.status_code in (201, 204):
        return r.status_code == 201  # 201 → new insert, 204 → duplicate ignored
    else:
        # optional: log error somewhere
        print("insert_analytics_event error:", r.status_code, r.text[:200])
        return False

async def referrer_exists(code: str) -> bool:
    params = {"code": f"eq.{code}", "select": "code", "limit": "1"}
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{REST}/referrers", params=params, headers=HEADERS)
        r.raise_for_status()
        rows = r.json() or []
        return bool(rows)

async def insert_referral_click(*, code: str, click_id: str, ip: str, ua: str) -> None:
    payload = [{
        "code": code,
        "click_id": click_id,
        "ip": ip,
        "ua": ua,
        "created_at": datetime.now(timezone.utc).isoformat()
    }]
    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.post(f"{REST}/referrals", headers=HEADERS, json=payload)
        r.raise_for_status()

async def create_draft(draft: Draft) -> Dict[str, Any]:
    """
    Insert a new draft into public.drafts.
    Returns the created row representation.
    """
    headers = {**HEADERS, "Prefer": "return=representation"} 
    # Ensure user_id is set
    if not draft.get("user_id"):
        raise ValueError("create_draft requires user_id")

    payload = {
        "user_id": draft["user_id"],
        "resume_text": draft["resume_text"],
        "job_description_text": draft["job_description_text"],
        "job_description_context": draft.get("job_description_context") or "",
        "outputs_json": draft["outputs_json"],
        "model_version": draft["model_version"],
        "company_name": draft.get("company_name"),
        "job_title": draft.get("job_title"),
        "job_link": draft.get("job_link"),
        "resume_label": draft.get("resume_label"),
        "bender_score": draft.get("bender_score"),
        # created_at/updated_at default to now() in DB
    }

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{REST}/drafts", headers=headers, json=payload)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else {}

async def get_drafts(user_id: str, limit: int = 50) -> list[Dict[str, Any]]:
    """
    Get drafts for a user, ordered by created_at desc.
    """
    params = {
        "user_id": f"eq.{user_id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{REST}/drafts", params=params, headers=HEADERS)
        r.raise_for_status()
        return r.json() or []
