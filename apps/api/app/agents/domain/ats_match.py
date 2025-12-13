# domain/ats_match.py

from typing import Set

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchInput, AtsMatchResult


def _normalize_skills(skills: list[str]) -> Set[str]:
    """Lowercase, strip, and drop empty values."""
    return {
        s.strip().lower()
        for s in skills
        if isinstance(s, str) and s.strip()
    }


def ats_match_domain(input: AtsMatchInput) -> AtsMatchResult:
    """
    Heuristic ATS matching between a scanned job and scanned resume.

    - Uses JobScanResult.must_have_skills / nice_to_have_skills
    - Uses ResumeScanResult.global_skills + tools_and_tech
    - Computes coverage ratios and a 0–1 ats_score
    """

    job: JobScanResult = input.job
    resume: ResumeScanResult = input.resume

    # --- 1) Build normalized skill sets ---

    job_must = _normalize_skills(job.must_have_skills)
    job_nice = _normalize_skills(job.nice_to_have_skills)

    resume_all = _normalize_skills(
        (resume.global_skills or []) + (resume.tools_and_tech or [])
    )

    # --- 2) Compute overlaps ---

    matched_must = job_must & resume_all
    matched_nice = job_nice & resume_all

    missing_must = job_must - resume_all
    missing_nice = job_nice - resume_all

    extra_resume = resume_all - (job_must | job_nice)

    # --- 3) Compute sub-scores ---

    # Must-have coverage
    if len(job_must) > 0:
        must_score = len(matched_must) / len(job_must)
    else:
        must_score = 1.0  # no must-haves specified

    # Nice-to-have coverage
    if len(job_nice) > 0:
        nice_score = len(matched_nice) / len(job_nice)
    else:
        nice_score = 1.0  # no nice-to-haves specified

    # --- 4) Combine into overall ats_score ---

    if len(job_must) == 0 and len(job_nice) == 0:
        # No skill info at all in the job → neutral-ish default
        ats_score = 0.5
    elif len(job_must) == 0:
        # Only nice-to-haves specified
        ats_score = nice_score
    elif len(job_nice) == 0:
        # Only must-haves specified
        ats_score = must_score
    else:
        # Weighted combo
        W_MUST = 0.7
        W_NICE = 0.3
        ats_score = W_MUST * must_score + W_NICE * nice_score

    # Clamp to [0, 1]
    ats_score = float(max(0.0, min(1.0, ats_score)))

    # --- 5) Build explanation text ---

    parts: list[str] = []

    if len(job_must) > 0:
        parts.append(
            f"Matched {len(matched_must)}/{len(job_must)} must-have skills"
        )
    else:
        parts.append(
            "Job did not specify any explicit must-have skills"
        )

    if len(job_nice) > 0:
        parts.append(
            f"Matched {len(matched_nice)}/{len(job_nice)} nice-to-have skills"
        )

    if missing_must:
        parts.append(
            "Missing must-have skills: " + ", ".join(sorted(missing_must))
        )

    if missing_nice:
        parts.append(
            "Missing nice-to-have skills: " + ", ".join(sorted(missing_nice))
        )

    if extra_resume:
        parts.append(
            "Extra skills on the resume: " + ", ".join(sorted(extra_resume))
        )

    explanation = ". ".join(parts)

    # --- 6) Return AtsMatchResult ---

    return AtsMatchResult(
        ats_score=ats_score,
        matched_skills=sorted(matched_must),
        missing_must_have_skills=sorted(missing_must),
        missing_nice_to_have_skills=sorted(missing_nice),
        extra_resume_skills=sorted(extra_resume),
        explanation=explanation,
    )
