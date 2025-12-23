from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Depends, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, HttpUrl, ValidationError
from typing import Optional, Literal

from app.utils.llm import generate_text
from app.utils.rate_limit import throttle, throttle_multi
from app.utils.credits import ensure_daily_free_topup
from app.utils.jd_fetch import fetch_jd_text

from app.routers.ingest import ingest as ingest_route
from app.routers.ingest import IngestRequest
from app.routers.resume import extract_resume as extract_route
from app.agents.bender_score import run_bender_score_agent
from app.agents.domain.first_impression import first_impression_domain
from app.agents.schemas.first_impression_schema import FirstImpressionInput

from app.auth import verify_supabase_session as verify_user
from app.supabase_db import get_user_summary, consume_free_use, insert_analytics_event, create_draft, get_drafts, Draft

import os
from pathlib import Path
from string import Template
import time
import re

bearer = HTTPBearer()
router = APIRouter(prefix="/draft", tags=["draft"])
Task = Literal["bullets", "talking_points", "cover_letter", "alignment", "bender_score", "first_impression"]
PROMPT_DIR = Path(__file__).resolve().parents[4] / "ml" / "prompts"
RL_RUN_FORM_PER_MIN = int(os.getenv("RL_RUN_FORM_PER_MIN", "10"))
REQUIRES_JOB: set[Task] = {"bullets", "talking_points", "cover_letter", "alignment", "bender_score", "first_impression"}
FREE_MODE = os.getenv("FREE_MODE", "true").lower() == "true"

NEG_PATTERNS = [
    "job not found", "position closed", "no longer available", "this job has expired",
    "we can't find that job", "career site error", "page not found", "404",
    "no longer accepting applications"
]

POS_PATTERNS = [
    "responsibilities", "requirements", "qualifications", "about the role",
    "what you'll do", "what you will do", "what we’re looking for", "about you",
    "preferred qualifications", "nice to have"
]

GUEST_ALLOWED_TASKS: set[Task] = {"bullets"}

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

def looks_like_job_context(text: str, result: dict) -> tuple[bool, str]:
    """
    Returns (is_valid, reason).
    Uses length + keywords + ingest meta to judge whether 'text' resembles a real JD.
    """
    t = (text or "").strip()
    if not t:
        return (False, "empty")

    # Use ingest meta if available
    ctx_chars = int(result.get("context_chars") or 0)
    if ctx_chars < 300 and len(t) < 300:
        return (False, "too_short")

    lo = t.lower()
    if any(p in lo for p in NEG_PATTERNS):
        return (False, "not_found_marker")

    # If we have typical JD sections, that is a strong positive
    if any(p in lo for p in POS_PATTERNS):
        return (True, "jd_sections_present")

    # If ingest selected any chunks, that is also a decent positive signal
    sel = result.get("selected_indices")
    if isinstance(sel, list) and len(sel) > 0:
        return (True, "selected_chunks_present")

    # Fallback: check basic letter density
    letters = len(re.findall(r"[A-Za-z]", t))
    if letters / max(1, len(t)) < 0.15:
        return (False, "low_text_density")

    return (True, "heuristic_ok")

async def _log_event_safe(
    request: Request | None,
    *,
    user_id: str | None = None,
    anon_id: str | None = None,
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

    if req.task in REQUIRES_JOB:
        has_pasted_jd = bool(req.job_text and req.job_text.strip())
        is_valid_ctx, why = looks_like_job_context(context, result)
        if not (has_pasted_jd or is_valid_ctx):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "JOB_CONTEXT_INVALID",
                    "reason": why,
                    "message": "We couldn't fetch a valid job description. Paste the JD or try a different URL."
                },
            )
    
    if req.task == "bender_score":
        # Use pasted job_text if available; otherwise fall back to context from ingest
        job_text = (req.job_text or "").strip() or context
        resume_text = (req.resume or "").strip()

        if not resume_text:
            raise HTTPException(
                status_code=400,
                detail="Could not read your resume. Paste text or upload a file.",
            )
        if not job_text:
            raise HTTPException(
                status_code=400,
                detail="Provide a job URL or paste the job description to compute Bender Score.",
            )

        # Run the LangChain agent
        bender = run_bender_score_agent(resume_text=resume_text, job_text=job_text)

        # Return in your normal /draft/run-form shape
        # (output_json will be rendered as pretty JSON on the Draft page)
        return {
            "output_json": {
                "ats_alignment": bender.ats_alignment,
                "experience_fit": bender.experience_fit,
                "car_quality": bender.car_quality,
                "resume_clarity": bender.resume_clarity,
                "company_competitiveness": bender.company_competitiveness,
                "risk_adjustment": bender.risk_adjustment,
                "final_bender_score": bender.final_bender_score,
                "explanation": bender.explanation,
            },
            "prompt": "",  # optional: you can return the prompt if you want to debug
            "meta": {
                "task": "bender_score",
                "final_url": result.get("final_url"),
            },
            # Pass these up so we can save the draft
            "full_text": result.get("full_text"),
            "context": context,
            "job_title": job_title,
        }

    if req.task == "first_impression":
        # Use pasted job_text if available; otherwise fall back to context from ingest
        job_text = (req.job_text or "").strip() or context
        resume_text = (req.resume or "").strip()

        if not resume_text:
            raise HTTPException(
                status_code=400,
                detail="Could not read your resume. Paste text or upload a file.",
            )
        if not job_text:
            raise HTTPException(
                status_code=400,
                detail="Provide a job URL or paste the job description to run First Impression.",
            )

        # Run the First-Impression “agent”
        fi_input = FirstImpressionInput(
            resume_text=resume_text,
            job_text=job_text,
            bullets=None,  # or pass actual bullets later
        )
        fi = first_impression_domain(
            fi_input
        )

        # Return in a JSON-friendly shape similar to bender_score
        return {
            "output_json": fi.model_dump(),
            "prompt": "",  # not prompt-based, it’s an orchestrated pipeline
            "meta": {
                "task": "first_impression",
                "final_url": result.get("final_url"),
            },
            # For persistence / future use
            "full_text": result.get("full_text"),
            "context": context,
            "job_title": job_title,
        }


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
        # Pass these up so we can save the draft
        "full_text": result.get("full_text"),
        "context": context,
        "job_title": job_title,
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
    ingest_payload = IngestRequest(url=req.url, q=req.q, text=req.job_text or None)
    result = await ingest_route(ingest_payload)

    context = result.get("context_preview") or ""
    filled_title = req.job_title or result.get("title") or ""

    if req.task in REQUIRES_JOB:
        has_pasted_jd = bool(req.job_text and req.job_text.strip())
        ok, why = looks_like_job_context(context, result)
        if not (has_pasted_jd or ok):
            # Return a preview that explains *why* we won’t generate
            return {
                "prompt": "",
                "meta": {
                    "final_url": result.get("final_url"),
                    "selected_indices": result.get("selected_indices"),
                    "context_chars": result.get("context_chars"),
                    "title_from_page": result.get("title"),
                    "job_context_valid": False,
                    "job_context_reason": why,
                }
            }

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
async def draft_run(
    req: DraftReq,
    _creds: HTTPAuthorizationCredentials = Security(bearer),
    user = Depends(verify_user),
):
    user_id = user["user_id"]

    # If we're NOT in free mode, enforce credits like before
    credits = None
    if not FREE_MODE:
        profile: UserSummary = await get_user_summary(user_id)
        credits = int(profile.get("free_uses_remaining") or 0)

        if credits <= 0:
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "You are out of credits.",
                    "current_credits": credits,
                },
            )

    # call model via provider-agnostic helper
    try:
        data = await _run_generation(req=req)
    except Exception as e:
        # generate_text raises RuntimeError with helpful details; surface them
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")

    # After generation, either spend a credit (normal) or skip (free mode)
    if not FREE_MODE:
        remaining = await consume_free_use(user_id)
        if remaining < 0:
            # race: someone else spent the last credit in parallel
            raise HTTPException(
                status_code=402,
                detail={
                    "code": "INSUFFICIENT_CREDITS",
                    "message": "You are out of credits.",
                    "current_credits": credits,
                },
            )

        data["meta"]["remaining_credits"] = remaining
    else:
        # In free mode, keep meta shape but don't enforce / decrement credits
        data.setdefault("meta", {})
        # you can set any sentinel here; we'll make the UI ignore it later
        data["meta"]["remaining_credits"] = data["meta"].get(
            "remaining_credits", 9999
        )

    return data


@router.post("/run-form-guest")
async def draft_run_form_guest(
    request: Request,
    url: Optional[str] = Form(None),         # allow URL or pasted JD like normal
    job_text: Optional[str] = Form(None),
    q: Optional[str] = Form(None),
    job_title: Optional[str] = Form(None),
    resume: Optional[str] = Form(""),
    resume_file: Optional[UploadFile] = File(None),
    task: Task = Form("bullets"),
):
    # 1) Enforce: guests can only run bullets
    if task not in GUEST_ALLOWED_TASKS:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "GUEST_FEATURE_LOCKED",
                "message": "Sign up for a free account to use this feature.",
            },
        )

    # 2) Resolve anon_id from header (set by apiFetch)
    anon_id = request.headers.get("x-guest-id") or None

    # 3) Optional: simple rate limiting per guest+task
    #    (mirrors your existing throttle_multi logic, but keyed on anon_id/ip)
    key_id = anon_id or (request.client.host if request.client else "unknown")
    ok, retry_after = throttle_multi(f"guest:{key_id}:task:{task}")
    if not ok:
        await _log_event_safe(
            request,
            user_id=None,
            anon_id=anon_id,
            name="rate_limited_guest",
            props={"task": task, "retry_after": retry_after},
        )
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMITED",
                "message": "You’ve hit the limit for guest runs. Create a free account to keep using Bullets.",
                "retry_after": retry_after,
            },
        )

    # 4) If a resume file is provided, extract text like your normal flow
    resume_text: str = resume or ""
    if resume_file is not None:
        # reuse your existing resume extraction route
        try:
            extracted = await extract_route(resume_file)
            resume_text = extracted.get("text") or resume_text
        except Exception:
            # don't fail the whole request if resume parsing explodes
            pass

    # 5) Build DraftReq and run generation, same as main endpoint
    try:
        req = DraftReq(
            task=task,
            url=url,  # pydantic will validate/convert HttpUrl
            q=q,
            job_title=job_title,
            resume=resume_text,
            job_text=job_text,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

    try:
        data = await _run_generation(req=req)
    except Exception as e:
        # generate_text raises RuntimeError with helpful details; surface them
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")

    # 6) Guests do NOT spend credits; just keep a meta shape the frontend understands
    data.setdefault("meta", {})
    # Give them a dummy remaining_credits so the UI doesn't freak out
    data["meta"]["remaining_credits"] = data["meta"].get("remaining_credits", 9999)
    data["meta"]["unlimited"] = False

    # 7) Analytics: log as anon
    await _log_event_safe(
        request,
        user_id=None,
        anon_id=anon_id,
        name="guest_run_form",
        props={
            "task": task,
            "has_url": bool(url),
            "has_job_text": bool(job_text and job_text.strip()),
            "has_resume": bool(resume_text.strip()),
            "job_title_present": bool(job_title and job_title.strip()),
        },
    )

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
        await _log_event_safe(
            request,
            user_id=user["user_id"],
            name="rate_limited",
            props={
                "endpoint": "draft/run-form",
                "task": task,
                "retry_after": retry
            },
        )
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached. Please try again shortly.",
            headers={"Retry-After": str(retry)},
        )

    # 1) Load profile / credits ONLY when not in FREE_MODE
    # ----------------------------------------------------
    is_unlimited = False          # NEW: default values so they're always defined
    credits = 0                   # NEW

    if not FREE_MODE:             # NEW: skip all this in free mode
        profile: UserSummary = await get_user_summary(user_id)
        is_unlimited = bool(profile.get("unlimited"))
        credits = int(profile.get("free_uses_remaining") or 0)

        # 2) If not unlimited, apply lazy daily top-up and recheck credits
        if not is_unlimited:
            credits = await ensure_daily_free_topup(user_id)
            if credits <= 0:
                await _log_event_safe(
                    request,
                    user_id=user["user_id"],
                    name="out_of_credits_shown",
                    props={"endpoint": "draft/run-form"},
                )
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
            detail="Could not read your resume. Paste text or upload a file.",
        )

    if not _is_readable(resume_text):
        raise HTTPException(
            status_code=400,
            detail="Could not read your resume. Please upload a text-based PDF (not a scan) or paste the text.",
        )

    if not (job_text and job_text.strip()) and not (url and url.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide a job URL or paste the job description.",
        )
    url_for_req: Optional[str] = url if not (job_text and job_text.strip()) else None

    start = time.monotonic()
    await _log_event_safe(
        request,
        user_id=user["user_id"],
        name="task_run_started",
        props={"task": task, "unlimited": bool(is_unlimited)},
    )

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
            await _log_event_safe(
                request,
                user_id=user["user_id"],
                name="task_run_failed",
                props={"task": task, "status": e.status_code},
            )
        raise
    except Exception as e:
        await _log_event_safe(
            request,
            user_id=user["user_id"],
            name="task_run_failed",
            props={"task": task, "status": 500, "error": str(e)[:200]},
        )
        raise

    duration_ms = int((time.monotonic() - start) * 1000)
    # CHANGED: in free mode, treat as 0 credits spent for analytics
    if FREE_MODE or is_unlimited:                 # NEW
        credits_spent = 0
    else:
        credits_spent = 1

    await _log_event_safe(
        request,
        user_id=user["user_id"],
        name="task_run_completed",
        props={"task": task, "duration_ms": duration_ms, "credits_spent": credits_spent},
    )

    # 7) Return meta, spending credits only when NOT in FREE_MODE
    # ----------------------------------------------------------
    # Make sure meta exists so we can safely write into it
    data.setdefault("meta", {})                   # NEW

    if FREE_MODE:
        # NEW: Free mode → don't decrement at all, just return a dummy large value
        data["meta"]["remaining_credits"] = data["meta"].get("remaining_credits", 9999)
        data["meta"]["unlimited"] = bool(is_unlimited)
        return data

    # Original behavior for paid mode (non-free)
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

    # 8) Save draft to DB persistence
    # We only save if successful (which it is if we reached here)
    # Background this? Or await? Await is safer for now to ensure it works.
    try:
        draft_payload: Draft = {
            "user_id": user_id,
            "resume_text": resume_text,
            "job_description_text": data.get("full_text") or "",
            "job_description_context": data.get("context") or "",
            "outputs_json": data.get("bullets") if task == "bullets" else data, # Store the whole thing or specific part? 
            # Ideally store the result. For bullets, "bullets" key has the text.
            # For bender, "output_json" has it.
            # Let's standardize: store the whole 'data' minus the repetitive text fields if we want,
            # or just store "outputs_json" as the 'data'.
            # The schema says outputs_json is jsonb.
            "model_version": data["meta"].get("model") or "unknown",
            "company_name": None, # todo: extract from text?
            "job_title": data.get("job_title") or job_title,
            "job_link": str(req.url) if req.url else None,
            "resume_label": None,
            "bender_score": data["output_json"]["final_bender_score"] if task == "bender_score" and "output_json" in data else None
        }

        # Clean up data for frontend response if needed, OR just save what we have.
        # But wait, create_draft expects 'outputs_json'.
        if task == "bullets":
             draft_payload["outputs_json"] = {"bullets": data.get("bullets")}
        elif task == "bender_score":
             draft_payload["outputs_json"] = data.get("output_json")
        else:
             # generic fallback
             draft_payload["outputs_json"] = data

        await create_draft(draft_payload)
    except Exception as e:
        print(f"Failed to save draft: {e}")
        # Validate if we should fail the request or just log. usually log is better for aux persistence.
        # But user might expect it saved. Let's log for now to avoids blocking the main response.
    
    return data


    

