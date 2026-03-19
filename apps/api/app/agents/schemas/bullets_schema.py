# app/agents/schemas/bullets_schema.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator

from app.agents.schemas.resume_scan_schema import JobScanResult, ResumeScanResult
from app.agents.schemas.ats_schema import AtsMatchResult


class BulletsInput(BaseModel):
    job_title: str = Field(..., description="Target job title.")
    job_text: str = Field(..., description="Full JD text used for grounding.")
    resume_text: str = Field(..., description="Full resume text used as evidence.")

    # Optional: allow caller to pass precomputed scans to avoid re-running tools
    job_scan: Optional[JobScanResult] = None
    resume_scan: Optional[ResumeScanResult] = None

    # Controls
    strict_mode: bool = True

    # Output toggles (lets you evolve without breaking callers)
    include_ats_skill_match: bool = True


class BulletItem(BaseModel):
    text: str
    evidence: str  # "Resume: ..." or "JD: ..."
    keywords: List[str]  # 1–2
    rationale: str
    transferable: bool

    @model_validator(mode="after")
    def _validate_keywords_and_evidence(self):
        if not (1 <= len(self.keywords) <= 2):
            raise ValueError("BulletItem.keywords must contain 1–2 items.")
        if not (self.evidence.startswith("Resume:") or self.evidence.startswith("JD:")):
            raise ValueError('BulletItem.evidence must start with "Resume:" or "JD:".')
        return self


class BulletsResult(BaseModel):
    bullets: List[BulletItem]
    ats_skill_match: Optional[AtsMatchResult] = None

    @model_validator(mode="after")
    def _validate_bullets(self):
        if len(self.bullets) != 6:
            raise ValueError("BulletsResult must contain exactly 6 bullets.")
        transferable_count = sum(1 for b in self.bullets if b.transferable)
        if transferable_count != 1:
            raise ValueError("Exactly one bullet must have transferable=true.")
        return self


# ---- Optional internal planning schemas (agent-only but structured) ----
class BulletPlanItem(BaseModel):
    requirement: str
    planned_keywords: List[str] = Field(default_factory=list)
    evidence_candidates: List[str] = Field(default_factory=list)
    force_gap: bool = False


class BulletsPlan(BaseModel):
    plan: List[BulletPlanItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_plan(self):
        # Keep it strict if you want exactly 6 planned bullets
        if self.plan and len(self.plan) != 6:
            raise ValueError("BulletsPlan.plan must contain exactly 6 items when present.")
        return self


class BulletsAgentState(BaseModel):
    inp: BulletsInput

    # Tool outputs (reuse your existing tools)
    job_scan: Optional[JobScanResult] = None
    resume_scan: Optional[ResumeScanResult] = None
    ats_skill_match: Optional[AtsMatchResult] = None

    # Intermediate
    plan: Optional[BulletsPlan] = None
    draft: Optional[BulletsResult] = None

    # Validation/repair
    validation_errors: List[str] = Field(default_factory=list)
    repair_attempts: int = 0

    # Debug
    trace: Dict[str, Any] = Field(default_factory=dict)

class BulletsDraftResult(BaseModel):
    bullets: List[BulletItem]

    @model_validator(mode="after")
    def _validate_bullets(self):
        if len(self.bullets) != 6:
            raise ValueError("BulletsDraftResult must contain exactly 6 bullets.")
        # ✅ Don't enforce transferable_count here
        return self
