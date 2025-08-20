# chunk.py
from typing import List

def chunk_text(text: str, size: int=1200, overlap: int=200) -> List[str]:
    """
    Stub chunker: splits text into fixed size chunks
    - size: max chars per chunk
    - overlap: number of chars to repeat at the start of the next chunk
    """
    text = (text or "").strip()
    if not text:
        return []
    
    chunks: List[str] = []
    n = len(text)
    start = 0

    # loop over chunks
    while start < n:
        end = min(start + size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break

        start = end - overlap

    return chunks