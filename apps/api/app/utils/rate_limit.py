# api/app/utils/rate_limit.py
from collections import deque
import time
from typing import Tuple

# key -> timestamps (seconds)
_BUCKETS: dict[str, deque[float]] = {}

def throttle(key: str, *, limit: int, window_sec: int) -> Tuple[bool, int]:
    """
    Return (allowed, retry_after_seconds).
    Sliding-window: keep request timestamps and evict old ones.
    """
    now = time.time()
    q = _BUCKETS.get(key)
    if q is None:
        q = deque()
        _BUCKETS[key] = q

    # drop anything outside the window
    cutoff = now - window_sec
    while q and q[0] < cutoff:
        q.popleft()

    if len(q) >= limit:
        # when would the oldest fall out of window?
        retry_after = max(1, int(q[0] + window_sec - now))
        return (False, retry_after)

    q.append(now)
    return (True, 0)

def throttle_multi(key_base: str) -> Tuple[bool, int]:
    """
    Apply burst (per-minute) and sustained (per-hour) limits.
    Returns (allowed, retry_after_seconds).
    """
    # tune these defaults as you like
    BURST_LIMIT = 10     # requests / minute
    SUSTAIN_LIMIT = 120  # requests / hour

    ok1, r1 = throttle(f"{key_base}:1m", limit=BURST_LIMIT,  window_sec=60)
    ok2, r2 = throttle(f"{key_base}:1h", limit=SUSTAIN_LIMIT, window_sec=3600)

    if ok1 and ok2:
        return True, 0
    # tell client the longest time to wait
    return False, max(r1, r2)
