from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    RB_AGENTIC: int = 0
    RB_MODEL: str = "gemini-2.5-flash"
    LLM_TIMEOUT_MS: int = 30000
    GEMINI_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",          # <-- crucial
        case_sensitive=False,    # allow lowercase keys like supabase_url
        # env_prefix=""          # (optional) keep as-is
    )

settings = Settings()