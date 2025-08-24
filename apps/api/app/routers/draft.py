from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from pydantic import BaseModel, HttpUrl
from typing import Optional, Literal
from pathlib import Path

from app.utils.llm import generate_text
from app.routers.ingest import ingest as ingest_route
from app.routers.ingest import IngestRequest
from app.routers.resume import extract_resume as extract_route

import httpx
import os
from pathlib import Path

router = APIRouter(prefix="/draft", tags=["draft"])
Task = Literal["bullets", "talking_points", "cover_letter", "alignment"]
PROMPT_DIR = Path(__file__).resolve().parents[4] / "ml" / "prompts"

class DraftReq(BaseModel):
    task: Task="bullets"
    url: HttpUrl
    q: Optional[str] = None
    job_title: Optional[str] = None
    resume: Optional[str] = ""

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
async def draft_run(req: DraftReq):
    # reuse ingest to build context
    ingest_payload = IngestRequest(url=req.url, q=req.q)
    result = await ingest_route(ingest_payload)

    # you can keep using the preview for now; later we can pass a larger budgeted context
    context = result.get("context") or result.get("context_preview") or ""
    job_title = req.job_title or result.get("title") or ""
    template = load_task_template(req.task)
    prompt = template.format(job_title=job_title, context=context, resume=req.resume or "")

    # call model via provider-agnostic helper
    try:
        bullets = await generate_text(prompt)
    except Exception as e:
        # generate_text raises RuntimeError with helpful details; surface them
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    # provider/model metadata (so responses explain what ran)
    provider = os.getenv("LLM_PROVIDER", "gemini")
    model_env = {
        "gemini": "GEMINI_MODEL",
        "openai": "OPENAI_MODEL",
        "groq":   "GROQ_MODEL",
        "ollama": "OLLAMA_MODEL",
    }.get(provider, "")
    model = os.getenv(model_env, "")

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

@router.post("/run-form")
async def draft_run_form(
    url: HttpUrl = Form(...),
    q: Optional[str] = Form(None),
    job_title: Optional[str] = Form(None),
    resume: Optional[str] = Form(""),
    resume_file: UploadFile | None = File(None),
    task: Task = Form("bullets"),
):
    if resume_file:
        print("ayo we found that bih")
        extracted = await extract_route(resume_file)
        resume_text = extracted["text"] or ""
    else:
        print("didnt find no resume bro bro")
        resume_text = resume or ""
    
    req = DraftReq(
        task=task,
        url=url,
        q=q,
        job_title=job_title,
        resume=resume_text
    )

    bullets = await draft_run(req)
    return bullets

    

