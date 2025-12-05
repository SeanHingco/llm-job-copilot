import os
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

class ExperienceFitResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the experience fit.")
    analysis: str = Field(..., description="A brief explanation of how the candidate's experience matches the job.")

@tool
def calculate_experience_fit(resume_text: str, job_description_text: str) -> dict:
    """
    Evaluates how well the candidate's work history and skills match the job requirements.
    Considers years of experience, relevant industries, specific technologies/skills, and leadership levels.
    """
    
    _provider_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(
        model=_provider_model,
        temperature=0,
        api_key=os.environ["GEMINI_API_KEY"],
    )
    
    prompt = f"""
    You are an expert technical recruiter. Evaluate the Experience Fit.

    RESUME:
    {resume_text}
    
    JOB DESCRIPTION:
    {job_description_text}
    
    Task:
    1. Compare the candidate's years of experience vs required years.
    2. Check for key hard skills and technologies mentioned in the JD.
    3. Evaluate industry relevance and role seniority (e.g. Junior vs Senior vs Lead).
    
    Scoring Guide:
    - 90-100: Exceeds or perfectly matches all key requirements (Years, Tech Stack, Industry).
    - 75-89: Strong match, missing only minor nice-to-haves.
    - 60-74: Good match but maybe slightly junior or missing one key framework.
    - 40-59: Partial match, transferable skills but significant gaps.
    - <40: Not qualified (e.g. Junior applying for Principal, or completely different tech stack).
    
    Return a valid JSON object strictly with the following keys:
    {{
        "score": <number 0-100>,
        "analysis": "<string explanation>"
    }}
    """
    
    structured_llm = llm.with_structured_output(ExperienceFitResult)
    result = structured_llm.invoke(prompt)
    
    return result.dict()
