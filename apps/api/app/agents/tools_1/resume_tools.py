# app/agents/tools/resume_tools.py

from langchain.tools import tool

from domain.scan_job import scan_job as scan_job_domain
from domain.scan_resume import scan_resume as scan_resume_domain
from schemas.resume_scan_schema import (
    ScanJobInput,
    JobScanResult,
    ScanResumeInput,
    ResumeScanResult,
)


@tool(
    "scan_job_description",
    args_schema=ScanJobInput,
    description="Analyze a job description and extract title, company, location, skills, keywords, and a short summary."
)
def scan_job_description_tool(job_input: ScanJobInput) -> JobScanResult:
    """
    Analyze a job description and extract relevant details for ATS and matching.
    """
    return scan_job_domain(job_input)


@tool(
    "scan_resume",
    args_schema=ScanResumeInput,
    description="Analyze a resume and extract skills, tools, keywords, and a matching-oriented summary."
)
def scan_resume_tool(resume_input: ScanResumeInput) -> ResumeScanResult:
    """
    Analyze a resume and extract relevant details for ATS and matching.
    """
    return scan_resume_domain(resume_input)
