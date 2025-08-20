# retrieve.py
import re
from typing import List

WORD_RE = re.compile(r"\w+")

def _tokens(s: str) -> List[str]:
    return WORD_RE.findall((s or "").lower())

def rank_chunks_by_keywords(query: str, chunks: List[str], top_k: int=3) -> List[int]:
    """
    rank_chunks_by_keywords: tokenizes query and chunks, 
    finds frequency matches, 
    and returns indices of top k chunks
    """
    q = [t for t in _tokens(query) if t]
    if not q or not chunks:
        return list(range(min(len(chunks), top_k)))
    
    # tokenize chunks
    chunk_tokens = [_tokens(ch) for ch in chunks]
 
    scores = []
    for i, tokens in enumerate(chunk_tokens):
        s = 0

        for qt in q:
            s += tokens.count(qt)
        scores.append((s, i))
    
    # sort by score descending
    scores.sort(key=lambda x: (-x[0], x[1]))

    ranked = [i for (s, i) in scores if s > 0][:top_k]
    if ranked:
        return ranked
    
    # default to first chunks if no tokens found
    return list(range(min(len(chunks), top_k)))