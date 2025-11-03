from pydantic import BaseSettings

class Settings(BaseSettings):
    RB_AGENTIC: int = 0
    RB_MODEL: str = "gemini-1.5-pro"
    LLM_TIMEOUT_MS: int = 30000

    class Config:
        env_file = ".env"

settings = Settings()