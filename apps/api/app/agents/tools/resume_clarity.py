import os
from langchain.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

class ResumeClarityResult(BaseModel):
    score: float = Field(..., description="A score from 0 to 100 representing the resume clarity.")
    analysis: str = Field(..., description="A brief explanation of the resume clarity and structure.")

@tool
def calculate_resume_clarity(resume_text: str) -> dict:
    """
    Evaluates the clarity, structure, and readability of the resume.
    Checks for:
    - Clear section headers.
    - Concise bullet points.
    - Lack of jargon clutter.
    - Logical flow and formatting (as inferred from text).
    """
    
    _provider_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(
        model=_provider_model,
        temperature=0,
        api_key=os.environ["GEMINI_API_KEY"],
    )
    
    prompt = f"""
    You are an expert resume writer. Evaluate the Resume Clarity.
    
    RESUME TEXT:
    {resume_text}
    
    Task:
    Assess how easy it is to read and understand the candidate's value proposition.
    Note: You are reading raw text, so focus on logical structure, language clarity, and information density, rather than visual layout.
    
    Scoring Guide (0-100):
    - 90-100: Crystal clear wording, result-oriented (e.g did this to lead to that impact numerically, qualitatively, or both ), jargon matches the role, very easy to scan mentally and on ats scanners.
    - 75-89: Good clarity, standard sections, minor word, syntax, or grammar issues, some impact is not clear or not substantial.
    - 60-74: Readable but dense, passive voice usage, or slightly disorganized, some jargon is not relevant to the role, most impact is not clear or substantial in general and to the role.
    - <50: Confusing, rambling, unstructured, or riddled with errors, jargon is not relevant to the role, most/all impact is not clear or substantial in general and to the role.
    
    Return a valid JSON object strictly with the following keys:
    {{
        "score": <number 0-100>,
        "analysis": "<string explanation>"
    }}
    """
    
    structured_llm = llm.with_structured_output(ResumeClarityResult)
    result = structured_llm.invoke(prompt)
    
    return result.dict()
