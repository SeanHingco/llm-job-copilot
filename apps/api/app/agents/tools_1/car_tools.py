# tools/car_tools.py

from langchain.tools import tool

from schemas.car_schema import CarEvaluateInput, CarEvaluateResult
from domain.car_evaluate import car_evaluate_domain


@tool(
    "car_evaluate",
    args_schema=CarEvaluateInput,
    description=(
        "Evaluate one or more resume bullets using the CAR framework "
        "(Context, Action, Result). Returns per-bullet CAR scores and an "
        "overall CAR quality score from 0 to 1."
    ),
)
def car_evaluate_tool(input: CarEvaluateInput) -> CarEvaluateResult:
    """
    Analyze a list of bullets for CAR quality using the CAR (Context-Action-Result) framework.
    """
    return car_evaluate_domain(input)
