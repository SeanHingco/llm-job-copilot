import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from app.agents.schemas.resume_scan_schema import ScanResumeInput
from app.agents.schemas.resume_clarity_schema import ResumeClarityResult


llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.environ.get("GEMINI_API_KEY"),
)

_clarity_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert resume writer. Evaluate the Resume Clarity.\n"
            "Assess how easy it is to read and understand the candidate's value proposition.\n"
            "Note: You are reading raw text, so focus on logical structure, language clarity, and information density, rather than visual layout."
        ),
        (
            "human",
            "RESUME TEXT:\n{resume_text}\n\n"
            "Scoring Guide (0-100):\n"
            "- 90-100: Crystal clear wording, result-oriented, jargon matches the role, very easy to scan.\n"
            "- 75-89: Good clarity, standard sections, minor word, syntax, or grammar issues.\n"
            "- 60-74: Readable but dense, passive voice, or slightly disorganized.\n"
            "- <50: Confusing, rambling, unstructured, or riddled with errors.\n\n"
            "Fill the ResumeClarityResult schema with:\n"
            "- score: 0-100\n"
            "- analysis: brief explanation of clarity\n"
            "- formatting_issues: list of dense text, inconsistent bullets, etc.\n"
            "- quantification_score: 0-100 on achievement metrics\n"
            "- action_verb_strength: 0-100 on strong verbs\n"
            "- section_ordering_quality: e.g. Logical, Buried Skills\n\n"
            "Return a valid JSON object strictly matching the schema."
        ),
    ]
)


def calculate_resume_clarity_domain(input: ScanResumeInput) -> ResumeClarityResult:
    """
    Evaluates the clarity, structure, and readability of the resume using LLM.
    """
    chain = _clarity_prompt | llm.with_structured_output(ResumeClarityResult)
    return chain.invoke({"resume_text": input.resume_text})
