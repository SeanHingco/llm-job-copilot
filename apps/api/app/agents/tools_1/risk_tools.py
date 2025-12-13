# tools/risk_tools.py

from langchain.tools import tool

from schemas.risk_schema import RiskAdjustInput, RiskAdjustResult
from domain.risk_adjust import risk_adjust_domain


@tool(
    "risk_adjust",
    args_schema=RiskAdjustInput,
    description=(
        "Estimate the overall 'riskiness' of an application using ATS score, "
        "experience level, and obvious gaps. Returns a 0–1 risk_score where "
        "1.0 is low risk (strong, safe fit) and 0.0 is high risk."
    ),
)
def risk_adjust_tool(input: RiskAdjustInput) -> RiskAdjustResult:
    """
    Heuristic risk adjustment tool for a job/resume pair, based on ATS match,
    experience level, missing must-have skills, and other simple signals.
    """
    return risk_adjust_domain(input)
