import os
import httpx

PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()

def _extract_text(data: dict) -> str:
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    except Exception:
        return ""

async def _gen_gemini(prompt: str, timeout: float = 60.0) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set; set LLM_PROVIDER=gemini and provide a key")

    # Default thinking OFF (0). Set GEMINI_THINKING_BUDGET to enable if desired.
    thinking_env = os.getenv("GEMINI_THINKING_BUDGET", "0")
    try:
        thinking_budget = int(thinking_env)
    except ValueError:
        thinking_budget = 0

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}

    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    # REST shape per docs: generationConfig.thinkingConfig.thinkingBudget
    # (0 disables thinking; omit this block to use default-on) :contentReference[oaicite:1]{index=1}
    payload["generationConfig"] = {"thinkingConfig": {"thinkingBudget": thinking_budget}}

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            status = e.response.status_code if e.response else "?"
            body = e.response.text if e.response is not None else ""
            if status in (401, 403):
                raise RuntimeError("Gemini auth error: check GEMINI_API_KEY") from e
            if status == 429:
                raise RuntimeError("Gemini rate limit or quota exceeded") from e
            raise RuntimeError(f"gemini HTTP {status}: {body.strip()}") from e
        except httpx.RequestError as e:
            raise RuntimeError(f"gemini request error: {e}") from e

    return _extract_text(r.json())

async def generate_text(prompt: str) -> str:
    if PROVIDER != "gemini":
        raise RuntimeError(f"LLM_PROVIDER={PROVIDER} not implemented yet. Set LLM_PROVIDER=gemini.")
    return await _gen_gemini(prompt)
