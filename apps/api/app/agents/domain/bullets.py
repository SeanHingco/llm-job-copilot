import os
import re
from typing import List, Optional, Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.bullets_schema import BulletsInput, BulletsResult, BulletsDraftResult
from app.agents.schemas.resume_scan_schema import ScanJobInput, ScanResumeInput, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchInput

from app.agents.domain.scan_job import scan_job as scan_job_domain
from app.agents.domain.scan_resume import scan_resume as scan_resume_domain
from app.agents.domain.ats_match import ats_match_domain


bullets_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

# Keep scan payloads lean so the model doesn't get distracted + you don't burn tokens.
# Adjust keys if your scan schemas differ.
def _compact_job_scan(job_scan: Any) -> Dict[str, Any]:
    d = job_scan.model_dump() if hasattr(job_scan, "model_dump") else dict(job_scan)
    return {
        "raw_title": d.get("raw_title"),
        "company_name": d.get("company_name"),
        "location": d.get("location"),
        "must_have_skills": d.get("must_have_skills") or [],
        "nice_to_have_skills": d.get("nice_to_have_skills") or [],
        "tools_and_tech": d.get("tools_and_tech") or [],
        "keywords": d.get("keywords") or [],
        "summary_for_candidate": d.get("summary_for_candidate"),
    }



def _compact_resume_scan(resume_scan: Any) -> Dict[str, Any]:
    d = resume_scan.model_dump() if hasattr(resume_scan, "model_dump") else dict(resume_scan)
    return {
        "global_skills": d.get("global_skills") or [],
        "tools_and_tech": d.get("tools_and_tech") or [],
        "keywords": d.get("keywords") or [],
        "work_experience_summary": d.get("work_experience_summary"),
        "summary_for_matching": d.get("summary_for_matching"),
        "total_years_experience": d.get("total_years_experience"),
    }

def _force_one_transferable(draft: BulletsDraftResult) -> BulletsDraftResult:
    repaired = repair_bullets_output(draft)
    return BulletsDraftResult(**repaired)



_bullets_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You help a candidate land interviews by producing concise, achievement-focused resume bullets tailored to a job.\n"
            "Rules (must follow):\n"
            "- Exactly 6 bullets; 14–24 words each; start with a strong verb. No “I”, no company names.\n"
            "- Use ONLY resume_text as factual evidence. Do not invent numbers.\n"
            "- Each bullet must map to a DISTINCT JD requirement (no overlap).\n"
            "- If a bullet cannot be supported by resume_text, set text to start with 'GAP:' and keep it honest.\n"
            "- Each bullet must include 1–2 relevant JD keywords in the keywords array.\n"
            "- evidence must start with 'Resume:' or 'JD:' (prefer Resume). Evidence should be verbatim/near-verbatim.\n"
            "- Output JSON matching BulletsDraftResult only. No extra text.\n",
        ),
        (
            "human",
            "Job Title: {job_title}\n\n"
            "Job Text:\n{job_text}\n\n"
            "Resume Text:\n{resume_text}\n\n"
            "Job scan (compact):\n{job_scan}\n\n"
            "Resume scan (compact):\n{resume_scan}\n\n"
            "Return BulletsDraftResult JSON only.",
        ),
    ]
)

_repair_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You repair resume bullet JSON to satisfy constraints exactly.\n"
            "Rules:\n"
            "- Do NOT add new facts or metrics.\n"
            "- Keep bullets grounded in resume_text.\n"
            "- If unsupported, use 'GAP:' at the start of the bullet text.\n"
            "- Output JSON matching BulletsDraftResult only. No extra text.\n",
        ),
        (
            "human",
            "Validation errors:\n{errors}\n\n"
            "Current JSON:\n{current_json}\n\n"
            "Job Text:\n{job_text}\n\n"
            "Resume Text:\n{resume_text}\n\n"
            "Job scan (compact):\n{job_scan}\n\n"
            "Resume scan (compact):\n{resume_scan}\n\n"
            "Fix the JSON to satisfy all constraints.",
        ),
    ]
)

_BAD_STARTS = {"responsible", "worked", "helped", "assisted", "participated", "supported"}
_COMPANY_MARKERS = (" inc", " llc", " corp", " ltd", " incorporated", " corporation", " co.", " company")


def _starts_with_strong_verb(text: str) -> bool:
    # Strip leading punctuation/bullets and grab first token
    cleaned = text.strip()
    cleaned = re.sub(r"^[•\-\—\–\*]+\s*", "", cleaned)
    first = re.split(r"\s+", cleaned)[0].strip("•-—–,.;:()[]{}\"'").lower()
    if not first:
        return False
    if not first.isalpha():
        return False
    if first in _BAD_STARTS:
        return False
    # if it's GAP, that's allowed (explicitly)
    if first == "gap":
        return True
    return True


def _looks_like_company_name(text: str, known_orgs: List[str]) -> bool:
    low = text.lower()

     # markers like "Inc", "LLC" etc are fine
    if any(m in low for m in _COMPANY_MARKERS):
        return True

    for org in known_orgs:
        if not org:
            continue
        o = org.strip()
        if len(o) < 4:
            continue

        # ignore short acronyms / tech-ish tokens
        if o.isupper() and len(o) <= 5:
            continue

        # word-boundary match (avoids substring false positives)
        pattern = r"\b" + re.escape(o.lower()) + r"\b"
        if re.search(pattern, low):
            return True

    return False


def _soft_validate_bullets(
    draft: BulletsDraftResult,
    *,
    resume_scan: Optional[ResumeScanResult] = None,
) -> List[str]:
    """
    Return a list of human-readable validation errors (don't raise).
    Keep this separate from Pydantic hard validation so we can feed it to repair.
    """
    errors: List[str] = []
    rs_dump: Dict[str, Any] = resume_scan.model_dump() if (resume_scan and hasattr(resume_scan, "model_dump")) else {}
    known_orgs = rs_dump.get("companies") or []

    for i, b in enumerate(draft.bullets, start=1):
        text = b.text.strip()

        # 14–24 words
        wc = len([w for w in text.split() if w])
        if wc < 14 or wc > 24:
            errors.append(f"Bullet {i} must be 14–24 words; got {wc} words.")

        # No first-person
        if " i " in f" {text.lower()} ":
            errors.append(f"Bullet {i} must not use first-person 'I'.")

        # Strong verb start (allow GAP:)
        if not _starts_with_strong_verb(text):
            errors.append(f"Bullet {i} must start with a strong verb (or 'GAP:').")

        # Heuristic company name check
        if _looks_like_company_name(text, known_orgs):
            errors.append(f"Bullet {i} may contain a company name; remove it.")

        # GAP consistency: if evidence is JD-based (or not Resume), require GAP:
        ev = (b.evidence or "").strip()
        if ev.startswith("JD:") and not text.lower().startswith("gap:"):
            errors.append(f"Bullet {i} uses JD-only evidence; text must start with 'GAP:' if unsupported by resume.")

        # keywords length guard (in case schema validator changes)
        if not (1 <= len(b.keywords) <= 2):
            errors.append(f"Bullet {i} must contain 1–2 keywords.")

    return errors

def repair_bullets_output(draft):
    bullets = []
    for item in getattr(draft, "bullets", []):
        bullets.append({
            "text": getattr(item, "text", ""),
            "evidence": getattr(item, "evidence", "Resume:"),
            "keywords": list(getattr(item, "keywords", []))[:2],
            "rationale": getattr(item, "rationale", ""),
            "transferable": bool(getattr(item, "transferable", False)),
        })
    # Ensure exactly one transferable bullet
    if sum(b["transferable"] for b in bullets) != 1 and bullets:
        bullets[0]["transferable"] = True
        for b in bullets[1:]:
            b["transferable"] = False
    return {"bullets": bullets}


def bullets_domain(input: BulletsInput) -> BulletsResult:
    """
    Orchestrates:
    1) scan_job + scan_resume (reuse if provided)
    2) LLM generation (structured) + repair loop
    3) optional deterministic ats_match attachment
    """

    # 1) Hydrate scans (reuse)
    job_scan = input.job_scan or scan_job_domain(ScanJobInput(job_text=input.job_text))
    resume_scan = input.resume_scan or scan_resume_domain(ScanResumeInput(resume_text=input.resume_text))

    compact_job = _compact_job_scan(job_scan)
    compact_resume = _compact_resume_scan(resume_scan)

    def _generate() -> BulletsDraftResult:
        chain = _bullets_prompt | bullets_llm.with_structured_output(BulletsDraftResult)
        return chain.invoke(
            {
                "job_title": input.job_title,
                "job_text": input.job_text,
                "resume_text": input.resume_text,
                "job_scan": compact_job,
                "resume_scan": compact_resume,
            }
        )

    def _repair(draft: BulletsDraftResult, errors: List[str]) -> BulletsDraftResult:
        repair_chain = _repair_prompt | bullets_llm.with_structured_output(BulletsDraftResult)
        return repair_chain.invoke(
            {
                "errors": errors,
                "current_json": draft.model_dump(),
                "job_text": input.job_text,
                "resume_text": input.resume_text,
                "job_scan": compact_job,
                "resume_scan": compact_resume,
            }
        )

    # 2) Generate + repair loop
    draft = _generate()
    draft = _force_one_transferable(draft)
    errors = _soft_validate_bullets(draft, resume_scan=resume_scan)

    print("Generated draft:", draft.model_dump())
    print("Validation errors:", errors)

    errors = _soft_validate_bullets(draft, resume_scan=resume_scan)
    attempts = 0
    while errors and attempts < 2:
        draft = _repair(draft, errors)
        draft = _force_one_transferable(draft)
        errors = _soft_validate_bullets(draft, resume_scan=resume_scan)
        attempts += 1

    # 3) Fallback: regenerate once if still failing
    if errors:
        draft = _generate()
        errors = _soft_validate_bullets(draft, resume_scan=resume_scan)
        attempts = 0
        while errors and attempts < 2:
            draft = _repair(draft, errors)
            errors = _soft_validate_bullets(draft, resume_scan=resume_scan)
            attempts += 1

    # 4) Fail loudly in strict mode (don't ship junk)
    if errors and input.strict_mode:
        print("Final draft before error:", draft.model_dump())
        print("Final validation errors:", errors)
        # Try to repair one last time before raising
        repaired = repair_bullets_output(draft)
        try:
            draft = BulletsDraftResult(**repaired)
            errors = _soft_validate_bullets(draft, resume_scan=resume_scan)
            if not errors:
                # If repair succeeded, continue
                pass
            else:
                raise ValueError(f"Bullets generation failed constraints: {errors}")
        except Exception as e:
            raise ValueError(f"Bullets generation failed and repair failed: {errors} | Repair error: {e}")

    # 5) Attach deterministic ATS skill match if requested
    ats_skill_match = None
    if input.include_ats_skill_match:
        ats_skill_match = ats_match_domain(AtsMatchInput(job=job_scan, resume=resume_scan))

    return BulletsResult(
        bullets=draft.bullets,
        ats_skill_match=ats_skill_match,
    )
