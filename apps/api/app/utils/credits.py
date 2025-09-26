# app/utils/credits.py
import os
from datetime import datetime, timezone
from app.supabase_db import get_user_summary, set_remaining_and_mark_refill

DAILY_FREE_CREDITS = int(os.getenv("DAILY_FREE_CREDITS", "3"))
FREE_ROLLOVER_CAP  = int(os.getenv("FREE_ROLLOVER_CAP", "20"))

async def ensure_daily_free_topup(user_id: str) -> int:
    """
    Free plan only (non-unlimited):
    - Once per UTC day, ADD DAILY_FREE_CREDITS, but CAP at FREE_ROLLOVER_CAP.
    - Never decrease the balance.
    - Do NOT stamp last_free_refill_at unless we actually add credits.
    Returns the (possibly updated) remaining credits.
    """
    snap = await get_user_summary(user_id) or {}
    plan = (snap.get("plan") or "free").lower()
    unlimited = bool(snap.get("unlimited"))
    remaining = int(snap.get("free_uses_remaining") or 0)
    last = snap.get("last_free_refill_at")

    # Skip for unlimited plans or non-free plans
    if unlimited or plan != "free":
        return remaining

    # Already at/above cap → nothing to do, don't stamp
    if remaining >= FREE_ROLLOVER_CAP:
        return remaining

    # Parse last refill; if already refilled today, do nothing
    last_date = None
    if isinstance(last, str) and last:
        try:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            last_date = last_dt.date()
        except Exception:
            last_date = None

    today = datetime.now(timezone.utc).date()
    if last_date == today:
        return remaining

    # Additive top-up, capped
    new_remaining = min(remaining + DAILY_FREE_CREDITS, FREE_ROLLOVER_CAP)
    if new_remaining == remaining:
        # No change (e.g., DAILY_FREE_CREDITS==0) → don't stamp
        return remaining

    # Persist balance and stamp last_free_refill_at
    updated = await set_remaining_and_mark_refill(user_id, new_remaining)
    try:
        return int(updated.get("free_uses_remaining") or new_remaining)
    except Exception:
        return new_remaining
