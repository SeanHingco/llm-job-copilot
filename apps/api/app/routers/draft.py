from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional
from pathlib import Path

from app.utils.llm import generate_text
from app.routers.ingest import ingest as ingest_route
from app.routers.ingest import IngestRequest

import httpx
import os

router = APIRouter(prefix="/draft", tags=["draft"])

class DraftReq(BaseModel):
    url: HttpUrl
    q: Optional[str] = None
    job_title: Optional[str] = None
    resume: Optional[str] = ""


def load_template() -> str:
    p = Path(__file__).resolve().parents[4] / "ml" / "prompts" / "draft_prompt.md"
    if p.exists():
        return p.read_text(encoding="utf-8")
    # fallback
    return (
        "# System\nYou write concise, achievement-focused resume bullets using only the provided context.\n\n"
        "# Inputs\nJob Title: {job_title}\nContext:\n{context}\n\nCandidate Resume:\n{resume}\n\n"
        "# Output\n- Bullets only, one per line."
    )

@router.post("")
async def draft(req: DraftReq):
    # 1) Reuse ingest pipeline to get context (no model yet)
    ingest_payload = IngestRequest(url=req.url, q=req.q)
    result = await ingest_route(ingest_payload)

    context = result.get("context_preview") or ""
    filled_title = req.job_title or result.get("title") or ""
    template = load_template()
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
    context = result.get("context_preview") or ""
    job_title = req.job_title or result.get("title") or ""
    template = load_template()
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
