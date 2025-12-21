from langchain.tools import tool

from app.agents.schemas.experience_fit_schema import ExperienceFitInput, ExperienceFitResult
from app.agents.domain.experience_fit import calculate_experience_fit_domain


@tool(
    "calculate_experience_fit",
    args_schema=ExperienceFitInput,
    description=(
        "Evaluate how well the candidate's work history and skills match the job requirements. "
        "Consider years of experience, relevant industries, specific technologies/skills, and leadership levels. "
        "Return a score from 0 to 100 with analysis."
    ),
)
def calculate_experience_fit_tool(input: ExperienceFitInput) -> ExperienceFitResult:
    """
    Evaluate how well the candidate's work history and skills match the job requirements.
    """
    return calculate_experience_fit_domain(input)
