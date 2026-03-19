from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from pydantic import ValidationError
import traceback
from typing import Any, Dict, Optional


def _get_request_id(request: Request) -> Optional[str]:
    # Will work once we add request-id middleware later.
    rid = getattr(getattr(request, "state", None), "request_id", None)
    if rid:
        return rid
    return request.headers.get("x-request-id")


def _json_error(
    *,
    request: Request,
    status_code: int,
    code: str,
    message: str,
    stage: str,
    retryable: bool = False,
    details: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    payload = {
        "error": {
            "code": code,
            "message": message,
            "stage": stage,
            "retryable": retryable,
        },
        "request_id": _get_request_id(request),
    }
    if details:
        payload["error"]["details"] = details

    # Echo request id back in headers for easy debugging in Network tab
    out_headers = dict(headers or {})
    if payload["request_id"]:
        out_headers.setdefault("x-request-id", payload["request_id"])

    return JSONResponse(status_code=status_code, content=payload, headers=out_headers)


def install_error_handlers(app: FastAPI):

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        # This is the classic FastAPI "422 Unprocessable Entity"
        body = await request.body()
        errors = exc.errors()

        # Keep logging for YOU
        print("✅ RequestValidationError errors():", errors)
        print("✅ RequestValidationError body:", body.decode("utf-8", errors="ignore"))

        return _json_error(
            request=request,
            status_code=422,
            code="VALIDATION_ERROR",
            stage="validation",
            message="Some fields were invalid. Please check your inputs and try again.",
            retryable=False,
            details={"issues": errors},
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        # When YOU manually validate/construct Pydantic models in code
        errs = exc.errors()
        safe_errs = []
        for e in errs:
            e2 = dict(e)
            e2.pop("ctx", None)
            safe_errs.append(e2)

        return _json_error(
            request=request,
            status_code=422,
            code="VALIDATION_ERROR",
            stage="validation",
            message="Some fields were invalid. Please check your inputs and try again.",
            retryable=False,
            details={"issues": safe_errs},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """
        Unifies ALL raise HTTPException(...) calls into the same error shape.
        Supports:
          - detail as dict (preferred) e.g. {"code": "...", "message": "...", "stage": "..."}
          - detail as string/list (legacy) -> wrapped
        """
        detail = exc.detail

        # Preferred: your route raises dict detail with code/message/stage
        if isinstance(detail, dict):
            code = detail.get("code") or "HTTP_ERROR"
            message = detail.get("message") or "Request failed."
            stage = detail.get("stage") or "unknown"
            retryable = bool(detail.get("retryable", False))
            details = {k: v for k, v in detail.items() if k not in {"code", "message", "stage", "retryable"}}
            return _json_error(
                request=request,
                status_code=exc.status_code,
                code=code,
                message=message,
                stage=stage,
                retryable=retryable,
                details=details or None,
                headers=getattr(exc, "headers", None),
            )

        # Legacy: detail is string/list/etc.
        return _json_error(
            request=request,
            status_code=exc.status_code,
            code="HTTP_ERROR",
            stage="unknown",
            message=str(detail) if detail is not None else "Request failed.",
            retryable=False,
            details={"raw_detail": detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """
        Catch-all so 500s are consistent.
        """
        rid = _get_request_id(request)
        print("💥 Unhandled exception. request_id=", rid)
        traceback.print_exc()

        return _json_error(
            request=request,
            status_code=500,
            code="INTERNAL_ERROR",
            stage="server",
            message="Something went wrong on our side. Please try again.",
            retryable=True,
            # Keep details minimal; you can expand in dev later
            details={"type": exc.__class__.__name__},
        )
