from fastapi import APIRouter, Request, Depends, Security
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
    ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    ua = request.headers.get("user-agent")

    ok = await supabase_db.insert_analytics_event(
        name=body.name,
        props=body.props,
        user_id=user_id,
        anon_id=body.anon_id,
        path=body.path,
        ip=ip,
        ua=ua,
        client_event_id=client_event_id,
    )
    return {"ok": ok}
