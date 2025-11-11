# app/services/llm_client.py
from typing import Dict, Any
import os

from app.core.settings import settings
from langchain_google_genai.chat_models import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser


class LangChainLLMClient:
    """
    Minimal wrapper around LangChain's Gemini model that returns parsed JSON.
    """

    def __init__(self, model: str | None = None, temperature: float = 0.0):
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is not set")

        self.model = ChatGoogleGenerativeAI(
            model=model or settings.RB_MODEL,
            temperature=temperature,
            api_key=api_key,
        )
        self.parser = JsonOutputParser()

    def call_json(self, *, prompt: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        chain = ChatPromptTemplate.from_template(prompt) | self.model | self.parser
        return chain.invoke(variables)
