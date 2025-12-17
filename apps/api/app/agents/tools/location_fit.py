import os
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

class LocationFitResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the location fit.")
    analysis: str = Field(..., description="A brief explanation of the location fit.")

@tool
def calculate_location_fit(resume_text: str, job_description_text: str) -> dict:
    """
    Analyzes the location compatibility between a candidate's resume and a job description.
    Consider factors like:
    - Remote/Hybrid/On-site requirements.
    - Candidate's current location vs. Job location.
    - Willingness to relocate (if mentioned).
    Returns a dictionary with 'score' (0-100) and 'analysis'.
    """
    
    _provider_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(
        model=_provider_model,
        temperature=0,
        api_key=os.environ["GEMINI_API_KEY"],
    )
    
    prompt = f"""
    You are an expert recruiter evaluating location fit.
    
    RESUME:
    {resume_text}
    
    JOB DESCRIPTION:
    {job_description_text}
    
    Determine the location fit score (0-100).
    - 100: Perfect match (e.g. Remote role & candidate matches timezone/country, or Local candidate).
    - 80-99: Good match (e.g. Relocation open, or near location).
    - <50: Poor match (e.g. On-site required but candidate is far and no relocation mentioned).
    
    Return a valid JSON object strictly with the following keys:
    {{
        "score": <number 0-100>,
        "analysis": "<string explanation>"
    }}
    """
    
    structured_llm = llm.with_structured_output(LocationFitResult)
    result = structured_llm.invoke(prompt)
    
    return result.dict()
