from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

def install_error_handlers(app: FastAPI):
    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={"error": "VALIDATION_ERROR", "detail": exc.errors(), "path": str(request.url)},
        )