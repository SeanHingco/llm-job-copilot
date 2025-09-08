# api/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os, stripe, json, sys, logging
from datetime import datetime, timezone
from .routers import ingest
from .routers import draft
from .routers import resume
from .utils.pricing import PRICE_CATALOG, resolve_subscription_by_price_id
from .utils.credits import ensure_daily_free_topup
from .auth import verify_supabase_session as verify_user
from .supabase_db import (upsert_user,
                            get_user_summary,
                            consume_free_use,
                            set_plan_and_grant,
                            upsert_customer,
                            get_stripe_customer_id,
                            get_user_id_by_customer,
                            insert_webhook_event_once,
                            set_remaining_and_mark_refill)


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("api")

app = FastAPI(title="LLM Job Copilot API")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STARTER_PRICE = os.getenv("STRIPE_PRICE_STARTER_MONTHLY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://llm-job-copilot-web-git-dev-seans-projects-46dd2537.vercel.app,https://resume-bender.seanhing.co")
ALLOWED_ORIGINS = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
STARTER_ALLOWANCE = int(os.getenv("MONTHLY_CREDITS_STARTER", "50"))
DAILY_FREE_CREDITS = int(os.getenv("DAILY_FREE_CREDITS", "6"))

# helpers
async def _grant_credits(user_id: str, delta: int) -> int:
    snap = await get_user_summary(user_id) or {}
    current = int(snap.get("free_uses_remaining") or 0)
    plan = snap.get("plan") or "free"
    new_total = current + int(delta)
    await set_plan_and_grant(user_id, plan, new_total)
    return new_total

async def _ensure_current_mode_customer(user_id: str, email: str | None) -> str:
    """
    Returns a Stripe customer ID valid for the CURRENT Stripe mode (test or live).
    If the stored customer_id is from the wrong mode, creates a new one and saves it.
    """
    cust_id = await get_stripe_customer_id(user_id)
    if cust_id:
        try:
            stripe.Customer.retrieve(cust_id)  # will fail if wrong mode
            return cust_id
        except stripe.error.InvalidRequestError as e:
            if "No such customer" not in str(e):
                raise
            # fall through to create a new customer in this mode

    customer = stripe.Customer.create(email=email, metadata={"user_id": user_id})
    cust_id = customer["id"]
    await upsert_customer(user_id, cust_id)
    return cust_id

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://llm-job-copilot-web-git-[a-z0-9-]+\.vercel\.app$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def _errors(request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled %s %s", request.method, request.url.path)
        raise


@app.middleware("http")
async def _log_req_res(request, call_next):
    print("REQ", request.method, request.url.path, "Origin:", request.headers.get("origin"))
    resp = await call_next(request)
    print("RES", request.method, request.url.path,
          resp.status_code,
          "ACAO:", resp.headers.get("access-control-allow-origin"))
    return resp

@app.middleware("http")
async def _limit_body_size(request, call_next):
    # Only guard the upload endpoints
    guarded_paths = ("/resume/extract",)
    if request.url.path.startswith(guarded_paths):
        try:
            max_bytes = int(os.getenv("MAX_UPLOAD_BYTES", "5242880"))
        except ValueError:
            max_bytes = 5_242_880

        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > max_bytes:
            return JSONResponse({"detail": "File too large"}, status_code=413)

    return await call_next(request)


@app.get("/health")
def health():
    return {"ok": True}

@app.get("/me")
async def me(user = Depends(verify_user)):
    return await get_user_summary(user["user_id"])

@app.get("/whoami")
def whoami(user = Depends(verify_user)):
    return {"user_id": user["user_id"], "email": user["email"]}


@app.get("/bootstrap")
async def bootstrap(user = Depends(verify_user)):
    await upsert_user(user["user_id"], user["email"])
    profile = await get_user_summary(user["user_id"])
    return {"user": profile}

@app.get("/account/credits")
async def account_credits(user = Depends(verify_user)):
    uid = user["user_id"]
    email = user.get("email")

    summary = await get_user_summary(uid)
    if not summary:
        if email:
            await upsert_user(uid, email)
            summary = await get_user_summary(uid)
        else:
            summary = {}

    remaining = await ensure_daily_free_topup(uid)

    # try:
    #     remaining = int(remaining) if remaining is not None else 0
    # except:
    #     remaining = 0

    return {"remaining_credits": remaining}

@app.post("/spend")
async def spend(user = Depends(verify_user)):
    snap = await get_user_summary(user["user_id"]) or {}
    plan = (snap.get("plan") or "free").lower()
    if plan in ("pro", "unlimited"):  # match your PRICE_CATALOG plan string
        return {"ok": True, "free_uses_remaining": snap.get("free_uses_remaining") or 0}

    remaining = await consume_free_use(user["user_id"])
    if remaining < 0:
        raise HTTPException(status_code=402, detail="Out of free uses")
    return {"ok": True, "free_uses_remaining": remaining}

@app.post("/billing/checkout")
async def billing_checkout(payload: dict | None, req: Request, user = Depends(verify_user)):
    key = (payload or {}).get("price_key")
    if not key:
        raise HTTPException(400, detail="Missing price_key")

    item = PRICE_CATALOG.get(key)
    if not item or not item.get("stripe_price"):
        raise HTTPException(400, detail="Unknown or unconfigured price_key")

    uid, email = user["user_id"], user.get("email")

    # ensure Stripe customer exists
    customer_id = await _ensure_current_mode_customer(uid, email)

    origin = req.headers.get("origin") or FRONTEND_BASE_URL

    if item["kind"] == "pack":
        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            line_items=[{"price": item["stripe_price"], "quantity": 1}],
            success_url=f"{origin}/account/billing?checkout=success&key={key}",
            cancel_url=f"{origin}/account/billing?checkout=cancel",
            allow_promotion_codes=True,
            metadata={"user_id": uid, "price_key": key},
        )
        return {"url": session.url}

    elif item["kind"] == "subscription":
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": item["stripe_price"], "quantity": 1}],
            # include the session_id for your /billing/complete-subscription flow
            success_url=f"{origin}/account/billing?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/account/billing?checkout=cancel",
            allow_promotion_codes=True,
            metadata={"user_id": uid, "price_key": key},
        )
        return {"url": session.url}

    else:
        raise HTTPException(400, detail="Unknown item kind")


@app.post("/billing/checkout/status")
async def billing_checkout_status(body: dict, user = Depends(verify_user)):
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(400, "Missing session_id")

    # Fetch session from Stripe
    session = stripe.checkout.Session.retrieve(sid)

    # Basic checks
    paid = session.get("payment_status") == "paid"
    status = session.get("status")  # e.g., 'complete'
    email = (session.get("customer_details") or {}).get("email")

    # Return only info for now (no DB changes yet)
    return {
        "ok": True,
        "paid": paid,
        "status": status,
        "email": email,
        "mode": session.get("mode"),  # should be 'subscription'
        "subscription_id": session.get("subscription"),
    }

@app.post("/billing/complete-subscription")
async def billing_complete_subscription(body: dict, user = Depends(verify_user)):
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(400, "Missing session_id")

    session = stripe.checkout.Session.retrieve(sid)
    if session.get("status") != "complete" or session.get("payment_status") != "paid":
        raise HTTPException(400, "Checkout not completed/paid")

    # Link Stripe customer to this user (credits/plan handled by webhook on invoice.payment_succeeded)
    cust_id = session.get("customer")
    if cust_id:
        await upsert_customer(user["user_id"], cust_id)

    return {"ok": True}

@app.get("/billing/portal")
async def billing_portal(user = Depends(verify_user)):
    # Create/link a customer for the current Stripe mode if needed
    cust_id = await _ensure_current_mode_customer(user["user_id"], user.get("email"))

    session = stripe.billing_portal.Session.create(
        customer=cust_id,
        return_url=f"{FRONTEND_BASE_URL}/account/billing"
    )
    return {"url": session.url}

@app.get("/billing/subscription-summary")
async def billing_subscription_summary(user = Depends(verify_user)):
    try:
        cust_id = await get_stripe_customer_id(user["user_id"])
        if not cust_id:
            return {"has_subscription": False}

        try:
            subs = stripe.Subscription.list(
                customer=cust_id,
                status="all",  # active, trialing, past_due etc.
                limit=1,
                expand=["data.items.data.price"]
            )
        except stripe.error.InvalidRequestError as e:
            # Happens if a Test customer ID is used while the API runs with Live keys
            if "No such customer" in str(e):
                return {"has_subscription": False}
            logger.exception("subscription-summary invalid request: %s", e)
            return {"has_subscription": False, "error": "stripe_invalid_request"}

        if not subs.data:
            return {"has_subscription": False}

        sub = subs.data[0]
        price_id = sub["items"]["data"][0]["price"]["id"] if sub["items"]["data"] else None

        # Map price_id -> your catalog key
        plan_key = next(
            (k for k, v in PRICE_CATALOG.items()
             if v.get("stripe_price") == price_id and v.get("kind") == "subscription"),
            None
        )
        plan_name = PRICE_CATALOG.get(plan_key, {}).get("plan") if plan_key else None

        return {
            "has_subscription": True,
            "status": sub["status"],
            "plan_key": plan_key,
            "plan": plan_name,
            "price_id": price_id,
            "cancel_at_period_end": sub.get("cancel_at_period_end", False),
            "current_period_end": sub.get("current_period_end"),
        }

    except Exception as e:
        logger.exception("subscription-summary failed for %s: %s", user["user_id"], e)
        # Keep the shape simple so the UI doesn’t crash, and CORS headers still apply
        return {"has_subscription": False, "error": "temporarily_unavailable"}

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")
    whsec = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = (
            stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=whsec)
            if whsec else stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    event_type = event["type"]
    event_id   = event["id"]

    # Idempotency guard
    first_time = await insert_webhook_event_once(event_id, event_type)
    if not first_time:
        return {"received": True, "duplicate": True}

    print("🔔 Stripe webhook:", event_type)

    # 1) Checkout completed
    if event_type == "checkout.session.completed":
        sess = event["data"]["object"]
        mode = sess.get("mode")
        md = sess.get("metadata") or {}
        user_id = md.get("user_id")
        cust_id = sess.get("customer")

        # a) One-time payment → grant pack credits
        if mode == "payment" and sess.get("payment_status") == "paid":
            price_key = md.get("price_key")
            item = PRICE_CATALOG.get(price_key) if price_key else None
            if user_id and item and item.get("kind") == "pack":
                grant = int(item.get("grant") or 0)
                if grant > 0:
                    new_total = await _grant_credits(user_id, grant)  # your existing helper
                    print(f"granted {grant} credits to {user_id} → total {new_total}")

        # b) Subscription checkout → link Stripe customer to user
        if mode == "subscription" and user_id and cust_id:
            await upsert_customer(user_id, cust_id)
            print(f"linked Stripe customer {cust_id} to user {user_id}")

        return {"received": True}

    # 2) Invoice paid → reset monthly allowance for that tier
    if event_type == "invoice.payment_succeeded":
        inv = event["data"]["object"]
        cust_id = inv.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if not user_id:
            return {"received": True}

        price_id = None
        # Try to read price from invoice lines
        try:
            lines = inv.get("lines", {}).get("data", [])
            if lines:
                price = (lines[0].get("price") or {})
                price_id = price.get("id")
        except Exception:
            price_id = None

        # Fallback: pull subscription item if needed
        if not price_id and inv.get("subscription"):
            sub = stripe.Subscription.retrieve(inv["subscription"], expand=["items.data.price"])
            items = sub.get("items", {}).get("data", [])
            if items:
                price_id = items[0]["price"]["id"]

        chosen = resolve_subscription_by_price_id(price_id)
        if chosen:
            monthly = int(chosen.get("monthly_allowance") or 0)
            await set_plan_and_grant(user_id, chosen["plan"], monthly)
            print(f"reset credits for {user_id} → plan={chosen['plan']} allowance={monthly}")
        else:
            # safe fallback
            monthly = int(PRICE_CATALOG["sub_starter"]["monthly_allowance"])
            await set_plan_and_grant(user_id, "starter", monthly)
            print("fallback: starter plan applied")

        return {"received": True}

    # 3) Subscription updated → only update plan label, keep credits unchanged
    if event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        cust_id = sub.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if not user_id:
            return {"received": True}

        items = sub.get("items", {}).get("data", [])
        price_id = items[0]["price"]["id"] if items else None

        chosen = resolve_subscription_by_price_id(price_id)
        if chosen:
            snap = await get_user_summary(user_id) or {}
            remaining = int(snap.get("free_uses_remaining") or 0)
            await set_plan_and_grant(user_id, chosen["plan"], remaining)
            print(f"plan updated (no credit change) → user={user_id} plan={chosen['plan']}")

        return {"received": True}

    # 4) Subscription canceled → set plan free, PRESERVE credits
    if event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        cust_id = sub.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if not user_id:
            return {"received": True}

        # Preserve remaining credits; change to 0 if you prefer to wipe.
        snap = await get_user_summary(user_id) or {}
        remaining = int(snap.get("free_uses_remaining") or 0)
        await set_plan_and_grant(user_id, "free", remaining)
        print(f"plan set to free (credits preserved) for user {user_id}")

        return {"received": True}

    # Default
    return {"received": True}
    

app.include_router(ingest.router)

app.include_router(draft.router)

app.include_router(resume.router)