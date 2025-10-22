from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, HttpUrl, ValidationError
from typing import Optional, Literal

from app.utils.llm import generate_text
from app.utils.rate_limit import throttle, throttle_multi
from app.utils.credits import ensure_daily_free_topup

from app.routers.ingest import ingest as ingest_route
from app.routers.ingest import IngestRequest
from app.routers.resume import extract_resume as extract_route

from app.auth import verify_supabase_session as verify_user
from app.supabase_db import get_user_summary, consume_free_use, insert_analytics_event

import os
from pathlib import Path
from string import Template
import time

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
    unlimited: bool  
    created_at: float


def safe_format(template: str, **kwargs) -> str:
    """Format only known {tokens}; leave unknown {…} intact (so JSON/code stays valid)."""
    class _SafeDict(dict):
        def __missing__(self, key):
            return "{" + key + "}"
    return template.format_map(_SafeDict(**kwargs))

async def _log_event_safe(
    request: Request | None,
    *,
    user_id: str | None,
    name: str,
    props: dict
):
    """Fire-and-forget analytics; never raises."""
    try:
        ip = None
        ua = None
        if request is not None:
            ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
            ua = request.headers.get("user-agent")
        await insert_analytics_event(
            name=name,
            props=props,
            user_id=user_id,
            anon_id=None,          # we have a logged-in user here
            path="/draft/run-form",
            ip=ip,
            ua=ua,
            client_event_id=None,  # backend events don’t need dedupe id
        )
    except Exception:
        pass


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
    jd_keywords = ""
    # if your ingest adds something like result["target_keywords"], you can do:
    # if isinstance(result.get("target_keywords"), list):
    #     jd_keywords = ", ".join(map(str, result["target_keywords"]))

    prompt = fill_prompt(
        template,
        job_title=job_title,
        context=context,
        resume=req.resume or "",
        jd_keywords=jd_keywords,
    )

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

def _is_readable(s: str) -> bool:
    s = (s or "").strip()
    if len(s) < 200:               # too short to be a resume
        return False
    # heuristic: require mostly word-ish characters
    import re
    letters = len(re.findall(r"[A-Za-z]", s))
    return letters / max(1, len(s)) > 0.20

def fill_prompt(template: str, *, job_title: str, context: str, resume: str, jd_keywords: str = "") -> str:
    # 1) $… placeholders
    t = Template(template).safe_substitute(
        job_title=job_title,
        context=context,
        resume=resume,
        jd_keywords=jd_keywords,
    )
    # 2) literal {…} tokens you intentionally support
    # (avoids str.format parsing of arbitrary braces in prose/JSON)
    mapping = {
        "{job_title}": job_title,
        "{context}": context,
        "{resume}": resume,
        "{jd_keywords}": jd_keywords,
    }
    for k, v in mapping.items():
        t = t.replace(k, v)
    return t



def load_task_template(task: str) -> str:
    p = PROMPT_DIR / f"{task}.md"

    p_v2 = PROMPT_DIR / f"{task}_v2.md"
    if p_v2.exists():
        print(f'found v2. using v2 mode for {task}')
        return p_v2.read_text(encoding="utf-8")
    if p.exists():
        print(f"no v2 found, using v1 fallback for {task}")
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
    request: Request,
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
    user_id = user["user_id"]

    # 0) Rate limit FIRST (burst + sustained), per user+task
    ok, retry = throttle_multi(f"user:{user_id}:task:{task}")
    if not ok:
        await _log_event_safe(request,
                              user_id=user["user_id"],
                              name="rate_limited",
                              props={"endpoint": "draft/run-form", "task": task, "retry_after": retry})
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached. Please try again shortly.",
            headers={"Retry-After": str(retry)},
        )

    # 1) Load profile ONCE
    profile: UserSummary = await get_user_summary(user_id)
    is_unlimited = bool(profile.get("unlimited"))
    credits = int(profile.get("free_uses_remaining") or 0)

    # 2) If not unlimited, apply lazy daily top-up and recheck credits
    if not is_unlimited:
        credits = await ensure_daily_free_topup(user_id)
        if credits <= 0:
            await _log_event_safe(request,
                              user_id=user["user_id"],
                              name="out_of_credits_shown",
                              props={"endpoint": "draft/run-form"})
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "You are out of credits.",
                    "current_credits": credits,
                },
            )

    # 3) Extract resume text if a file was uploaded
    text_from_form = (resume or "").strip()
    text_from_file = ""
    if resume_file:
        extracted = await extract_route(resume_file)
        text_from_file = (extracted.get("text") or "").strip()

    resume_text = text_from_form or text_from_file

    # 4) Validate job source (URL or pasted text)
    if not resume_text:
        raise HTTPException(
            status_code=400,
            detail="Could not read your resume. Paste text or upload a file."
        )
    
    if not _is_readable(resume_text):
        raise HTTPException(
            status_code=400,
            detail="Could not read your resume. Please upload a text-based PDF (not a scan) or paste the text."
        )

    if not (job_text and job_text.strip()) and not (url and url.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide a job URL or paste the job description.",
        )
    url_for_req: Optional[str] = url if not (job_text and job_text.strip()) else None

    start = time.monotonic()
    await _log_event_safe(request,
                          user_id=user["user_id"],
                          name="task_run_started",
                          props={"task": task, "unlimited": bool(is_unlimited)})

    # 5) Build request
    req = DraftReq(
        task=task,
        url=url_for_req,
        q=q,
        job_title=job_title,
        resume=resume_text,
        job_text=job_text,
    )

    # 6) Run generation (optional: add a 2-slot concurrency cap)
    # with ConcurrencyGuard(key=f"user:{user_id}", max_in_flight=2):
    try:
        data = await _run_generation(req)
    except HTTPException as e:
        if e.status_code not in (402, 429):
            await _log_event_safe(request,
                                  user_id=user["user_id"],
                                  name="task_run_failed",
                                  props={"task": task, "status": e.status_code})
        raise
    except Exception as e:
        await _log_event_safe(request,
                              user_id=user["user_id"],
                              name="task_run_failed",
                              props={"task": task, "status": 500, "error": str(e)[:200]})
        raise

    duration_ms = int((time.monotonic() - start) * 1000)
    credits_spent = 0 if is_unlimited else 1

    await _log_event_safe(request,
                          user_id=user["user_id"],
                          name="task_run_completed",
                          props={"task": task, "duration_ms": duration_ms, "credits_spent": credits_spent})

    # 7) Return meta, spending credits only for non-unlimited
    if is_unlimited:
        data["meta"]["remaining_credits"] = credits  # unchanged
        data["meta"]["unlimited"] = True
        return data

    remaining = await consume_free_use(user_id)
    if remaining < 0:
        # race: someone else spent last credit in parallel
        raise HTTPException(
            status_code=402,
            detail={
                "code": "INSUFFICIENT_CREDITS",
                "message": "You are out of credits.",
                "current_credits": credits,
            },
        )

    data["meta"]["remaining_credits"] = remaining
    return data

    

