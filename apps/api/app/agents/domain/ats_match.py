# domain/ats_match.py
import re
from typing import Set, Iterable

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchInput, AtsMatchResult


ALIASES = {
  "bachelor's degree": {"bachelor", "bachelors", "bachelor’s", "bs", "b.s", "b.s.", "bsc", "undergraduate degree"},
  "master's degree": {"master", "masters", "master’s", "ms", "m.s", "m.s.", "msc", "graduate degree"},
  "amazon web services": {"aws", "amazon web services"},
  "javascript": {"javascript", "js", "ecmascript"},
  "typescript": {"typescript", "ts"},
  "machine learning": {"ml", "machine learning"},
  # add more as needed
}

def _norm(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[\(\)\[\]\{\},:;]", " ", s)
    s = s.replace("&", " and ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _tokens(s: str) -> Set[str]:
    return {t for t in re.split(r"[\s\/\-\+]+", _norm(s)) if t}

ALT_TOKENS = {canon: [set(_tokens(a)) for a in alts] for canon, alts in ALIASES.items()}

def _canonical(s: str) -> str:
    n = _norm(s)
    nt = _tokens(n)
    for canon, alt_token_sets in ALT_TOKENS.items():
        if n == canon:
            return canon
        # if ALL tokens of an alias appear in the string tokens
        if any(at.issubset(nt) for at in alt_token_sets):
            return canon
    return n

def _is_degree_req(s: str) -> bool:
    n = _norm(s)
    return any(k in n for k in ["bachelor", "bs", "b.s", "bsc", "master", "ms", "m.s", "msc", "phd", "doctorate"])

def _match_one(job_item: str, resume_items: Iterable[str]) -> bool:
    j = _canonical(job_item)

    # Degree requirement special handling: allow “B.S.” to satisfy “bachelor’s”
    if _is_degree_req(j):
        jt = _tokens(j)
        for r in resume_items:
            rt = _tokens(_canonical(r))
            # if resume contains bs/bachelor tokens, match
            if ({"bs", "b.s", "b.s.", "bsc", "bachelor", "bachelors", "bachelor’s"} & rt) and \
               ({"bachelor", "bs", "b.s", "bsc"} & jt or "bachelor" in jt):
                return True

    j_tokens = _tokens(j)
    for r in resume_items:
        rr = _canonical(r)
        # exact canonical match
        if j == rr:
            return True
        # substring match
        if j in rr or rr in j:
            return True
        # token overlap match (tune threshold)
        r_tokens = _tokens(rr)
        if not j_tokens or not r_tokens:
            continue
        inter = len(j_tokens & r_tokens)
        union = len(j_tokens | r_tokens)
        if union and (inter / union) >= 0.5:
            return True
    return False




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

    job_must = {_canonical(s) for s in (job.must_have_skills or []) if isinstance(s,str) and s.strip()}
    job_nice = {_canonical(s) for s in (job.nice_to_have_skills or []) if isinstance(s,str) and s.strip()}

    resume_all = {_canonical(s) for s in ((resume.global_skills or []) + (resume.tools_and_tech or []))
                if isinstance(s,str) and s.strip()}

    # --- 2) Compute overlaps ---

    resume_list = list(resume_all)

    matched_must = {j for j in job_must if _match_one(j, resume_list)}
    matched_nice = {j for j in job_nice if _match_one(j, resume_list)}

    missing_must = job_must - matched_must
    missing_nice = job_nice - matched_nice

    extra_resume = set(resume_all) - (set(job_must) | set(job_nice))

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
