from fastapi import APIRouter, Request, Depends, Security, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from uuid import UUID, uuid4
from typing import Optional, Dict, Any

from app.auth import verify_supabase_session
from app import supabase_db  # import the helper we just made

router = APIRouter(prefix="/analytics", tags=["analytics"])

bearer = HTTPBearer(auto_error=False)

async def optional_supabase_session(_creds: HTTPAuthorizationCredentials = Security(bearer)):
    if not _creds:
        return None
    try:
        return await verify_supabase_session(authorization=f"Bearer {_creds.credentials}")
    except Exception:
        return None

class CaptureBody(BaseModel):
    name: str
    props: Dict[str, Any] = {}
    path: Optional[str] = None
    anon_id: Optional[str] = None
    client_event_id: Optional[UUID] = None

@router.post("/capture")
async def capture_event(body: CaptureBody, request: Request, user = Depends(optional_supabase_session)):
    client_event_id = str(body.client_event_id or uuid4())
    user_id = (user or {}).get("user_id")
    raw_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    ip = None
    if raw_ip:
        ip = raw_ip.split(",")[0].strip()
    ua = request.headers.get("user-agent")

    anon_id = body.anon_id or f"server-{uuid4()}"

    # print("[analytics.capture] incoming body:", body.dict())
    # print("[analytics.capture] user_id:", user_id, "ip:", ip)

    try:
        ok = await supabase_db.insert_analytics_event(
            name=body.name,
            props=body.props,
            user_id=user_id,
            anon_id=anon_id,
            path=body.path,
            ip=ip,
            ua=ua,
            client_event_id=client_event_id,
        )
        # print("[analytics.capture] insert returned:", ok)
    except Exception as e:
        # This will show in your server logs and in the HTTP response during debugging
        print("[analytics.capture] insert ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=f"insert_analytics_event error: {e!r}")

    return {"ok": ok}
