import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.company_competitiveness_schema import CompanyFitInput, CompanyCompetitivenessResult

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_company_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert career strategist. Evaluate the 'Company Competitiveness Fit'."
        ),
        (
            "human",
            "RESUME CONTEXT:\n"
            "Summary: {resume_summary}\n"
            "(Note: Infer pedigree from summary logic)\n\n"
            "JOB CONTEXT:\n"
            "Company: {job_company}\n"
            "Role Summary: {job_summary}\n\n"
            "Analyze:\n"
            "1. Implied tier/prestige of target company (e.g. FAANG, Fortune 500, Startup).\n"
            "2. Candidate's trajectory (Accelerating vs Stagnant) and implied tier of past employers.\n"
            "3. Gap factors (why they might not be competitive).\n\n"
            "Scoring Guide (0-100):\n"
            "- 90-100: Ideal position/pedigree.\n"
            "- 70-89: Strong candidate.\n"
            "- 50-69: Stretch role.\n"
            "- <50: Significant mismatch.\n\n"
            "Fill the CompanyCompetitivenessResult schema with:\n"
            "- score: calculated from 0-100 based on fit\n"
            "- analysis: brief explanation of the evaluation\n"
            "- target_company_tier: e.g. FAANG, Startup, Enterprise\n"
            "- candidate_last_company_tier: inferred from most recent employer\n"
            "- education_tier: inferred from candidate's education\n"
            "- trajectory_trend: e.g. Accelerating, Consistent, Plateaued\n"
            "- gap_factors: specific reasons lowering the score\n\n"
            "Return a valid JSON object strictly matching the schema."
        ),
    ]
)


def calculate_company_competitiveness_domain(input: CompanyFitInput) -> CompanyCompetitivenessResult:
    """
    Evaluates competitiveness match using structured scan results.
    """
    chain = _company_prompt | llm.with_structured_output(CompanyCompetitivenessResult)
    
    return chain.invoke({
        "resume_summary": input.resume.work_experience_summary or input.resume.summary_for_matching or "",
        "job_company": input.job.company_name or "Unknown Company",
        "job_summary": input.job.summary_for_candidate
    })
