# api/app/routers/referral.py
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
import os, uuid
from ..supabase_db import referrer_exists, insert_referral_click

router = APIRouter()

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")  # e.g. ".resumebender.com" in prod

@router.get("/r/{code}")
async def referral_redirect(code: str, request: Request):
    code = (code or "").strip()
    if not code:
        return RedirectResponse(url=f"{FRONTEND_BASE_URL}/login", status_code=302)

    # 1) ensure referrer exists
    if not await referrer_exists(code):
        return RedirectResponse(url=f"{FRONTEND_BASE_URL}/login?ref=invalid", status_code=302)

    # 2) log click
    ip = (
        (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else "")
        or ""
    )
    ua = request.headers.get("user-agent") or ""
    click_id = str(uuid.uuid4())

    await insert_referral_click(code=code, click_id=click_id, ip=ip, ua=ua)

    # 3) set HttpOnly cookie + redirect
    resp = RedirectResponse(url=f"{FRONTEND_BASE_URL}/login?src=ref", status_code=302)
    resp.set_cookie(
        key="rb_ref",
        value=click_id,
        max_age=60 * 60 * 24 * 30,  # 30 days
        httponly=True,
        secure=True,
        samesite="lax",
        domain=COOKIE_DOMAIN or None,
        path="/",
    )
    return resp
