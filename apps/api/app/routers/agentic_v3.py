from fastapi import APIRouter, Request
from app.core.flags import use_agentic
from pydantic import BaseModel

router = APIRouter(prefix="/v3", tags=["agentic"])

class DraftIn(BaseModel):
    job_title: str
    context: list[str]
    resume_text: str

@router.post("/draft")
async def draft_controller(payload: DraftIn, request: Request):
    if use_agentic(request):
        # Call agentic v3 drafting logic
        return {"mode": "agentic", "ok": True}
    else:
        # Call standard drafting logic
        return {"mode": "legacy_v2", "ok": True}