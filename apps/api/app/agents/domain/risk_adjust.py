# domain/risk_adjust.py

from typing import List

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchResult
from app.agents.schemas.risk_schema import RiskAdjustInput, RiskAdjustResult, RiskFactor


def risk_adjust_domain(input: RiskAdjustInput) -> RiskAdjustResult:
    """
    Heuristic risk adjustment based on ATS score, experience, and obvious gaps.

    risk_score is on a 0–1 scale where:
      - 1.0 = very low risk (strong fit, few obvious flags)
      - 0.0 = very high risk (weak fit, multiple major flags)
    """

    job: JobScanResult = input.job
    resume: ResumeScanResult = input.resume
    ats: AtsMatchResult = input.ats

    factors: List[RiskFactor] = []

    # Start from a neutral-high score; we'll subtract for each risk.
    score = 1.0

    # --- 1) Low ATS score penalties ---

    if ats.ats_score < 0.3:
        score -= 0.3
        factors.append(
            RiskFactor(
                name="very_low_ats",
                weight=-0.3,
                description=f"ATS score {ats.ats_score:.2f} is very low (< 0.30)."
            )
        )
    elif ats.ats_score < 0.5:
        score -= 0.15
        factors.append(
            RiskFactor(
                name="low_ats",
                weight=-0.15,
                description=f"ATS score {ats.ats_score:.2f} is below 0.50."
            )
        )

    # --- 2) Missing must-have skills ---

    missing_must = ats.missing_must_have_skills or []
    if len(missing_must) > 0:
        penalty = min(0.3, 0.1 + 0.05 * len(missing_must))
        score -= penalty
        factors.append(
            RiskFactor(
                name="missing_must_have_skills",
                weight=-penalty,
                description=(
                    "Resume is missing required skills: "
                    + ", ".join(missing_must)
                )
            )
        )

    # --- 3) Experience level heuristic ---

    years = resume.total_years_experience or 0.0

    # Simple heuristic: <1 year is risky for most non-intern roles.
    if years < 1.0:
        score -= 0.2
        factors.append(
            RiskFactor(
                name="very_low_experience",
                weight=-0.2,
                description="Total years of experience is less than 1 year."
            )
        )
    elif years < 3.0:
        score -= 0.1
        factors.append(
            RiskFactor(
                name="low_experience",
                weight=-0.1,
                description="Total years of experience is between 1 and 3 years."
            )
        )

    # --- 4) Resume sparsity / skill coverage ---

    total_resume_skills = len((resume.global_skills or [])) + len((resume.tools_and_tech or []))
    if total_resume_skills == 0:
        score -= 0.25
        factors.append(
            RiskFactor(
                name="no_skills_listed",
                weight=-0.25,
                description="Resume scan did not detect any skills or technologies."
            )
        )

    # --- 5) Job seniority vs experience (very rough v1 heuristic) ---

    # Check for 'senior', 'staff', 'principal' in job title.
    title = (job.raw_title or "").lower()
    is_senior_role = any(
        kw in title for kw in ["senior", "staff", "principal", "lead"]
    )

    if is_senior_role and years < 3.0:
        score -= 0.15
        factors.append(
            RiskFactor(
                name="senior_role_low_experience",
                weight=-0.15,
                description=(
                    "Job title appears senior (e.g., 'Senior', 'Staff'), "
                    "but total experience is under 3 years."
                )
            )
        )

    # Clamp score
    score = float(max(0.0, min(1.0, score)))

    # Build explanation
    if factors:
        descs = [f.description for f in factors]
        explanation = (
            f"Risk score {score:.2f} based on the following factors: "
            + " ".join(descs)
        )
    else:
        explanation = (
            f"Risk score {score:.2f} with no major heuristic risk factors detected."
        )

    return RiskAdjustResult(
        risk_score=score,
        factors=factors,
        explanation=explanation,
    )
