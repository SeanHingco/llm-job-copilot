import time, logging
from contextlib import contextmanager
log = logging.getLogger("rb")

@contextmanager
def timed(step: str, extra: dict | None = None):
    t0 = time.perf_counter()
    try:
        yield
    finally:
        ms = int((time.perf_counter() - t0) * 1000)
        log.info("step_done", extra={"step": step, "duration_ms": ms, **(extra or {})})