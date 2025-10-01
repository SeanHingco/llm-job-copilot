from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import io
import os
from pypdf import PdfReader
from io import BytesIO
import mammoth
from bs4 import BeautifulSoup


# constants
MAX_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
MAX_PAGES = 20

router = APIRouter(prefix="/resume", tags=["resume"])

def _is_pdf_header(chunk: bytes) -> bool:
    # PDFs almost always start with %PDF-
    return chunk.startswith(b"%PDF-")

def extract_docx_text(file_bytes: bytes) -> tuple[str, dict]:
    """
    Returns (text, meta)
    meta = {"warnings": [...], "method": "mammoth"}
    """
    # Primary path: Mammoth -> HTML -> plaintext (preserves bullets reasonably)
    result = mammoth.convert_to_html(BytesIO(file_bytes))
    html = result.value or ""
    warnings = [m.message for m in result.messages]
    text = BeautifulSoup(html, "html.parser").get_text("\n")
    # Normalize whitespace similar to your PDF/TXT path
    text = " ".join(text.split())
    return text, {"warnings": warnings, "method": "mammoth"}

@router.post("/extract")
async def extract_resume(file: UploadFile=File(...), request: Request = None):
    cl = request.headers.get("content-length") if request else None
    if cl and cl.isdigit() and int(cl) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    blob = await file.read()
    if len(blob) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large")
    
    byte_size = len(blob)
    content_type = (file.content_type or "").lower().strip()
    filename = file.filename or ""
    filename_lower = filename.lower()

    print(f'Results:\nbyte_size: {byte_size}\ncontent_type: {content_type}\nname: {filename}')

    # get preview string:
    first_n_bytes = blob[:80]
    first_4_bytes = blob[:4]
    head_preview_text = first_n_bytes.decode('utf-8', errors='ignore')
    print(f'Decoded text: {head_preview_text}')

    is_txt = ("text/plain" in content_type) or filename_lower.endswith(".txt")
    is_pdf = ("pdf" in content_type) or filename_lower.endswith(".pdf") or (first_4_bytes == b"%PDF")
    is_docx = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in content_type
        or filename_lower.endswith(".docx")
    )

    text = ""
    text_length = 0
    preview = ""

    # check content type:
    if is_txt:
        text = blob.decode("utf-8", errors="ignore")
        text = " ".join(text.split())
    elif is_pdf:
        bytes_stream = io.BytesIO(blob)
        try:
            pdf_read = PdfReader(bytes_stream)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to open PDF: {e}")
        page_text = []
        for i in range(min(MAX_PAGES, len(pdf_read.pages))):
            try:
                cur_page = pdf_read.pages[i]
                cur_text = cur_page.extract_text() or ""
                page_text.append(cur_text)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to read page {i+1}: {e}")
        text = "\n\n".join(page_text)
        text = " ".join(text.split())
    elif is_docx:
        try:
            text, meta = extract_docx_text(blob)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read DOCX: {e}")
        
        # raise HTTPException(status_code=415, detail="PDF extraction not implemented yet")
    else:
        if filename_lower.endswith(".doc"):
            raise HTTPException(
                status_code=415,
                detail="Unsupported file type: .doc (legacy). Please upload .docx, PDF, or TXT."
            )
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {content_type or filename}")

    text_length = len(text)
    preview = text[:600]
    probably_scanned = bool(is_pdf and text_length == 0)

    res = {
        "filename": filename,
        "content_type": content_type,
        "size_bytes": byte_size,
        "head_preview_text": head_preview_text,
        "preview": preview,
        "text_length": text_length,
        "text": text,
        "probably_scanned": probably_scanned
    }


    return res