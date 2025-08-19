from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx

router = APIRouter(prefix="/ingest", tags=["ingest"])

# -- Models ---
class IngestRequest(BaseModel):
    url: HttpUrl

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
)

# --- Routes ---
@router.post("")
async def ingest(request: IngestRequest):
    """
    Ingest content from a URL.
    """
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            headers={"User-Agent": UA},
        ) as client:
            resp = await client.get(str(request.url))
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Fetch failed: {e}") from e

    return {
        "status": "fetched",
        "url": str(request.url),
        "http_status": resp.status_code,
        "content_type": resp.headers.get("content-type", ""),
        "text_length": len(resp.text),
        "preview": resp.text[:200],
    }
    