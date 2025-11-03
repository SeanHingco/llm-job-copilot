from fastapi import Request
from settings import settings

def use_agentic(request: Request) -> bool:
    # Request-level override:
    # - header:  X-RB-Agentic: 1
    # - query:   ?agentic=1
    q = request.query_params.get("agentic")
    if q is not None:
        return q == "1"
    h = request.headers.get("X-RB-Agentic")
    if h is not None:
        return h == "1"
    # Global env flag
    return bool(settings.RB_AGENTIC)