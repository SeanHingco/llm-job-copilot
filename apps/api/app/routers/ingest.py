from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl

router = APIRouter(prefix="/ingest", tags=["ingest"])

class IngestRequest(BaseModel):
    url: HttpUrl

# --- Routes ---

@router.post("/url")
async def ingest(request: IngestRequest):
    """
    Ingest content from a URL.
    """
    return {"status": "queued", "url": str(request.url)}