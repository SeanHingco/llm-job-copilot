from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from app.utils.chunk import chunk_text
from app.utils.context import build_context
from app.utils.retrieve import rank_chunks_by_keywords
from typing import Optional

router = APIRouter(prefix="/ingest", tags=["ingest"])

# -- Models ---
class IngestRequest(BaseModel):
    url: HttpUrl
    q: Optional[str] = None

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
)

# --- Routes ---
@router.post("")
async def ingest(req: IngestRequest):
    """
    Ingest content from a URL.
    """
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            headers={"User-Agent": UA},
        ) as client:
            resp = await client.get(str(req.url))
            ctype = resp.headers.get("content-type", "").lower()
            if resp.status_code != 200 or "text/html" not in ctype:
                raise HTTPException(
                    status_code=400,
                    detail=f"Expected HTML 200, got {resp.status_code} {ctype}",
                )
            final_url = str(resp.url)
            # create parser
            soup = BeautifulSoup(resp.text, 'html.parser')
            title = (soup.title.string or "").strip() if (soup.title and soup.title.string) else ""
            # drop non-content tags
            for tag in soup(['script', 'style', 'noscript', 'template']):
                tag.decompose()
            
            # extract any visible text
            raw = soup.body.get_text(" ", strip=True) if soup.body else soup.get_text(" ", strip=True)
            text = " ".join(raw.split())
            chunks = chunk_text(text, size=30, overlap=8)
            if req.q:
                idxs = rank_chunks_by_keywords(req.q, chunks, top_k=3)
                selected = [chunks[i] for i in idxs]
            else:
                idxs = list(range(min(len(chunks), 3)))
                selected = [chunks[i] for i in idxs]
            first_tail_prev = chunks[0][-20:] if len(chunks) > 0 else ""
            second_head_prev = chunks[1][:20] if len(chunks) > 1 else ""
            context, citations = build_context(selected, max_chars=2000, max_chunks=3)
            preview = text[:500]
    except httpx.RequestError as e:
        raise HTTPException(status_code=400, detail=f"Fetch failed: {e}") from e

    return {
        "status": "fetched",
        "url": str(req.url),
        "final_url": final_url,
        "http_status": resp.status_code,
        "content_type": resp.headers.get("content-type", ""),
        "text_length": len(text),
        "chunk_count": len(chunks),
        "first_tail": first_tail_prev,
        "second_head": second_head_prev,
        "citations": citations,
        "context_preview": context[:600],
        "query_preview": req.q or "",
        "title": title,
        "preview": preview,
    }
    