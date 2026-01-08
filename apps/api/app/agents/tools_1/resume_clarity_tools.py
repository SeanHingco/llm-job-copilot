from langchain.tools import tool

from app.agents.schemas.resume_scan_schema import ScanResumeInput
from app.agents.schemas.resume_clarity_schema import ResumeClarityResult
from app.agents.domain.resume_clarity import calculate_resume_clarity_domain


@tool(
    "calculate_resume_clarity",
    args_schema=ScanResumeInput,
    description=(
        "Evaluate the clarity, structure, and readability of the resume. "
        "Check for clear section headers, concise bullet points, and logical flow. "
        "Return a score from 0 to 100 with analysis."
    ),
)
def calculate_resume_clarity_tool(input: ScanResumeInput) -> ResumeClarityResult:
    """
    Evaluates the clarity, structure, and readability of the resume.
    Checks for clear section headers, concise bullet points, and logical flow.
    """
    return calculate_resume_clarity_domain(input)
