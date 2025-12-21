from pydantic import BaseModel, Field
from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult

class ExperienceFitInput(BaseModel):
    job: JobScanResult = Field(..., description="Structured scan result for the job posting.")
    resume: ResumeScanResult = Field(..., description="Structured scan result for the candidate's resume.")

from typing import List, Optional

class ExperienceFitResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the experience fit.")
    analysis: str = Field(..., description="A brief explanation of how the candidate's experience matches the job.")
    
    years_experience_gap: Optional[float] = Field(None, description="Difference between candidate years and required years (positive = surplus, negative = deficit).")
    seniority_level_match: Optional[str] = Field(None, description="Assessment of seniority match (e.g. 'Match', 'Overqualified', 'Underqualified').")
    key_skills_missing_from_experience: List[str] = Field(default_factory=list, description="Key skills from JD not clearly found in work history.")
    industry_alignment: Optional[str] = Field(None, description="Alignment with industry (e.g. 'Direct Match', 'Transferable').")
