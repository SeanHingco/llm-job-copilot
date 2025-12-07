# app/agents/domain/scan_resume.py

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from schemas.resume_scan_schema import ScanResumeInput, ResumeScanResult

import os

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)

_resume_scan_prompt = ChatPromptTemplate.from_template(
    [
        (
            "system",
            "You are a strict parser that extracts structured information from resumes "
            "for a resume assistant. Only describe what is in the resume; "
            "do NOT invent details or give advice.",
        ),
        (
            "human",
            "Here is the resume text:\n\n{resume}\n\n"
            "Fill the ResumeScanResult schema:\n"
            "- candidate_name\n"
            "- total_years_experience\n"
            "- work_experience_summary\n"
            "- global_skills\n"
            "- tools_and_tech\n"
            "- keywords\n"
            "- summary_for_candidate (2–3 sentences, plain English).\n\n"
            "If something is missing, leave it null or an empty list instead of guessing.",
        ),
    ]
)

def scan_job(input: ScanResumeInput) -> ResumeScanResult:
    """
    Core logic to scan and analyze a job posting. Calls LLM with structured output,
    and performs postprocessing to ensure clean output
    """

    # invoke LLM with job text
    chain = _resume_scan_prompt | llm.with_structured_output(ResumeScanResult)
    res = chain.invoke({"job_text": input.job_text})

    # cleanup
    res.global_skills = [s.strip() for s in res.global_skills]
    res.tools_and_tech = [s.strip() for s in res.tools_and_tech]
    res.keywords = [s.strip() for s in res.keywords]

    return res