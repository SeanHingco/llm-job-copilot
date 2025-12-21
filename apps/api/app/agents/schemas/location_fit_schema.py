from pydantic import BaseModel, Field
from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult

class LocationFitInput(BaseModel):
    job: JobScanResult = Field(..., description="Structured scan result for the job posting.")
    resume: ResumeScanResult = Field(..., description="Structured scan result for the candidate's resume.")

from typing import Optional

class LocationFitResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the location fit.")
    analysis: str = Field(..., description="A brief explanation of the location fit.")
    
    remote_status_match: Optional[str] = Field(None, description="Alignment with remote/onsite policy (e.g. 'Match', 'Mismatch - JD requires onsite').")
    relocation_required: Optional[bool] = Field(None, description="Whether relocation appears necessary.")
    commute_analysis: Optional[str] = Field(None, description="Analysis of commute feasability if local.")
    time_zone_match: Optional[str] = Field(None, description="Alignment of time zones if remote.")
