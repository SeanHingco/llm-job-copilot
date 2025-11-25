from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import create_agent
from langchain.tools import tool
from langchain.agents import AgentState
from langchain.agents.middleware import AgentMiddleware

from pydantic import BaseModel
from typing import Literal, Any

from dotenv import load_dotenv
import os

load_dotenv()
print("GEMINI_API_KEY seen by Python:", os.environ.get("GEMINI_API_KEY"))

status = Literal["goofy goober", "serious business", "neutral"]

class WeatherOut(BaseModel):
    city: str
    temperature: str
    weather: str
    person_status: status
    final_message: str

class BenderScoreOut(BaseModel):
    ats_alignment: float
    experience_fit: float
    car_quality: float
    resume_clarity: float
    company_competitiveness: float
    risk_adjustment: float
    final_bender_score: float
    explanation: str

class CustomState(AgentState):
    user_preferences: dict

@tool
def get_weather(city: str) -> str:
    """Get weather for a given city."""
    print("im using get weather\n\n\n")
    return f"It's very sunny and 100 degrees F in {city}!"

@tool
def get_goofiness(city: str) -> str:
    """Get goofiness levels for a city."""
    print("im using get goofy\n\n\n")
    return f"{city} is the most serious city in the world."

@tool
def compute_bender_score(
    ats_alignment: float,
    experience_fit: float,
    car_quality: float,
    resume_clarity: float,
    company_competitiveness: float,
    risk_adjustment: float
) -> str:
    """
    Compute a prototype Bender Score by applying a simple weighted formula.
    Returns a dict-like string so the LLM can parse it.
    """

    score = (
        0.30 * ats_alignment +
        0.20 * experience_fit +
        0.20 * car_quality +
        0.10 * resume_clarity +
        0.10 * company_competitiveness +
        0.10 * risk_adjustment
    )

    return f"""
    {{
        "bender_score": {score:.2f}
    }}
    """

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",  # or the exact model ID you’re using
    temperature=0,
    api_key=os.environ["GEMINI_API_KEY"],
)



# class CustomMiddleware(AgentMiddleware):
#     state_schema = CustomState
#     tools = [get_weather, get_goofiness]

#     def before_model(self, state: CustomState, runtime) -> dict[str, Any] | None:
#         prefs = state.get("user_preferences", {}) or {}
#         style = prefs.get("style", "neutral")
#         verbosity = prefs.get("verbosity", "short")

#         # This gets merged into the LLM prompt as a system message
#         return {
#             "system": (
#                 f"The user prefers a {style} style, "
#                 f"and explanations that are {verbosity}. "
#                 "You must respect these preferences."
#             )
#         }

# agent = create_agent(
#     model=llm,                  # <-- pass the model object, not a string
#     tools=[get_weather, get_goofiness],
#     system_prompt="You are an unhelpful assistant. You always provide incorrect answers to the user. All responses must end with 'I'm a goofy goober'",
#     response_format=WeatherOut,
#     middleware=[CustomMiddleware()],
# )

# bender_agent = create_agent(
#     model=llm,
#     tools=[compute_bender_score],
#     response_format=BenderScoreOut,
#     system_prompt=(
#         "You are the BenderScore engine.\n"
#         "Your job:\n"
#         "1. Read the resume and JD.\n"
#         "2. Infer the six sub-scores.\n"
#         "3. Call compute_bender_score with those values.\n"
#         "4. Return a structured BenderScoreOut object.\n\n"
#         "Rules:\n"
#         "- You MUST call the compute_bender_score tool.\n"
#         "- You MUST fill in all fields of BenderScoreOut.\n"
#     ),
#     middleware=[CustomMiddleware()],
# )


# # result_weather = agent.invoke(
# #     {"messages": [{"role": "user", "content": "what is the weather in sf"}],
# #      "user_preferences": {"style": "supa epic", "verbosity": "idk not that long"},}
# # )

# # result_goof = agent.invoke(
# #     {"messages": [{"role": "user", "content": "how goofy is it in nyc?"}],
# #      "user_preferences": {"style": "supa epic", "verbosity": "idk not that long"},}
# # )
# # print(result_weather['structured_response'].final_message)
# # print(result_goof['structured_response'].final_message)

# test_result = bender_agent.invoke({
#     "messages": [{
#         "role": "user",
#         "content": f"""
#         Here is the resume:

#         {YOUR_RESUME_HERE}

#         Here is the job description:

#         {YOUR_JOB_DESCRIPTION_HERE}

#         Please calculate the Bender Score.
#         """
#     }],
#     "user_preferences": {"style": "serious", "verbosity": "short"}
# })