# app/services/prompts.py
from pathlib import Path

class PromptStore:
    def __init__(self, base: str | Path = "prompts"):
        self.base = Path(base)
    
    def load(self, name: str) -> str:
        p = self.base / name
        if not p.exists():
            raise FileNotFoundError(f"Prompt not found: {p}")
        return p.read_text(encoding="utf-8")