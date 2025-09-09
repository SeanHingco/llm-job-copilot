from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from app.utils.chunk import chunk_text
from app.utils.context import build_context
from app.utils.retrieve import rank_chunks_by_keywords
from urllib.parse import urlparse, parse_qs
from typing import Optional

router = APIRouter(prefix="/ingest", tags=["ingest"])

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def _indeed_mobile_fallback(url: str) -> Optional[str]:
    """
    Build a mobile Indeed job URL if we can extract the jk/vjk.
    Works for domains like indeed.com, indeed.co.uk, etc.
    """
    u = urlparse(url)
    host = u.netloc.lower()
    if "indeed." not in host:
        return None
    qs = parse_qs(u.query or "")
    jk = (qs.get("jk") or qs.get("vjk") or [None])[0]
    if not jk:
        return None
    # Keep the original TLD (e.g., indeed.co.uk)
    return f"https://{host}/m/viewjob?jk={jk}"

def normalize_url(v: str) -> str:
    s = (v or "").strip()
    if s.startswith("//"):
        return "https:" + s
    if not s.startswith(("http://", "https://")):
        return "https://" + s
    return s

def _looks_blocked(html: str, text: str, debug_url: str = "") -> bool:
    """
    Return True only when we’re very likely on a login wall / bot block.
    Conservative: do NOT block just because the page is short or mentions 'log in'.
    """
    t = (text or "").lower()
    h = (html or "").lower()

    # Strong indicators
    has_password = ('type="password"' in h) or ('name="password"' in h)
    has_captcha  = ("captcha" in h) or ("g-recaptcha" in h)
    has_cf       = "cloudflare" in h or "cf-verify" in h

    # Common copy; keep it from triggering on normal pages
    signals = ["sign in", "log in", "join now", "join to view", "access denied",
               "forbidden", "please verify you are a human", "we're checking your browser"]
    hits = sum(1 for s in signals if s in t or s in h)

    # --- Debug once per call so we can tune quickly if needed ---
    try:
        print(f"INGEST_HEUR len_text={len(t)} hits={hits} pw={has_password} cap={has_captcha} cf={has_cf} url={debug_url}")
    except Exception:
        pass

    # Only block on explicit walls:
    #   - password/captcha/cloudflare markers
    #   - OR essentially no content *and* at least a couple “blocky” phrases
    if has_password or has_captcha or has_cf:
        return True
    if len(t) < 80 and hits >= 2:
        return True

    return False


# -- Models ---
class IngestRequest(BaseModel):
    url: Optional[str] = None
    q: Optional[str] = None
    text: Optional[str] = None

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
)

# --- Routes ---
@router.post("")
async def ingest(req: IngestRequest):
    """
    Ingest content from a URL or raw pasted text.
    """
    # try pasted text
    pasted = (req.text or "").strip()
    if pasted:
        title = "Pasted job description"
        text = " ".join(pasted.split())

        # same chunk/context pipeline you already use
        chunks = chunk_text(text, size=800, overlap=120)
        if req.q:
            idxs = rank_chunks_by_keywords(req.q, chunks, top_k=3)
            selected = [chunks[i] for i in idxs]
        else:
            idxs = list(range(min(len(chunks), 3)))
            selected = [chunks[i] for i in idxs]

        first_tail_prev  = chunks[0][-20:] if len(chunks) > 0 else ""
        second_head_prev = chunks[1][:20]  if len(chunks) > 1 else ""
        context, citations = build_context(selected, max_chars=3000, max_chunks=5)
        preview = text[:500]

        final_url = normalize_url(req.url) if req.url else ""

        return {
            "status": "fetched",
            "url": req.url or "",
            "final_url": final_url,
            "http_status": 200,
            "content_type": "text/plain",
            "text_length": len(text),
            "chunk_count": len(chunks),
            "context_length": len(context),
            "preview_length": len(preview),
            "first_tail": first_tail_prev,
            "second_head": second_head_prev,
            "citations": citations,
            "context_preview": context[:800],
            "context": context,
            "query_preview": req.q or "",
            "title": title,
            "preview": preview,
        }

    try:
        if not req.url:
            raise HTTPException(status_code=400, detail="Provide either a URL or pasted job text.")

        target = normalize_url(req.url)
        is_indeed = "indeed." in urlparse(target).netloc.lower()

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            # http2=True,
            headers=BROWSER_HEADERS,
        ) as client:
            # 1) Try the original URL
            resp = await client.get(target)

            # 2) If Indeed blocks (403), try the mobile page with a Referer
            if resp.status_code == 403 and is_indeed:
                alt = _indeed_mobile_fallback(target)
                if alt:
                    alt_headers = dict(BROWSER_HEADERS)
                    alt_headers["Referer"] = f"https://{urlparse(target).netloc}/"
                    resp = await client.get(alt, headers=alt_headers)

            ctype = (resp.headers.get("content-type") or "").lower()
            raw_html = resp.text
            text_lc = raw_html[:4000].lower()

            # 1) Clearly blocked statuses → 422
            if resp.status_code in {401, 403, 406, 429, 451}:
                raise HTTPException(
                    status_code=422,
                    detail="This site blocks automated fetch. Please paste the job description text."
                )

            # 2) Must be 2xx
            if not (200 <= resp.status_code < 300):
                raise HTTPException(status_code=400, detail=f"HTTP {resp.status_code}")

            # 3) HTML check: accept if content-type says so OR the body looks like HTML
            is_html = ("text/html" in ctype) or ("application/xhtml+xml" in ctype) or ("<html" in text_lc)
            if not is_html:
                raise HTTPException(status_code=400, detail=f"Expected HTML, got {resp.status_code} {ctype}")


            final_url = str(resp.url)
            print("INGEST", resp.status_code, ctype, "len=", len(resp.text), "url=", final_url)
            soup = BeautifulSoup(resp.text, "html.parser")
            title = (soup.title.string or "").strip() if (soup.title and soup.title.string) else ""

            for tag in soup(["script", "style", "noscript", "template"]):
                tag.decompose()

            raw = soup.body.get_text(" ", strip=True) if soup.body else soup.get_text(" ", strip=True)
            text = " ".join(raw.split())
            if _looks_blocked(raw_html, text, final_url):
                raise HTTPException(
                    status_code=422,
                    detail="Could not access the full job description (site likely requires login or blocks automated fetch). Please paste the job description text."
                )
            chunks = chunk_text(text, size=800, overlap=120)
            if req.q:
                idxs = rank_chunks_by_keywords(req.q, chunks, top_k=3)
                selected = [chunks[i] for i in idxs]
            else:
                idxs = list(range(min(len(chunks), 3)))
                selected = [chunks[i] for i in idxs]

            first_tail_prev = chunks[0][-20:] if len(chunks) > 0 else ""
            second_head_prev = chunks[1][:20] if len(chunks) > 1 else ""
            context, citations = build_context(selected, max_chars=3000, max_chunks=5)
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
        "context_length": len(context),
        "preview_length": len(preview),
        "first_tail": first_tail_prev,
        "second_head": second_head_prev,
        "citations": citations,
        "context_preview": context[:800],
        "context": context,
        "query_preview": req.q or "",
        "title": title,
        "preview": preview,
    }
    