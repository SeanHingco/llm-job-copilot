# app/agents/domain/scan_job.py
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from schemas.resume_scan_schema import ScanJobInput, JobScanResult

import os

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)

_job_scan_prompt = ChatPromptTemplate.from_template(
    [
        (
            "system",
            "You are a strict parser that extracts structured information from job "
            "postings for a resume assistant. Only describe what is in the posting; "
            "do NOT invent details or give advice.",
        ),
        (
            "human",
            "Here is the job posting text:\n\n{job_text}\n\n"
            "Fill the JobScanResult schema:\n"
            "- raw_title\n"
            "- company_name\n"
            "- location\n"
            "- must_have_skills\n"
            "- nice_to_have_skills\n"
            "- tools_and_tech\n"
            "- keywords\n"
            "- summary_for_candidate (2–3 sentences, plain English).\n\n"
            "If something is missing, leave it null or an empty list instead of guessing.",
        ),
    ]
)

def scan_job(input: ScanJobInput) -> JobScanResult:
    """
    Core logic to scan and analyze a job posting. Calls LLM with structured output,
    and performs postprocessing to ensure clean output
    """

    # invoke LLM with job text
    chain = _job_scan_prompt | llm.with_structured_output(JobScanResult)
    res = chain.invoke({"job_text": input.job_text})

    # cleanup
    res.must_have_skills = [s.strip() for s in res.must_have_skills]
    res.nice_to_have_skills = [s.strip() for s in res.nice_to_have_skills]
    res.tools_and_tech = [s.strip() for s in res.tools_and_tech]
    res.keywords = [s.strip() for s in res.keywords]

    return res