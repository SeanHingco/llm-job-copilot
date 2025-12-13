# schemas/first_impression_schema.py

from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class FirstImpressionInput(BaseModel):
    resume_text: str = Field(..., description="Full resume text.")
    job_text: str = Field(..., description="Full job posting text.")
    bullets: Optional[List[str]] = Field(
        None,
        description="Optional: specific bullets to use for CAR analysis. "
                    "If omitted, CAR can be skipped or approximated later."
    )

class FirstImpressionHighlight(BaseModel):
    kind: Literal["strength", "concern", "neutral"] = Field(
        ..., description="How this item affects first impression."
    )
    area: Literal["skills", "experience", "impact", "risk", "clarity", "other"] = Field(
        ..., description="Which aspect of the resume this refers to."
    )
    title: str = Field(
        ..., description="Short label, e.g. 'Strong Python/AWS match' or 'Missing cloud experience'."
    )
    detail: str = Field(
        ..., description="1–3 sentence explanation in skim-reader language."
    )
    suggested_action: Optional[str] = Field(
        None,
        description="Optional concrete suggestion to improve this item."
    )
    importance: Literal["high", "medium", "low"] = Field(
        ..., description="How noticeable/important this is on a quick skim."
    )


class FirstImpressionResult(BaseModel):
    ats_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="ATS score from ats_match (0–1)."
    )
    risk_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Risk score from risk_adjust (0–1)."
    )
    car_score: Optional[float] = Field(
        None, ge=0.0, le=1.0,
        description="Overall CAR score from car_evaluate, if bullets were provided."
    )

    label: Literal["GREEN", "YELLOW", "RED"] = Field(
        ...,
        description="First-impression verdict: GREEN (strong), YELLOW (borderline), RED (weak)."
    )
    headline: str = Field(
        ..., description="One-sentence first-impression summary."
    )
    quick_summary: str = Field(
        ..., description="Short paragraph describing what stands out on a 10–15 second skim."
    )

    highlights: List[FirstImpressionHighlight] = Field(
        default_factory=list,
        description="Key strengths/concerns that would catch a recruiter's eye quickly."
    )
