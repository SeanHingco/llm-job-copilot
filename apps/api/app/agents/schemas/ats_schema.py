# schemas/ats_schema.py

from typing import List
from pydantic import BaseModel, Field

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult


class AtsMatchInput(BaseModel):
    """
    Input to the ATS matching tool.

    This assumes you've already run scan_job and scan_resume and are passing in
    their structured results.
    """
    job: JobScanResult = Field(
        ..., description="Structured scan result for the job posting."
    )
    resume: ResumeScanResult = Field(
        ..., description="Structured scan result for the candidate's resume."
    )


class AtsMatchResult(BaseModel):
    """
    Output of the ATS matching tool.

    Represents how well the resume matches the job on paper, plus the key
    overlapping and missing skills.
    """
    ats_score: float = Field(
        ...,
        description="Overall ATS match score on a 0–1 scale (1.0 = perfect match).",
        ge=0.0,
        le=1.0,
    )

    matched_skills: List[str] = Field(
        default_factory=list,
        description="Skills that appear in both the job requirements and the resume.",
    )
    missing_must_have_skills: List[str] = Field(
        default_factory=list,
        description="Must-have skills from the job that were not found in the resume.",
    )
    missing_nice_to_have_skills: List[str] = Field(
        default_factory=list,
        description="Nice-to-have skills from the job that were not found in the resume.",
    )
    extra_resume_skills: List[str] = Field(
        default_factory=list,
        description="Skills present on the resume that are not requested in the job.",
    )

    explanation: str = Field(
        ...,
        description=(
            "Short natural-language explanation of the ATS score and the main "
            "matched/missing skill areas."
        ),
    )
