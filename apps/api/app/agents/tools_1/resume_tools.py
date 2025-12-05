from langchain.tools import tool
from pydantic import BaseModel, Field
from typing import Literal

class ResumeOut(BaseModel):
    name: str
    email: str
    phone: str
    summary: str




