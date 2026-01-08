from pydantic import BaseModel, Field
from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult

class CompanyFitInput(BaseModel):
    job: JobScanResult = Field(..., description="Structured scan result for the job posting.")
    resume: ResumeScanResult = Field(..., description="Structured scan result for the candidate's resume.")

from typing import List, Optional

class CompanyCompetitivenessResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the competitiveness fit.")
    analysis: str = Field(..., description="A brief explanation of the competitiveness evaluation.")
    
    target_company_tier: Optional[str] = Field(None, description="Inferred tier of the target company (e.g. 'FAANG', 'Startup', 'Enterprise').")
    candidate_last_company_tier: Optional[str] = Field(None, description="Inferred tier of the candidate's most recent employer.")
    education_tier: Optional[str] = Field(None, description="Inferred tier of the candidate's education (e.g. 'Ivy League', 'State School').")
    trajectory_trend: Optional[str] = Field(None, description="Assessment of career trajectory (e.g. 'Accelerating', 'Consistent', 'Plateaued').")
    gap_factors: List[str] = Field(default_factory=list, description="Specific reasons/gaps lowering the competitiveness score.")
