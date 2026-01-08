from pydantic import BaseModel, Field

# We usage ScanResumeInput from resume_scan_schema for input, so we only need Output struct here
# But user said "Clarity_Input Schema" is allowed to be added to resume_scan_schema OR here.
# I will keep ClarityResult here.

from typing import List, Optional

class ResumeClarityResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the resume clarity.")
    analysis: str = Field(..., description="A brief explanation of the resume clarity and structure.")
    
    formatting_issues: List[str] = Field(default_factory=list, description="List of identified formatting or structural issues (e.g. 'Dense text', 'Inconsistent bullets').")
    quantification_score: Optional[float] = Field(None, description="0-100 score on how well achievements are quantified.")
    action_verb_strength: Optional[float] = Field(None, description="0-100 score on usage of strong action verbs.")
    section_ordering_quality: Optional[str] = Field(None, description="Assessment of section order (e.g. 'Logical', 'Education before Experience').")
