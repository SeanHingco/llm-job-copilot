import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.location_fit_schema import LocationFitInput, LocationFitResult

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_location_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert recruiter evaluating location fit."
        ),
        (
            "human",
            "RESUME CONTEXT:\n"
            "Summary: {resume_summary}\n"
            "(Note: Resume location is inferred from summary/experience)\n\n"
            "JOB LOCATION INFO:\n"
            "Location: {job_location}\n"
            "Remote/Onsite context: {job_summary}\n\n"
            "Determine the location fit score (0-100).\n"
            "- 100: Perfect match (e.g. Remote role & candidate matches timezone/country, or Local candidate).\n"
            "- 80-99: Good match (e.g. Relocation open, or near location).\n"
            "- <50: Poor match (e.g. On-site required but candidate is far and no relocation mentioned).\n\n"
            "Fill the LocationFitResult schema with:\n"
            "- score: 0-100 based on location fit\n"
            "- analysis: brief explanation of determination\n"
            "- remote_status_match: Match, Mismatch, etc.\n"
            "- relocation_required: boolean true/false\n"
            "- commute_analysis: if local, is it feasible?\n"
            "- time_zone_match: if remote, is it aligned?\n\n"
            "Return a valid JSON object strictly matching the schema."
        ),
    ]
)


def calculate_location_fit_domain(input: LocationFitInput) -> LocationFitResult:
    """
    Analyzes location compatibility using structured scan results.
    """
    chain = _location_prompt | llm.with_structured_output(LocationFitResult)
    
    return chain.invoke({
        # ResumeScanResult doesn't have a top-level location field, so usage summary
        "resume_summary": input.resume.summary_for_matching or input.resume.work_experience_summary or "",
        "job_location": input.job.location or "Not specified",
        "job_summary": input.job.summary_for_candidate or ""
    })
