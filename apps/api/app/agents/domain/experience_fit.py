import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.experience_fit_schema import ExperienceFitInput, ExperienceFitResult

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_experience_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert technical recruiter. Evaluate the Experience Fit."
        ),
        (
            "human",
            "RESUME SUMMARY:\n"
            "Years Experience: {resume_years}\n"
            "Skills: {resume_skills}\n"
            "Summary: {resume_summary}\n\n"
            "JOB REQUIREMENTS:\n"
            "Must Have: {job_must_have}\n"
            "Nice To Have: {job_nice_to_have}\n"
            "Summary: {job_summary}\n\n"
            "Task:\n"
            "1. Compare years of experience vs required (calculate gap).\n"
            "2. Check for key hard skills missing from experience context.\n"
            "3. Evaluate industry relevance and seniority level.\n\n"
            "Scoring Guide:\n"
            "- 90-100: Exceeds/Perfect match.\n"
            "- 75-89: Strong match.\n"
            "- 60-74: Good match, minor gaps.\n"
            "- 40-59: Partial match.\n"
            "- <40: Not qualified.\n\n"
            "Fill the ExperienceFitResult schema with:\n"
            "- score: 0-100 based on fit\n"
            "- analysis: brief explanation of match\n"
            "- years_experience_gap: positive = surplus, negative = deficit\n"
            "- seniority_level_match: Match, Overqualified, or Underqualified\n"
            "- key_skills_missing_from_experience: skills required but not found\n"
            "- industry_alignment: Direct Match or Transferable\n\n"
            "Return a valid JSON object strictly matching the schema."
        ),
    ]
)


def calculate_experience_fit_domain(input: ExperienceFitInput) -> ExperienceFitResult:
    """
    Evaluates experience fit using structured scan results.
    """
    chain = _experience_prompt | llm.with_structured_output(ExperienceFitResult)
    
    return chain.invoke({
        "resume_years": input.resume.total_years_experience or "Unknown",
        "resume_skills": ", ".join(input.resume.global_skills),
        "resume_summary": input.resume.work_experience_summary or "",
        "job_must_have": ", ".join(input.job.must_have_skills),
        "job_nice_to_have": ", ".join(input.job.nice_to_have_skills),
        "job_summary": input.job.summary_for_candidate
    })
