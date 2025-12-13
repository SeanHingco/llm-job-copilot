# domain/car_evaluate.py

import os
from typing import List

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.car_schema import CarEvaluateInput, CarEvaluateResult, CarBulletAnalysis


# Gemini model (tweak model name if needed)
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_car_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert resume writing coach. "
            "You evaluate bullet points using the CAR framework "
            "(Context, Action, Result), with an emphasis on clarity and impact.\n\n"
            "Your job is to ANALYZE bullets, not to rewrite them, and return "
            "structured scores and flags for each bullet."
        ),
        (
            "human",
            "We will evaluate the following bullets for CAR quality.\n\n"
            "CAR stands for:\n"
            "- Context: sets the situation, problem, scope, or role\n"
            "- Action: what the candidate actually did\n"
            "- Result: measurable or concrete outcome of those actions\n\n"
            "For each bullet, determine:\n"
            "- has_context (true/false)\n"
            "- has_action (true/false)\n"
            "- has_result (true/false)\n"
            "- uses_metrics (true/false)\n"
            "- clarity_score: 0–1, where 1 is extremely clear and easy to understand\n"
            "- car_quality_score: 0–1, where 1 is excellent CAR structure and impact\n"
            "- suggestions: concise advice to improve CAR and clarity\n\n"
            "Then compute an overall_car_score across all bullets and a brief "
            "summary_feedback about the set.\n\n"
            "Bullets:\n"
            "{bullets}\n\n"
            "{job_context_note}\n"
            "Return ONLY a JSON object that matches the CarEvaluateResult schema."
        ),
    ]
)


def car_evaluate_domain(input: CarEvaluateInput) -> CarEvaluateResult:
    """
    Use Gemini to evaluate a list of bullets for CAR (Context-Action-Result) quality.

    Returns:
        CarEvaluateResult with per-bullet analysis and an overall CAR score.
    """
    # Build context note
    context_bits: List[str] = []
    if input.job_title_hint:
        context_bits.append(f"Job title: {input.job_title_hint}")
    if input.seniority_hint:
        context_bits.append(f"Seniority: {input.seniority_hint}")

    job_context_note = (
        "Context:\n" + "\n".join(context_bits)
        if context_bits
        else "Context: No specific job title or seniority was provided."
    )

    bullets_as_text = "\n".join(
        f"- {b}" for b in input.bullets if b.strip()
    )

    chain = _car_prompt | llm.with_structured_output(CarEvaluateResult)

    result: CarEvaluateResult = chain.invoke(
        {
            "bullets": bullets_as_text,
            "job_context_note": job_context_note,
        }
    )

    # Optional: clamp and sanity-check scores (LLM might slightly overshoot)
    for b in result.bullets:
        b.clarity_score = float(max(0.0, min(1.0, b.clarity_score)))
        b.car_quality_score = float(max(0.0, min(1.0, b.car_quality_score)))

    result.overall_car_score = float(
        max(0.0, min(1.0, result.overall_car_score))
    )

    return result
