# jd_fetch.py
import re
import httpx
from bs4 import BeautifulSoup

JS_PLACEHOLDERS = ("enable javascript", "requires javascript", "<noscript", "turn on javascript")

def looks_js_placeholder(s: str) -> bool:
    t = (s or "").lower()
    return any(p in t for p in JS_PLACEHOLDERS)

def extract_meta_fallback(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    # try og/twitter/description
    for prop in ("og:description", "twitter:description"):
        tag = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
        if tag and tag.get("content"):
            return tag["content"].strip()
    tag = soup.find("meta", attrs={"name": "description"})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return (soup.title.string or "").strip() if soup.title else ""

def readability_extract(html: str) -> str:
    # plug in your current extractor here
    # e.g., from your existing util: your_readability_or_extractor(html)
    # for now, do a cheap text fallback:
    soup = BeautifulSoup(html or "", "html.parser")
    # remove script/style
    for tag in soup(["script", "style", "noscript"]): tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    return text

async def fetch_static_html(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
    async with httpx.AsyncClient(follow_redirects=True, headers=headers, timeout=15) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text

async def fetch_rendered_html(url: str, timeout_ms: int = 12000) -> str:
    from playwright.async_api import async_playwright  # lazy import
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124 Safari/537.36"
                )
            )
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
            await page.wait_for_timeout(500)
            return await page.content()
        finally:
            await browser.close()

async def fetch_jd_text(url: str, allow_render: bool = False) -> tuple[str, str]:
    """
    Returns (jd_text, path_used) where path_used in {"primary","meta_fallback","rendered","best_effort"}.
    """
    html = await fetch_static_html(url)
    txt = readability_extract(html).strip()

    # If static extraction looks good, use it
    if txt and len(txt) >= 500 and not looks_js_placeholder(txt):
        return txt, "primary"

    # Try meta fallback
    meta = extract_meta_fallback(html)
    if meta and len(meta) >= 120:
        return meta, "meta_fallback"

    # Optionally render with Playwright
    if allow_render:
        try:
            rendered = await fetch_rendered_html(url)
            rtxt = readability_extract(rendered).strip()
            if rtxt and len(rtxt) >= 500 and not looks_js_placeholder(rtxt):
                return rtxt, "rendered"
        except Exception:
            pass

    # Best effort (still return something)
    return (txt or meta or html[:300]).strip(), "best_effort"
