from langchain.tools import tool
from domain.scan_job import scan_job as scan_job_domain
from schemas.resume_scan_schema import ScanJobInput, JobScanResult


@tool("scan_job_description", args_schema=ScanJobInput, description="Performs detailed analysis of a job posting.")
def scan_jd(jd: ScanJobInput) -> JobScanResult:
    """
    Analyze a job description and extract relevant details
    """

    # Placeholder implementation
    return scan_job_domain(jd)