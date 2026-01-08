from langchain.tools import tool

from app.agents.schemas.company_competitiveness_schema import CompanyFitInput, CompanyCompetitivenessResult
from app.agents.domain.company_competitiveness import calculate_company_competitiveness_domain


@tool(
    "calculate_company_competitiveness",
    args_schema=CompanyFitInput,
    description=(
        "Evaluate the competitiveness match between the candidate and the target company/role. "
        "Analyze company prestige, candidate pedigree, and role alignment. "
        "Return a score from 0 to 100 with analysis."
    ),
)
def calculate_company_competitiveness_tool(input: CompanyFitInput) -> CompanyCompetitivenessResult:
    """
    Evaluates the competitiveness match between the candidate and the target company/role.
    """
    return calculate_company_competitiveness_domain(input)
