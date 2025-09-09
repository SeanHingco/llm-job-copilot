# security_headers.py
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from urllib.parse import urlparse

def _origin_host(url: str | None):
    if not url:
        return None
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"

def build_csp() -> str:
    # Allowlists (env-driven)
    self = "'self'"
    api = _origin_host(os.getenv("API_BASE_URL"))
    web = _origin_host(os.getenv("FRONTEND_ORIGIN"))
    supabase = _origin_host(os.getenv("SUPABASE_URL"))
    stripe_js = "https://js.stripe.com"
    stripe_hooks = "https://hooks.stripe.com"

    connect_src = [self]
    img_src = [self, "data:", "blob:"]
    script_src = [self, stripe_js]
    style_src = [self, "'unsafe-inline'"]  # Next.js often inlines styles
    frame_src = [stripe_js]                # Stripe Elements/Checkout if used
    font_src = [self, "data:"]
    worker_src = [self, "blob:"]

    # Add optional hosts if defined
    for host in [api, web, supabase]:
        if host and host not in connect_src:
            connect_src.append(host)

    # If you later add analytics, extend connect/script here.

    csp = (
        f"default-src {self}; "
        f"base-uri {self}; "
        f"frame-ancestors 'none'; "
        f"connect-src {' '.join(connect_src)}; "
        f"img-src {' '.join(img_src)}; "
        f"script-src {' '.join(script_src)}; "
        f"style-src {' '.join(style_src)}; "
        f"font-src {' '.join(font_src)}; "
        f"worker-src {' '.join(worker_src)}; "
        f"frame-src {' '.join(frame_src)}; "
        f"form-action {self} {stripe_hooks}; "
        f"object-src 'none'; "
        f"upgrade-insecure-requests"
    )
    return csp

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.csp = build_csp()

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Core security headers
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), xr-spatial-tracking=()"
        )
        response.headers["Content-Security-Policy"] = self.csp
        return response
