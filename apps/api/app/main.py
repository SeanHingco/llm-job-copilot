# api/app/main.py
from fastapi import FastAPI

app = FastAPI(title="LLM Job Copilot API")

@app.get("/health")
def health():
    return {"ok": True}