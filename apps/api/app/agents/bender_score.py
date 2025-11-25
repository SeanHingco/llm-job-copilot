# app/agentic/bender_score.py
from pydantic import BaseModel
from typing import Any, Dict
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.tools import tool
from langchain.agents import create_agent

# --- Output schema ---

class BenderScoreOut(BaseModel):
    ats_alignment: float
    experience_fit: float
    car_quality: float
    resume_clarity: float
    company_competitiveness: float
    risk_adjustment: float
    final_bender_score: float
    explanation: str


# --- Tool: compute the weighted score ---

@tool
def compute_bender_score(
    ats_alignment: float,
    experience_fit: float,
    car_quality: float,
    resume_clarity: float,
    company_competitiveness: float,
    risk_adjustment: float,
) -> float:
    """
    Compute a prototype Bender Score using a weighted sum.
    Inputs are expected to be 0–100. Returns 0–100.
    """
    score = (
        0.30 * ats_alignment +
        0.20 * experience_fit +
        0.20 * car_quality +
        0.10 * resume_clarity +
        0.10 * company_competitiveness +
        0.10 * risk_adjustment
    )
    return max(0.0, min(100.0, score))


# --- LLM + agent ---

# Very simple wiring; reuse your GEMINI_API_KEY / model envs
_provider_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_llm = ChatGoogleGenerativeAI(
    model=_provider_model,
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)

_bender_agent = create_agent(
    model=_llm,
    tools=[compute_bender_score],
    response_format=BenderScoreOut,
    system_prompt=(
        "You are the BenderScore engine for Resume Bender.\n"
        "You MUST:\n"
        "1) Read the resume and job description.\n"
        "2) Infer six 0-100 sub-scores:\n"
        "   - ats_alignment\n"
        "   - experience_fit\n"
        "   - car_quality (quality of CAR-style bullets)\n"
        "   - resume_clarity\n"
        "   - company_competitiveness (how competitive the role/company is)\n"
        "   - risk_adjustment (penalize gaps, short tenures, big mismatch)\n"
        "3) Call compute_bender_score exactly once to compute final_bender_score.\n"
        "4) Return a BenderScoreOut with all fields filled.\n"
        "\n"
        "Scoring guidelines (0-100):\n"
        "- 90+ = excellent / top-tier for this role.\n"
        "- 70–89 = strong / likely to pass first screens.\n"
        "- 50–69 = borderline / needs noticeable improvements.\n"
        "- <50 = weak match.\n"
    ),
)


def run_bender_score_agent(resume_text: str, job_text: str) -> BenderScoreOut:
    """
    Run the BenderScore agent on raw resume + job description text.
    Returns a BenderScoreOut Pydantic object.
    """
    prompt = f"""
Resume:

{resume_text}

Job description:

{job_text}

Please:
- Derive the sub-scores (0–100 each).
- Call the compute_bender_score tool once with those values.
- Return a concise explanation of what is driving the final score.
"""

    result: Dict[str, Any] = _bender_agent.invoke(
        {
            "messages": [{"role": "user", "content": prompt}],
        }
    )
    return result["structured_response"]
