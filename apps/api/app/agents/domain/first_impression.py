# domain/first_impression.py

import os
from typing import Optional, Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.first_impression_schema import (
    FirstImpressionInput,
    FirstImpressionResult,
)
from app.agents.schemas.ats_schema import AtsMatchInput
from app.agents.schemas.risk_schema import RiskAdjustInput
from app.agents.schemas.car_schema import CarEvaluateInput

from app.agents.domain.scan_job import scan_job as scan_job_domain
from app.agents.domain.scan_resume import scan_resume as scan_resume_domain
from app.agents.domain.ats_match import ats_match_domain
from app.agents.domain.risk_adjust import risk_adjust_domain
from app.agents.domain.car_evaluate import car_evaluate_domain


# Final summarizing LLM (Gemini)
summary_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_first_impression_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are acting as a recruiter skimming a resume for 10–15 seconds. "
            "You have structured analysis from several tools (job scan, resume scan, ATS match, "
            "risk assessment, and optional CAR analysis). Your job is to simulate what actually "
            "STANDS OUT on a quick skim and to summarize it in a structured report.\n\n"
            "Important:\n"
            "- Focus on what a human recruiter would notice FAST: obvious strengths, clear red flags, "
            "  strong alignment, or glaring gaps.\n"
            "- Do NOT list every detail; prioritize the 3–7 most salient highlights.\n"
            "- Use plain, direct language.\n"
            "- Do not invent numbers; use the provided ATS, risk, and CAR scores.\n"
            "- Return a JSON object that matches the FirstImpressionResult schema."
        ),
        (
            "human",
            "Here is the structured context:\n\n"
            "Job scan:\n{job_scan}\n\n"
            "Resume scan:\n{resume_scan}\n\n"
            "ATS match result:\n{ats_result}\n\n"
            "Risk adjust result:\n{risk_result}\n\n"
            "CAR evaluation result (may be null or simplified):\n{car_result}\n\n"
            "Using this information, simulate a recruiter's first 10–15 second skim of the resume "
            "for THIS specific job. Fill in the FirstImpressionResult schema:\n"
            "- ats_score: use the ATS score provided (0–1)\n"
            "- risk_score: use the risk score provided (0–1)\n"
            "- car_score: use CAR score if available, otherwise null\n"
            "- label: GREEN/YELLOW/RED based on overall impression\n"
            "- headline: one-sentence, human-readable first impression\n"
            "- quick_summary: 3–5 sentences summarizing what stands out on a skim\n"
            "- highlights: 3–7 FirstImpressionHighlight items capturing strengths/concerns.\n\n"
            "Prioritize what a recruiter would actually notice quickly."
        ),
    ]
)


def first_impression_domain(
    input: FirstImpressionInput,
) -> FirstImpressionResult:
    """
    Orchestrates the 5 existing tools to produce a First-Impression Report
    for a resume + job pair.
    """

    # 1) Scan job and resume (LLM tools)
    job_scan = scan_job_domain(
        # adapt if your ScanJobInput is imported differently
        input_job := type("Tmp", (), {"job_text": input.job_text})()
    )  # or better: ScanJobInput(job_text=input.job_text)

    # If you have ScanJobInput / ScanResumeInput classes, use them directly instead:
    # from schemas.resume_scan_schema import ScanJobInput, ScanResumeInput
    # job_scan = scan_job_domain(ScanJobInput(job_text=input.job_text))
    # resume_scan = scan_resume_domain(ScanResumeInput(resume_text=input.resume_text))

    from app.agents.schemas.resume_scan_schema import ScanJobInput, ScanResumeInput
    job_scan = scan_job_domain(ScanJobInput(job_text=input.job_text))
    resume_scan = scan_resume_domain(ScanResumeInput(resume_text=input.resume_text))

    # 2) ATS match (heuristic tool)
    ats_input = AtsMatchInput(job=job_scan, resume=resume_scan)
    ats_result = ats_match_domain(ats_input)

    # 3) Risk adjust (heuristic tool)
    risk_input = RiskAdjustInput(job=job_scan, resume=resume_scan, ats=ats_result)
    risk_result = risk_adjust_domain(risk_input)

    # 4) Optional CAR evaluation if bullets provided
    car_result: Optional[Dict[str, Any]] = None
    car_score: Optional[float] = None

    if input.bullets:
        car_input = CarEvaluateInput(bullets=input.bullets)
        car_eval = car_evaluate_domain(car_input)
        car_score = car_eval.overall_car_score
        # we can pass the whole object to the summary model as JSON-like dict
        car_result = car_eval.model_dump()
    else:
        car_result = None
        car_score = None

    # 5) Call summary LLM with structured output
    chain = _first_impression_prompt | summary_llm.with_structured_output(
        FirstImpressionResult
    )

    result: FirstImpressionResult = chain.invoke(
        {
            "job_scan": job_scan.model_dump(),
            "resume_scan": resume_scan.model_dump(),
            "ats_result": ats_result.model_dump(),
            "risk_result": risk_result.model_dump(),
            "car_result": car_result,
        }
    )

    # Ensure scores match underlying tools (in case LLM nudges them)
    result.ats_score = float(ats_result.ats_score)
    result.risk_score = float(risk_result.risk_score)
    if car_score is not None:
        result.car_score = float(car_score)
    else:
        result.car_score = None

    return result
