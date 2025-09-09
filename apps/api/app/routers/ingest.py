from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup
from app.utils.chunk import chunk_text
from app.utils.context import build_context
from app.utils.retrieve import rank_chunks_by_keywords
from urllib.parse import urlparse, parse_qs
from typing import Optional
import json

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

def _clean_text(s: str) -> str:
    return " ".join((s or "").split())

def _extract_from_json_ld(html: str) -> list[str]:
    """
    Look for <script type="application/ld+json"> and pull likely description fields.
    Works for many job boards (incl. Ashby) that embed JobPosting JSON.
    """
    out: list[str] = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = tag.string or tag.get_text("", strip=True)
            if not raw:
                continue
            # Some sites put multiple JSON objects or invalid trailing commas—be defensive.
            candidates = []
            try:
                candidates = [json.loads(raw)]
            except Exception:
                # try to parse line-by-line arrays
                continue

            def dig(node):
                if isinstance(node, dict):
                    for k, v in node.items():
                        if isinstance(v, str) and k.lower() in ("description", "jobdescription", "summary", "text", "content"):
                            # Strip any HTML inside description
                            out.append(_clean_text(BeautifulSoup(v, "html.parser").get_text(" ", strip=True)))
                        else:
                            dig(v)
                elif isinstance(node, list):
                    for item in node:
                        dig(item)

            for c in candidates:
                dig(c)
    except Exception:
        pass
    # de-dupe and keep non-trivial chunks
    uniq = []
    seen = set()
    for s in out:
        if len(s) > 150 and s not in seen:
            uniq.append(s); seen.add(s)
    return uniq

def _extract_from_next_data(html: str) -> list[str]:
    """
    For Next.js apps (script#__NEXT_DATA__), walk JSON for long 'description'-like strings.
    """
    out: list[str] = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        tag = soup.find("script", id="__NEXT_DATA__")
        if not tag:
            return out
        raw = tag.string or tag.get_text("", strip=True)
        if not raw:
            return out
        data = json.loads(raw)

        keys = {"description", "jobdescription", "summary", "content", "body", "html"}
        MIN_LEN = 200

        def dig(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if isinstance(v, str) and k.lower() in keys and len(v) >= MIN_LEN:
                        out.append(_clean_text(BeautifulSoup(v, "html.parser").get_text(" ", strip=True)))
                    else:
                        dig(v)
            elif isinstance(node, list):
                for item in node:
                    dig(item)

        dig(data)
    except Exception:
        pass
    # de-dupe
    uniq = []
    seen = set()
    for s in out:
        if s not in seen:
            uniq.append(s); seen.add(s)
    return uniq

def _extract_text_robust(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string or "").strip() if (soup.title and soup.title.string) else ""
    for tag in soup(["script", "style", "template"]):  # ← keep 'noscript'
        tag.decompose()
    base_text = soup.body.get_text(" ", strip=True) if soup.body else soup.get_text(" ", strip=True)
    base_text = _clean_text(base_text)
    if len(base_text) < 300:
        parts = _extract_from_json_ld(html) or _extract_from_next_data(html)
        if parts:
            return title, _clean_text(" ".join(parts))
    return title, base_text


def normalize_url(v: str) -> str:
    s = (v or "").strip()
    if s.startswith("//"):
        return "https:" + s
    if not s.startswith(("http://", "https://")):
        return "https://" + s
    return s

def _looks_blocked(html: str, text: str, debug_url: str = "") -> bool:
    t = (text or "").lower()
    h = (html or "").lower()

    has_password = ('type="password"' in h) or ('name="password"' in h)
    # Many legit pages load recaptcha script — don't block on this alone.
    has_captcha  = ("captcha" in h or "g-recaptcha" in h)
    shows_challenge = "verify you are a human" in h or "challenge" in h

    signals = ["access denied", "forbidden", "join to view"]
    hits = sum(1 for s in signals if s in t or s in h)

    try:
        print(f"INGEST_HEUR len_text={len(t)} hits={hits} pw={has_password} cap={has_captcha} ch={shows_challenge} url={debug_url}")
    except Exception:
        pass

    # Only block when we’re confident:
    if has_password:
        return True
    if shows_challenge and has_captcha and len(t) < 120:
        return True
    if len(t) < 80 and hits >= 1:
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
    # --- pasted text path (unchanged) ---
    pasted = (req.text or "").strip()
    if pasted:
        title = "Pasted job description"
        text = " ".join(pasted.split())

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

    # --- URL path ---
    if not req.url:
        raise HTTPException(status_code=400, detail="Provide either a URL or pasted job text.")

    target = normalize_url(req.url)
    final_url = target  # ← init early so it always exists
    is_indeed = "indeed." in urlparse(target).netloc.lower()

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            headers=BROWSER_HEADERS,
        ) as client:
            resp = await client.get(target)

            if resp.status_code == 403 and is_indeed:
                alt = _indeed_mobile_fallback(target)
                if alt:
                    alt_headers = dict(BROWSER_HEADERS)
                    alt_headers["Referer"] = f"https://{urlparse(target).netloc}/"
                    resp = await client.get(alt, headers=alt_headers)

            ctype = (resp.headers.get("content-type") or "").lower()
            raw_html = resp.text
            final_url = str(resp.url)  # ← update after redirects
            text_lc = raw_html[:4000].lower()

            # 1) obvious blocks → 422
            if resp.status_code in {401, 403, 406, 429, 451}:
                raise HTTPException(
                    status_code=422,
                    detail="This site blocks automated fetch. Please paste the job description text."
                )
            # 2) must be 2xx
            if not (200 <= resp.status_code < 300):
                raise HTTPException(status_code=400, detail=f"HTTP {resp.status_code}")
            # 3) looks like HTML?
            is_html = ("text/html" in ctype) or ("application/xhtml+xml" in ctype) or ("<html" in text_lc)
            if not is_html:
                raise HTTPException(status_code=400, detail=f"Expected HTML, got {resp.status_code} {ctype}")

            print("INGEST", resp.status_code, ctype, "len=", len(raw_html), "url=", final_url)

            # Extract once (this already falls back to JSON-LD / __NEXT_DATA__)
            title, text = _extract_text_robust(raw_html)

            # Gentle blocker check (now final_url is defined)
            if _looks_blocked(raw_html, text, final_url):
                raise HTTPException(
                    status_code=422,
                    detail="Could not access the full job description (site likely requires login or blocks automated fetch). Please paste the job description text."
                )

            # Continue with your pipeline
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

    