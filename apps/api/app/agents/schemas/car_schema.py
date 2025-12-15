# schemas/car_schema.py

from typing import List, Optional
from pydantic import BaseModel, Field


class CarEvaluateInput(BaseModel):
    """
    Input to the CAR evaluation tool.

    You pass in one or more bullets (usually resume bullets) that you want
    evaluated for Context-Action-Result quality.
    """
    bullets: List[str] = Field(
        ...,
        description="List of bullet points or short statements to evaluate for CAR quality."
    )
    job_title_hint: Optional[str] = Field(
        None,
        description="Optional job title context for the bullets (e.g., 'Software Engineer')."
    )
    seniority_hint: Optional[str] = Field(
        None,
        description="Optional seniority level hint (e.g., 'entry level', 'mid-level', 'senior')."
    )


class CarBulletAnalysis(BaseModel):
    """
    Detailed CAR breakdown for a single bullet.
    """
    original: str = Field(..., description="The original bullet text.")

    has_context: bool = Field(
        ...,
        description="Whether the bullet clearly establishes context (situation, scope, or problem)."
    )
    has_action: bool = Field(
        ...,
        description="Whether the bullet clearly states the action(s) the candidate took."
    )
    has_result: bool = Field(
        ...,
        description="Whether the bullet clearly states the outcome, result, or impact."
    )
    uses_metrics: bool = Field(
        ...,
        description="Whether the bullet quantifies impact with numbers, percentages, or concrete metrics."
    )

    clarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="How clear and easy to understand this bullet is (0–1)."
    )
    car_quality_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall CAR strength for this bullet (0–1), combining context, action, result, and impact."
    )

    suggestions: str = Field(
        ...,
        description="Concise suggestions to improve this bullet's CAR structure and clarity."
    )


class CarEvaluateResult(BaseModel):
    """
    Summary of CAR evaluation across a set of bullets.
    """
    overall_car_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Overall CAR quality score across all bullets (0–1)."
    )
    bullets: List[CarBulletAnalysis] = Field(
        default_factory=list,
        description="Per-bullet CAR analysis."
    )
    summary_feedback: str = Field(
        ...,
        description="High-level feedback about the strengths and weaknesses of these bullets as a group."
    )
