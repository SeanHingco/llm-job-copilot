from langchain.tools import tool

from app.agents.schemas.location_fit_schema import LocationFitInput, LocationFitResult
from app.agents.domain.location_fit import calculate_location_fit_domain


@tool(
    "calculate_location_fit",
    args_schema=LocationFitInput,
    description=(
        "Analyzes the location compatibility between a candidate's resume and a job description. "
        "Consider factors like remote/hybrid/on-site requirements and candidate location. "
        "Return a score from 0 to 100 with analysis."
    ),
)
def calculate_location_fit_tool(input: LocationFitInput) -> LocationFitResult:
    """
    Analyzes the location compatibility between a candidate's resume and a job description.
    """
    return calculate_location_fit_domain(input)
