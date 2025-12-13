# schemas/risk_schema.py

from typing import List
from pydantic import BaseModel, Field

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchResult


class RiskAdjustInput(BaseModel):
    """
    Input to the risk adjustment tool.

    Uses the scanned job, scanned resume, and ATS match result to
    estimate how 'risky' this application is (on-paper fit, gaps, etc.).
    """
    job: JobScanResult = Field(
        ..., description="Structured scan result for the job posting."
    )
    resume: ResumeScanResult = Field(
        ..., description="Structured scan result for the candidate's resume."
    )
    ats: AtsMatchResult = Field(
        ..., description="ATS matching result between this job and resume."
    )


class RiskFactor(BaseModel):
    """
    A single factor contributing to the overall risk score.
    """
    name: str = Field(
        ..., description="Short machine-readable key for the risk factor."
    )
    weight: float = Field(
        ..., description="Numeric contribution (positive or negative) to the risk score."
    )
    description: str = Field(
        ..., description="Human-readable explanation of this factor."
    )


class RiskAdjustResult(BaseModel):
    """
    Output of the risk adjustment tool.

    risk_score ~ 'how safe is this application?' where 1.0 = low risk,
    0.0 = very high risk, based on heuristic signals.
    """
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="0–1 where 1.0 is very low risk / highly aligned profile, 0.0 is very risky."
    )
    factors: List[RiskFactor] = Field(
        default_factory=list,
        description="Risk factors that influenced the score."
    )
    explanation: str = Field(
        ...,
        description="Short natural-language summary of the risk assessment."
    )
