# tools/ats_tools.py

from langchain.tools import tool

from schemas.ats_schema import AtsMatchInput, AtsMatchResult
from domain.ats_match import ats_match_domain


@tool(
    "ats_match",
    args_schema=AtsMatchInput,
    description=(
        "Compute an ATS-style match score between a scanned job posting and a scanned "
        "resume. Returns a score from 0 to 1, plus matched and missing skills."
    ),
)
def ats_match_tool(input: AtsMatchInput) -> AtsMatchResult:
    """
    Heuristic ATS matching based on overlapping must-have and nice-to-have skills
    between the job posting and the resume.
    """
    return ats_match_domain(input)
