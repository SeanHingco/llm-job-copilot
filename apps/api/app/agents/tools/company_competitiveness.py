import os
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

class CompanyCompetitivenessResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the competitiveness fit.")
    analysis: str = Field(..., description="A brief explanation of the competitiveness evaluation.")

@tool
def calculate_company_competitiveness(resume_text: str, job_description_text: str) -> dict:
    """
    Evaluates the competitiveness match between the candidate and the target company/role.
    Analyzes:
    - The prestige/tier of the target company (e.g. FAANG, Fortune 500, Startup).
    - The candidate's pedigree (previous companies, schools, impact).
    - Whether the candidate's background is 'competitive' enough for the specific role requirements.
    """
    
    _provider_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(
        model=_provider_model,
        temperature=0,
        api_key=os.environ["GEMINI_API_KEY"],
    )
    
    prompt = f"""
    You are an expert career strategist. Evaluate the 'Company Competitiveness Fit'.
    
    RESUME:
    {resume_text}
    
    JOB DESCRIPTION:
    {job_description_text}
    
    Analyze:
    1. Identify the implied tier/prestige of the target company/role from the JD.
    2. Assess the candidate's career trajectory (Company names, promotion velocity, school tiers).
    3. Determine if the candidate is "punching above their weight" (low score), "punching below" (high score), or "perfectly aligned" (high score).
    
    Scoring Guide (0-100):
    - 90-100: Candidate has equal or better pedigree (e.g. Ex-Google applying to Google, or Senior applying to Mid-level). Ideally positioned.
    - 70-89: Strong candidate, reasonable step up or lateral move. Reliable background.
    - 50-69: Stretch role. Candidate is coming from a lower-tier brand or smaller scope, but has potential.
    - <50: Significant mismatch. Candidate background does not suggest they can compete for this specific role/company tier.
    
    Return a valid JSON object strictly with the following keys:
    {{
        "score": <number 0-100>,
        "analysis": "<string explanation>"
    }}
    """
    
    structured_llm = llm.with_structured_output(CompanyCompetitivenessResult)
    result = structured_llm.invoke(prompt)
    
    return result.dict()
