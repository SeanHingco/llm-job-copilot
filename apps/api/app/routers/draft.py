from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, HttpUrl, ValidationError
from typing import Optional, Literal

from app.utils.llm import generate_text
from app.utils.rate_limit import throttle
from app.utils.credits import ensure_daily_free_topup

from app.routers.ingest import ingest as ingest_route
from app.routers.ingest import IngestRequest
from app.routers.resume import extract_resume as extract_route

from app.auth import verify_supabase_session as verify_user
from app.supabase_db import get_user_summary, consume_free_use

import os
from pathlib import Path

bearer = HTTPBearer()
router = APIRouter(prefix="/draft", tags=["draft"])
Task = Literal["bullets", "talking_points", "cover_letter", "alignment"]
PROMPT_DIR = Path(__file__).resolve().parents[4] / "ml" / "prompts"
RL_RUN_FORM_PER_MIN = int(os.getenv("RL_RUN_FORM_PER_MIN", "10"))

class DraftReq(BaseModel):
    task: Task = "bullets"
    url: Optional[HttpUrl] = None
    q: Optional[str] = None
    job_title: Optional[str] = None
    resume: Optional[str] = ""
    job_text: Optional[str] = None 

class UserSummary(BaseModel):
    id: str
    email: str
    plan: str
    free_uses_remaining: int
    created_at: float

async def _run_generation(req: DraftReq) -> dict:
    ingest_payload = IngestRequest(
        url=str(req.url) if req.url is not None else "",
        q=req.q,
        text=req.job_text or None,   # NEW: allow pasted JD
    )
    result = await ingest_route(ingest_payload)

    context = result.get("context") or result.get("context_preview") or ""
    job_title = req.job_title or result.get("title") or ""
    template = load_task_template(req.task)
    prompt = template.format(job_title=job_title, context=context, resume=req.resume or "")

    bullets = await generate_text(prompt)

    provider = (os.getenv("LLM_PROVIDER") or "gemini").strip().lower()
    model_env = {"gemini":"GEMINI_MODEL","openai":"OPENAI_MODEL","groq":"GROQ_MODEL","ollama":"OLLAMA_MODEL"}.get(provider)
    model = (os.getenv(model_env) or "").strip() if model_env else ""

    return {
        "bullets": bullets,
        "prompt": prompt,
        "meta": {
            "provider": provider,
            "model": model,
            "final_url": result.get("final_url"),
            "selected_indices": result.get("selected_indices"),
            "context_chars": result.get("context_chars"),
            "title_from_page": result.get("title"),
        },
    }




def load_task_template(task: str) -> str:
    p = PROMPT_DIR / f"{task}.md"
    if p.exists():
        return p.read_text(encoding="utf-8")
    # fallback
    if task == "bullets":
        return (
            "# System\nYou help a candidate land interviews by producing concise, achievement-focused resume bullets tailored to the job.\n\n"
            "# Rules\n- Exactly 6 bullets, 14–24 words each.\n- Start with a strong verb; no 'I'.\n"
            "- Rewrite using job language; do not copy 5+ words from inputs.\n- Prefer real metrics; don't invent numbers.\n"
            "- Align each bullet to a different requirement from Context. Cite job chunk indices like [0], [2] when relevant.\n\n"
            "# Inputs\nJob Title: {job_title}\nContext:\n{context}\n\nCandidate Resume:\n{resume}\n\n"
            "# Output\nBullets only, one per line (exactly 6)."
        )
    if task == "talking_points":
        return (
            "# System\nYou produce concise talking points for a cover letter or interview.\n\n"
            "# Rules\n- Return 6–8 points, 10–20 words each.\n- Paraphrase using the job’s language; no verbatim copying.\n"
            "- Use resume facts as evidence; don’t invent numbers.\n- Include relevant job keywords naturally.\n\n"
            "# Inputs\nJob Title: {job_title}\nContext:\n{context}\n\nCandidate Resume:\n{resume}\n\n"
            "# Output\nPoints only, one per line."
        )
    raise HTTPException(status_code=400, detail=f"Task '{task}' not implemented yet.")

@router.post("")
async def draft(req: DraftReq):
    # 1) Reuse ingest pipeline to get context (no model yet)
    ingest_payload = IngestRequest(url=req.url, q=req.q)
    result = await ingest_route(ingest_payload)

    context = result.get("context_preview") or ""
    filled_title = req.job_title or result.get("title") or ""
    template = load_task_template(req.task)
    prompt = template.format(
        job_title=filled_title,
        context=context,
        resume=req.resume or "",
    )

    return {
        "prompt": prompt,
        "meta": {
            "final_url": result.get("final_url"),
            "selected_indices": result.get("selected_indices"),
            "context_chars": result.get("context_chars"),
            "title_from_page": result.get("title"),
        }
    }

@router.post("/run")
async def draft_run(req: DraftReq, _creds: HTTPAuthorizationCredentials = Security(bearer), user = Depends(verify_user)):
    # check if user has free uses
    profile: UserSummary = await get_user_summary(user["user_id"])
    credits = int(profile["free_uses_remaining"])

    if credits <= 0:
        raise HTTPException(status_code=402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "message": "You are out of credits.",
            "current_credits": credits
        })

    # call model via provider-agnostic helper
    try:
        data = await _run_generation(req=req)
    except Exception as e:
        # generate_text raises RuntimeError with helpful details; surface them
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")

    remaining = await consume_free_use(user["user_id"])
    if remaining < 0:
        # race: someone else spent the last credit in parallel
        raise HTTPException(
            status_code=402,
            detail={"code": "INSUFFICIENT_CREDITS",
                    "message": "You are out of credits.",
                    "current_credits": credits},
        )

    data["meta"]["remaining_credits"] = remaining
    return data

@router.post("/run-form")
async def draft_run_form(
    url: Optional[str] = Form(None),         # was: HttpUrl = Form(...)
    q: Optional[str] = Form(None),
    job_title: Optional[str] = Form(None),
    resume: Optional[str] = Form(""),
    resume_file: UploadFile | None = File(None),
    job_text: Optional[str] = Form(None),    # NEW
    task: Task = Form("bullets"),
    _creds: HTTPAuthorizationCredentials = Security(bearer),
    user=Depends(verify_user)
):
    _ = await ensure_daily_free_topup(user["user_id"])
    ok, retry = throttle(f"user:{user['user_id']}:run_form", limit=RL_RUN_FORM_PER_MIN, window_sec=60)
    if not ok:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment.",
            headers={
                "Retry-After": str(retry),
                "X-RateLimit-Limit": str(RL_RUN_FORM_PER_MIN),
                "X-RateLimit-Remaining": "0"
            }
        )

    profile: UserSummary = await get_user_summary(user["user_id"])
    credits = int(profile["free_uses_remaining"])

    if credits <= 0:
        raise HTTPException(status_code=402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "message": "You are out of credits.",
            "current_credits": credits
        })

    if resume_file:
        extracted = await extract_route(resume_file)
        resume_text = extracted["text"] or ""
    else:
        resume_text = resume or ""
    
    # check if job description comes from url or raw text
    if not (job_text and job_text.strip()) and not (url and url.strip()):
        raise HTTPException(status_code=400, detail="Provide a job URL or paste the job description.")
    url_for_req: Optional[str] = url if not (job_text and job_text.strip()) else None


    req = DraftReq(
        task=task,
        url=url_for_req,
        q=q,
        job_title=job_title,
        resume=resume_text,
        job_text=job_text,
    )

    data = await _run_generation(req)
    
    remaining = await consume_free_use(user["user_id"])
    if remaining < 0:
        # race: someone else spent the last credit in parallel
        raise HTTPException(
            status_code=402,
            detail={"code": "INSUFFICIENT_CREDITS",
                    "message": "You are out of credits.",
                    "current_credits": credits},
        )

    data["meta"]["remaining_credits"] = remaining
    return data

    

