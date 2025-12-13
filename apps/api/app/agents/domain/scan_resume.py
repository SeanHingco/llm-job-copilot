# app/agents/domain/scan_resume.py

import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.resume_scan_schema import ScanResumeInput, ResumeScanResult


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)

_resume_scan_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a strict parser that analyzes resumes and extracts structured "
            "information for job matching. Only describe what is in the resume; "
            "do NOT give feedback or advice."
        ),
        (
            "human",
            "Here is the resume text:\n\n{resume_text}\n\n"
            "Fill the ResumeScanResult schema with:\n"
            "- candidate_name\n"
            "- total_years_experience: approximate years of professional experience\n"
            "- work_experience_summary: 2–4 sentence summary of their work history\n"
            "- global_skills: main skills from across the resume\n"
            "- tools_and_tech: technologies, tools, frameworks used\n"
            "- keywords: important skills/tech for ATS matching\n"
            "- summary_for_matching: 2–3 sentences describing this person professionally.\n\n"
            "If something is missing, leave it null or an empty list instead of guessing."
        ),
    ]
)


def scan_resume(input: ScanResumeInput) -> ResumeScanResult:
    """
    Core logic to scan and analyze a resume. Calls LLM with structured output,
    and performs postprocessing for clean, deduplicated lists.
    """
    chain = _resume_scan_prompt | llm.with_structured_output(ResumeScanResult)
    res: ResumeScanResult = chain.invoke({"resume_text": input.resume_text})

    # Cleanup / normalization
    res.global_skills = sorted(
        {s.strip() for s in res.global_skills if s.strip()}
    )
    res.tools_and_tech = sorted(
        {s.strip() for s in res.tools_and_tech if s.strip()}
    )
    res.keywords = sorted(
        {s.strip() for s in res.keywords if s.strip()}
    )

    return res
