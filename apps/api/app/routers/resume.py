from fastapi import APIRouter, UploadFile, File, HTTPException
import io
from pypdf import PdfReader


# constants
MAX_BYTES = 5 * 1024 * 1024
MAX_PAGES = 20

router = APIRouter(prefix="/resume", tags=["resume"])

@router.post("/extract")
async def extract_resume(file: UploadFile=File(...)):

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
        
        # raise HTTPException(status_code=415, detail="PDF extraction not implemented yet")
    else:
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
        "probably_scanned": probably_scanned
    }


    return res