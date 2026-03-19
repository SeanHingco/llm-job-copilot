# app/routers/applications.py
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import httpx

from app.auth import verify_supabase_session as verify_user
from app.supabase_db import REST, HEADERS

ApplicationStatus = Literal["drafting", "applied", "interviewing", "offer", "rejected", "archived"]


class ApplicationFromDraftIn(BaseModel):
    draft_id: str  # client_ref_id
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_link: Optional[str] = None
    status: Optional[ApplicationStatus] = "drafting"
    notes: Optional[str] = None

router = APIRouter(
    prefix="/applications",
    tags=["applications"],
)

# Mirror your enum values in DB
ApplicationStatus = Literal[
    "drafting",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "archived",
]

class ApplicationCreateIn(BaseModel):
    company_name: str
    job_title: str
    job_link: Optional[str] = None
    status: Optional[ApplicationStatus] = "drafting"
    notes: Optional[str] = None

    # Optional: allow client to set applied_at explicitly
    applied_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None

class ApplicationUpdateIn(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    job_link: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None


@router.post("")
async def create_application(
    payload: ApplicationCreateIn,
    user: Dict[str, Any] = Depends(verify_user),
):
    user_id = user["user_id"]

    body = {
        "user_id": user_id,
        "company_name": payload.company_name,
        "job_title": payload.job_title,
        "job_link": payload.job_link,
        "status": payload.status or "drafting",
        "notes": payload.notes,
        "applied_at": payload.applied_at,
        "last_activity_at": payload.last_activity_at,
    }

    # Remove None keys so Supabase doesn’t overwrite defaults
    body = {k: v for k, v in body.items() if v is not None}

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{REST}/job_applications",
            params={"select": "*"},
            headers={**HEADERS, "Prefer": "return=representation"},
            json=body,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Failed to create application: {r.text}")

        rows = r.json()
        return rows[0] if rows else {}


@router.get("")
async def list_applications(
    limit: int = 50,
    status: Optional[ApplicationStatus] = None,
    user: Dict[str, Any] = Depends(verify_user),
):
    user_id = user["user_id"]

    params = {
        "user_id": f"eq.{user_id}",
        "select": "*",
        "limit": str(limit),
        # Sort: most recently active first; fallback to created_at
        "order": "last_activity_at.desc.nullslast,created_at.desc",
    }
    if status:
        params["status"] = f"eq.{status}"

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{REST}/job_applications", params=params, headers=HEADERS)
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Failed to list applications: {r.text}")
        return r.json()


@router.patch("/{app_id}")
async def update_application(
    app_id: str,
    payload: ApplicationUpdateIn,
    user: Dict[str, Any] = Depends(verify_user),
):
    user_id = user["user_id"]

    # ✅ JSON-safe (datetimes become ISO strings)
    patch = payload.model_dump(exclude_unset=True, mode="json")
    if not patch:
        return {"success": True, "message": "No changes"}

    now = datetime.now(timezone.utc).isoformat()

    # If status becomes "applied" and applied_at not provided, set it
    if patch.get("status") == "applied" and "applied_at" not in patch:
        patch["applied_at"] = now

    # Always bump last_activity_at unless explicitly set
    if "last_activity_at" not in patch:
        patch["last_activity_at"] = now

    params = {
        "id": f"eq.{app_id}",
        "user_id": f"eq.{user_id}",
        "select": "*",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{REST}/job_applications",
            params=params,
            headers={**HEADERS, "Prefer": "return=representation"},
            json=patch,
        )

        if r.status_code >= 400:
            # (optional improvement) pass through real status instead of always 500
            raise HTTPException(status_code=r.status_code, detail=f"Failed to update application: {r.text}")

        rows = r.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Application not found")
        return rows[0]

@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    user: Dict[str, Any] = Depends(verify_user),
):
    user_id = user["user_id"]

    params = {
        "id": f"eq.{app_id}",
        "user_id": f"eq.{user_id}",
        "select": "id",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.delete(
            f"{REST}/job_applications",
            params=params,
            headers={**HEADERS, "Prefer": "return=representation"},
        )

    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=f"Failed to delete application: {r.text}")

    rows = r.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found")

    return {"success": True, "deleted_id": rows[0]["id"]}


@router.post("/from-draft")
async def create_application_from_draft(
    payload: ApplicationFromDraftIn,
    user: Dict[str, Any] = Depends(verify_user),
):
    user_id = user["user_id"]

    async with httpx.AsyncClient(timeout=10) as client:
        # 1) Fetch the draft (owned by user)
        r = await client.get(
            f"{REST}/drafts",
            params={
                "client_ref_id": f"eq.{payload.draft_id}",
                "user_id": f"eq.{user_id}",
                "select": "client_ref_id,job_title,job_link,company_name,created_at",
                "limit": "1",
            },
            headers=HEADERS,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Failed to fetch draft: {r.text}")
        rows = r.json()
        draft = rows[0] if rows else None
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        # 2) Build application body (prefer payload overrides, fallback to draft)
        company_name = payload.company_name or draft.get("company_name") or "Unknown Company"
        job_title = payload.job_title or draft.get("job_title") or "Unknown Role"
        job_link = payload.job_link or draft.get("job_link")

        app_body = {
            "user_id": user_id,
            "company_name": company_name,
            "job_title": job_title,
            "job_link": job_link,
            "status": payload.status or "drafting",
            "notes": payload.notes,
            "last_activity_at": datetime.utcnow().isoformat(),
        }
        app_body = {k: v for k, v in app_body.items() if v is not None}

        # 3) Create application
        r2 = await client.post(
            f"{REST}/job_applications",
            params={"select": "*"},
            headers={**HEADERS, "Prefer": "return=representation"},
            json=app_body,
        )
        if r2.status_code >= 400:
            raise HTTPException(status_code=500, detail=f"Failed to create application: {r2.text}")
        created_rows = r2.json()
        app_row = created_rows[0] if created_rows else None
        if not app_row:
            raise HTTPException(status_code=500, detail="Application creation returned no row")

        app_id = app_row["id"]

        # 4) Attach draft to application (update drafts.application_id)
        r3 = await client.patch(
            f"{REST}/drafts",
            params={
                "client_ref_id": f"eq.{payload.draft_id}",
                "user_id": f"eq.{user_id}",
                "select": "client_ref_id,application_id",
            },
            headers={**HEADERS, "Prefer": "return=representation"},
            json={"application_id": app_id},
        )
        if r3.status_code >= 400:
            # rollback? (optional MVP: leave the app row; you can also delete it here)
            raise HTTPException(status_code=500, detail=f"Failed to attach draft to application: {r3.text}")

        updated_draft = (r3.json()[0] if r3.json() else None)

        return {"application": app_row, "draft": updated_draft}
