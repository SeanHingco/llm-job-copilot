# context.py
from typing import List, Tuple, Dict

def build_context(chunks: List[str], max_chars: int=300, max_chunks: int=3) -> Tuple[str, List[Dict]]:
    """
    Select max chunks, keep total <= max_chars.
    Labels chosen chunk with a citation index, e.g. [0], [1], ...
    Returns:
        - context string to paste into a prompt
        - citations: [{chunk_index, length}]
    """

    selected: List[Tuple[int,str]] = []
    used = 0

    # loop over chunks
    for i, ch in enumerate(chunks):
        if len(selected) >= max_chunks:
            break
        
        remaining = max_chars - used
        if remaining <= 0:
            break

        piece = ch[:remaining]
        if not piece:
            break

        selected.append((i, piece))
        used += len(piece)

    context = "\n\n".join(f"[{i}] {text}" for i,text in selected)
    citations = [{"chunk_index": i, "length": len(text)} for i,text in selected]
    return context, citations
