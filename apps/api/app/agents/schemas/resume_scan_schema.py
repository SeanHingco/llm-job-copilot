from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List


# ===== Job scan =====

class ScanJobInput(BaseModel):
    job_text: str
    job_url: Optional[HttpUrl] = None
    source: Optional[str] = None


class JobScanResult(BaseModel):
    raw_title: Optional[str] = Field(
        None, description="Exact job title as written in the posting"
    )
    company_name: Optional[str] = Field(
        None, description="Company that posted the job"
    )
    location: Optional[str] = Field(
        None, description="Location string from the job posting"
    )

    must_have_skills: List[str] = Field(
        default_factory=list,
        description="Skills that appear to be strict requirements"
    )
    nice_to_have_skills: List[str] = Field(
        default_factory=list,
        description="Skills that are beneficial but not strictly required"
    )
    tools_and_tech: List[str] = Field(
        default_factory=list,
        description="Technologies, tools, or platforms mentioned in the posting"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Important skills/technologies to be surfaced in ATS scans"
    )

    summary_for_candidate: str = Field(
        ..., description="2–3 sentence summary of the role in plain English"
    )


# ===== Resume scan =====

class ScanResumeInput(BaseModel):
    resume_text: str
    resume_label: Optional[str] = None


class ResumeScanResult(BaseModel):
    candidate_name: Optional[str] = Field(
        None, description="Full name of the candidate"
    )
    total_years_experience: Optional[float] = Field(
        None, description="Total years of professional experience"
    )
    work_experience_summary: Optional[str] = Field(
        None, description="Concise summary of work experience (2–4 sentences)"
    )

    global_skills: List[str] = Field(
        default_factory=list,
        description="List of skills extracted from the resume"
    )
    tools_and_tech: List[str] = Field(
        default_factory=list,
        description="Technologies, tools, frameworks, or platforms mentioned"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Important skills/technologies to surface for ATS matching"
    )

    summary_for_matching: Optional[str] = Field(
        None, description="2–3 sentence summary of who this candidate is professionally"
    )
