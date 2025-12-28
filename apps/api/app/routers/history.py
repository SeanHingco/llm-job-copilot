from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any, Optional
import json
import re
from app.auth import verify_supabase_session as verify_user
from app.supabase_db import get_drafts
from app.supabase_db import REST, HEADERS
import httpx

bearer = HTTPBearer()

router = APIRouter(
    prefix="/history",
    tags=["history"],
)

def extract_json_from_markdown(s: str) -> Any:
    """Extract JSON from markdown code blocks like ```json\n{...}\n```"""
    if not isinstance(s, str):
        return None
    
    # Try to find markdown code blocks
    fence_match = re.search(r'```[\w]*\s*\n(.*?)```', s, re.DOTALL)
    if fence_match:
        inner = fence_match.group(1).strip()
        try:
            return json.loads(inner)
        except:
            pass
    
    # Try direct JSON parse
    try:
        return json.loads(s)
    except:
        return None

def parse_draft_data(draft: Dict[str, Any]) -> Dict[str, Any]:
    """Parse draft data, extracting from outputs_json if needed and parsing markdown-wrapped JSON"""
    if not draft:
        return draft
    
    parsed = dict(draft)
    outputs = draft.get("outputs_json") or {}
    
    # Helper to get and parse a field
    def get_parsed_field(field_name: str, outputs_key: Optional[str] = None) -> Any:
        # First check direct field
        direct_value = draft.get(field_name)
        if direct_value:
            if isinstance(direct_value, (dict, list)):
                return direct_value
            elif isinstance(direct_value, str):
                parsed_val = extract_json_from_markdown(direct_value)
                if parsed_val:
                    return parsed_val
                return direct_value
        
        # Fallback to outputs_json
        if outputs_key and outputs_key in outputs:
            output_value = outputs[outputs_key]
            if isinstance(output_value, (dict, list)):
                return output_value
            elif isinstance(output_value, str):
                parsed_val = extract_json_from_markdown(output_value)
                if parsed_val:
                    return parsed_val
                return output_value
        
        return direct_value
    
    # Parse interview_points - check outputs_json.talking_points or outputs_json.bullets
    # Interview points might be stored in bullets field, but we need to check if it's actually interview points structure
    if not parsed.get("interview_points"):
        interview_data = None
        
        # First check if interview_points is an object with a bullets property (common structure)
        interview_points_field = draft.get("interview_points")
        if interview_points_field and isinstance(interview_points_field, dict):
            # Check if it has a bullets property (which contains the actual JSON string)
            if "bullets" in interview_points_field and isinstance(interview_points_field["bullets"], str):
                parsed_bullets = extract_json_from_markdown(interview_points_field["bullets"])
                if parsed_bullets and isinstance(parsed_bullets, dict):
                    # Check if it looks like interview points structure
                    if "strengths" in parsed_bullets or "gaps" in parsed_bullets or "interview_questions" in parsed_bullets:
                        interview_data = parsed_bullets
            elif "strengths" in interview_points_field or "gaps" in interview_points_field or "interview_questions" in interview_points_field:
                # Already parsed interview points structure
                interview_data = interview_points_field
        elif isinstance(interview_points_field, str):
            # If it's a string, try to parse it
            parsed_str = extract_json_from_markdown(interview_points_field)
            if parsed_str and isinstance(parsed_str, dict):
                if "strengths" in parsed_str or "gaps" in parsed_str or "interview_questions" in parsed_str:
                    interview_data = parsed_str
        
        # If not found, check outputs_json.talking_points
        if not interview_data:
            interview_data = get_parsed_field("interview_points", "talking_points")
        
        # If still not found, check outputs_json.bullets - but verify it's interview points structure
        if not interview_data and "bullets" in outputs:
            bullets_value = outputs["bullets"]
            if isinstance(bullets_value, str):
                parsed_bullets = extract_json_from_markdown(bullets_value)
                if parsed_bullets and isinstance(parsed_bullets, dict):
                    # Check if it looks like interview points (has strengths, gaps, interview_questions)
                    # vs resume bullets (has bullets array)
                    if "strengths" in parsed_bullets or "gaps" in parsed_bullets or "interview_questions" in parsed_bullets:
                        interview_data = parsed_bullets
            elif isinstance(bullets_value, dict):
                # Already parsed, check if it's interview points
                if "strengths" in bullets_value or "gaps" in bullets_value or "interview_questions" in bullets_value:
                    interview_data = bullets_value
        
        if interview_data:
            parsed["interview_points"] = interview_data
    
    # Parse resume_bullets
    if not parsed.get("resume_bullets"):
        bullets_data = get_parsed_field("resume_bullets", "bullets")
        if bullets_data:
            parsed["resume_bullets"] = bullets_data
    
    # Parse cover_letter
    # Check both cover_letter field and outputs_json.bullets (cover letter might be stored in bullets field)
    cover_data = None
    
    # First, check if cover_letter field exists and parse it
    cover_letter_field = draft.get("cover_letter")
    if cover_letter_field:
        if isinstance(cover_letter_field, dict):
            # Already parsed - check if it's a cover letter structure
            if "subject" in cover_letter_field and "body_paragraphs" in cover_letter_field:
                cover_data = cover_letter_field
        elif isinstance(cover_letter_field, str):
            # Parse from string (might have markdown code blocks)
            parsed_cover = extract_json_from_markdown(cover_letter_field)
            if parsed_cover and isinstance(parsed_cover, dict):
                # Check if it looks like a cover letter
                if "subject" in parsed_cover and "body_paragraphs" in parsed_cover:
                    cover_data = parsed_cover
    
    # If not found, check outputs_json.bullets - sometimes cover letter is stored there
    # This is important because cover letters are often stored in outputs_json.bullets
    if not cover_data and "bullets" in outputs:
        bullets_value = outputs["bullets"]
        # Check if bullets contains cover letter JSON structure (has subject, greeting, body_paragraphs)
        if isinstance(bullets_value, str):
            parsed_bullets = extract_json_from_markdown(bullets_value)
            if parsed_bullets and isinstance(parsed_bullets, dict):
                # Check if it looks like a cover letter (has cover letter structure)
                # Cover letters have: subject, greeting, body_paragraphs, valediction, signature
                # Resume bullets have: bullets array or text field
                if "subject" in parsed_bullets and "body_paragraphs" in parsed_bullets:
                    cover_data = parsed_bullets
        elif isinstance(bullets_value, dict):
            # Already parsed, check if it's a cover letter
            if "subject" in bullets_value and "body_paragraphs" in bullets_value:
                cover_data = bullets_value
    
    # Also check outputs_json.cover_letter
    if not cover_data and "cover_letter" in outputs:
        cl_output = outputs["cover_letter"]
        if isinstance(cl_output, dict):
            if "subject" in cl_output and "body_paragraphs" in cl_output:
                cover_data = cl_output
        elif isinstance(cl_output, str):
            parsed_cl = extract_json_from_markdown(cl_output)
            if parsed_cl and isinstance(parsed_cl, dict) and "subject" in parsed_cl and "body_paragraphs" in parsed_cl:
                cover_data = parsed_cl
    
    if cover_data:
        parsed["cover_letter"] = cover_data
        print(f"[parse_draft_data] Found and parsed cover letter with subject: {cover_data.get('subject', 'N/A')}")
    else:
        print(f"[parse_draft_data] No cover letter found. cover_letter field: {type(cover_letter_field)}, outputs.bullets: {'present' if 'bullets' in outputs else 'missing'}")
    
    # Parse ats_alignment
    # Data is often stored as a wrapper object with a `bullets` field containing markdown-wrapped JSON
    if not parsed.get("ats_alignment"):
        ats_data = None

        ats_field = draft.get("ats_alignment")

        # Helper to try to parse a potential ATS alignment payload
        def parse_ats_source(val: Any) -> Any:
            if isinstance(val, dict):
                # Already a parsed alignment-like object
                if "summary" in val and "coverage" in val:
                    return val
                # Wrapper object with inner JSON under "bullets"
                if "bullets" in val and isinstance(val["bullets"], str):
                    inner = extract_json_from_markdown(val["bullets"])
                    if isinstance(inner, dict) and "summary" in inner and "coverage" in inner:
                        return inner
            elif isinstance(val, str):
                inner = extract_json_from_markdown(val)
                if isinstance(inner, dict) and "summary" in inner and "coverage" in inner:
                    return inner
            return None

        # 1) Check direct ats_alignment column
        if ats_field:
            ats_data = parse_ats_source(ats_field)

        # 2) Fallback to outputs_json.ats_alignment
        if not ats_data and "ats_alignment" in outputs:
            ats_data = parse_ats_source(outputs["ats_alignment"])

        if ats_data:
            parsed["ats_alignment"] = ats_data
    
    # Parse bender_score_data (similar handling to first_impression)
    if not parsed.get("bender_score_data"):
        bsd_data = get_parsed_field("bender_score_data", "bender_score_data")
        if bsd_data:
            # If it's a wrapper with bullets
            if isinstance(bsd_data, dict) and "bullets" in bsd_data and isinstance(bsd_data["bullets"], str):
                parsed_inner = extract_json_from_markdown(bsd_data["bullets"])
                if parsed_inner:
                    parsed["bender_score_data"] = parsed_inner
                else:
                    parsed["bender_score_data"] = bsd_data
            else:
                parsed["bender_score_data"] = bsd_data
        elif "bender_score_data" in outputs:
            out_val = outputs["bender_score_data"]
            if isinstance(out_val, str):
                parsed_inner = extract_json_from_markdown(out_val)
                if parsed_inner:
                    parsed["bender_score_data"] = parsed_inner
                else:
                    parsed["bender_score_data"] = out_val
            elif isinstance(out_val, dict):
                parsed["bender_score_data"] = out_val
    
    # Parse first_impression
    if not parsed.get("first_impression"):
        fi_data = get_parsed_field("first_impression", "first_impression")
        if fi_data:
            parsed["first_impression"] = fi_data
    
    return parsed

@router.get("")
async def list_history(
    limit: int = 50,
    user: Dict[str, Any] = Depends(verify_user)
):
    """
    List past drafts for the authenticated user.
    """
    user_id = user["user_id"]
    try:
        data = await get_drafts(user_id=user_id, limit=limit)
        # Parse each draft
        parsed_data = [parse_draft_data(d) for d in data]
        return parsed_data
    except Exception as e:
        print(f"Error fetching history: {e}")
        # Return empty list or 500? Empty list is safer for UI, but 500 is technically correct.
        # Let's return 500 to aid debugging if DB is down.
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {e}")

@router.get("/{draft_id}")
async def get_draft_detail(
    draft_id: str,
    user: Dict[str, Any] = Depends(verify_user)
):
    """
    Get details for a specific draft by client_ref_id (primary key).
    """
    user_id = user["user_id"]
    
    # Look up by client_ref_id (which is the primary key)
    params = {
        "client_ref_id": f"eq.{draft_id}",
        "user_id": f"eq.{user_id}",
        "select": "*",
        "limit": "1",
    }
    
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{REST}/drafts", params=params, headers=HEADERS)
        r.raise_for_status()
        rows = r.json()
        draft = rows[0] if rows else None
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Parse the draft data before returning
    parsed_draft = parse_draft_data(draft)
    return parsed_draft
