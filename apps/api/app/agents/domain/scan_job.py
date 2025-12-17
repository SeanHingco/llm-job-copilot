# app/agents/domain/scan_job.py
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.resume_scan_schema import ScanJobInput, JobScanResult


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)

# Use from_messages for multi-message prompts
_job_scan_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are a strict parser that extracts structured information from job "
            "postings for a resume assistant. Only describe what is in the posting; "
            "do NOT invent details or give advice."
        ),
        (
            "human",
            "Here is the job posting text:\n\n{job_text}\n\n"
            "Fill the JobScanResult schema with:\n"
            "- raw_title: exact job title from the posting\n"
            "- company_name\n"
            "- location\n"
            "- must_have_skills: clearly required skills\n"
            "- nice_to_have_skills: optional or preferred skills\n"
            "- tools_and_tech: technologies and tools mentioned\n"
            "- keywords: important skills/tech for ATS matching\n"
            "- summary_for_candidate: 2–3 sentence plain-English summary of the role.\n\n"
            "If something is missing, leave it null or an empty list instead of guessing."
        ),
    ]
)


def scan_job(input: ScanJobInput) -> JobScanResult:
    """
    Core logic to scan and analyze a job posting. Calls LLM with structured output,
    and performs postprocessing to ensure clean output.
    """
    chain = _job_scan_prompt | llm.with_structured_output(JobScanResult)
    res: JobScanResult = chain.invoke({"job_text": input.job_text})

    # Cleanup / normalization
    res.must_have_skills = [s.strip() for s in res.must_have_skills if s.strip()]
    res.nice_to_have_skills = [s.strip() for s in res.nice_to_have_skills if s.strip()]
    res.tools_and_tech = [s.strip() for s in res.tools_and_tech if s.strip()]
    res.keywords = [s.strip() for s in res.keywords if s.strip()]

    return res
