# app/utils/credits.py
import os
from datetime import datetime, timezone
from app.supabase_db import get_user_summary, set_remaining_and_mark_refill

DAILY_FREE_CREDITS = int(os.getenv("DAILY_FREE_CREDITS", "6"))

async def ensure_daily_free_topup(user_id: str) -> int:
    """
    For Free plan only:
    - Once per UTC day, ensure the user's credits are at least DAILY_FREE_CREDITS.
    - Non-cumulative: never reduce higher balances.
    Returns the (possibly updated) remaining credits.
    """
    snap = await get_user_summary(user_id) or {}
    plan = (snap.get("plan") or "free").lower()
    remaining = int(snap.get("free_uses_remaining") or 0)
    last = snap.get("last_free_refill_at")

    if plan != "free":
        return remaining

    # parse last refill date
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

    target = DAILY_FREE_CREDITS
    new_remaining = remaining if remaining >= target else target
    updated = await set_remaining_and_mark_refill(user_id, new_remaining)
    return int(updated.get("free_uses_remaining") or new_remaining)
