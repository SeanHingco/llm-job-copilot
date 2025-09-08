import os, json, base64, httpx
from pathlib import Path
from fastapi import Header, HTTPException
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_ANON_KEY = (os.getenv("SUPABASE_ANON_KEY") or "").strip()

def _b64url(s: str) -> str:
    pad = '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad).decode("utf-8", "ignore")

async def verify_supabase_session(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]

    # TEMP dev logs (remove later)
    try:
        iss = json.loads(_b64url(token.split(".")[1])).get("iss")
        print("API SUPABASE_URL:", SUPABASE_URL)
        print("Token iss:", iss)
        print("ANON len:", len(SUPABASE_ANON_KEY))
    except Exception:
        pass

    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": SUPABASE_ANON_KEY,        # <— header
    }
    params = {"apikey": SUPABASE_ANON_KEY}  # <— query param too

    async with httpx.AsyncClient(timeout=5) as client:
        r = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, params=params)

    if r.status_code == 200:
        u = r.json()
        return {"user_id": u.get("id"), "email": u.get("email")}

    # Bubble up why (helps debug)
    raise HTTPException(status_code=401, detail=f"Invalid token: {r.status_code} {r.text[:200]}")
