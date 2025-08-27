# api/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import os, stripe, json
from .routers import ingest
from .routers import draft
from .routers import resume
from .auth import verify_supabase_session as verify_user
from .supabase_db import (upsert_user,
                            get_user_summary,
                            consume_free_use,
                            set_plan_and_grant,
                            upsert_customer,
                            get_stripe_customer_id,
                            get_user_id_by_customer)

app = FastAPI(title="LLM Job Copilot API")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STARTER_PRICE = os.getenv("STRIPE_PRICE_STARTER_MONTHLY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
STARTER_ALLOWANCE = int(os.getenv("MONTHLY_CREDITS_STARTER", "50"))

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
                   "http://127.0.0.1:3000",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def _log_req_res(request, call_next):
    print("REQ", request.method, request.url.path, "Origin:", request.headers.get("origin"))
    resp = await call_next(request)
    print("RES", request.method, request.url.path,
          resp.status_code,
          "ACAO:", resp.headers.get("access-control-allow-origin"))
    return resp


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

@app.post("/spend")
async def spend(user = Depends(verify_user)):
    remaining = await consume_free_use(user["user_id"])
    if remaining < 0:
        # Not enough credits → 402 so the UI can trigger upgrade
        raise HTTPException(status_code=402, detail="Out of free uses")
    return {"ok": True, "free_uses_remaining": remaining}

@app.post("/billing/checkout")
async def billing_checkout(user = Depends(verify_user)):
    if not STARTER_PRICE:
        raise HTTPException(500, "Missing STRIPE_PRICE_STARTER_MONTHLY")
    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": STARTER_PRICE, "quantity": 1}],
        success_url=f"{FRONTEND_BASE_URL}/account/billing?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_BASE_URL}/account/billing?checkout=cancel",
    )
    return {"url": session.url}

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

    # NEW: persist Stripe customer id for this user
    cust_id = session.get("customer")
    print("Stripe session.customer =", cust_id)
    if cust_id:
        await upsert_customer(user["user_id"], cust_id)

    # Keep your existing crediting logic
    profile = await set_plan_and_grant(user["user_id"], "starter", STARTER_ALLOWANCE)
    return {"ok": True, "plan": "starter", "credited": STARTER_ALLOWANCE, "user": profile}

@app.get("/billing/portal")
async def billing_portal(user = Depends(verify_user)):
    cust_id = await get_stripe_customer_id(user["user_id"])
    if not cust_id:
        # user hasn’t subscribed yet
        raise HTTPException(status_code=404, detail="No Stripe customer for this user")

    session = stripe.billing_portal.Session.create(
        customer=cust_id,
        return_url=f"{FRONTEND_BASE_URL}/account/billing"
    )
    return {"url": session.url}

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    whsec = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = (
            stripe.Webhook.construct_event(payload=payload, sig_header=sig_header, secret=whsec)
            if whsec else stripe.Event.construct_from(json.loads(payload), stripe.api_key)
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    event_type = event["type"]
    print("🔔 Stripe webhook:", event_type)

    # 👉 when an invoice gets paid (initial or renewal), refresh monthly credits
    if event_type == "invoice.payment_succeeded":
        inv = event["data"]["object"]
        cust_id = inv.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        print("invoice.payment_succeeded for", cust_id, "→ user", user_id)
        if user_id:
            await set_plan_and_grant(user_id, "starter", STARTER_ALLOWANCE)
            print("credits reset →", STARTER_ALLOWANCE)

    # (optional) if sub is canceled, mark plan = free (keep remaining credits as-is)
    if event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        cust_id = sub.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if user_id:
            await set_plan_and_grant(user_id, "free", 0)
            print("plan set to free for user", user_id)

    return {"received": True}
    

app.include_router(ingest.router)

app.include_router(draft.router)

app.include_router(resume.router)