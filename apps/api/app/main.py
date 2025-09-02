# api/app/main.py
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import os, stripe, json
from .routers import ingest
from .routers import draft
from .routers import resume
from .utils.pricing import PRICE_CATALOG
from .auth import verify_supabase_session as verify_user
from .supabase_db import (upsert_user,
                            get_user_summary,
                            consume_free_use,
                            set_plan_and_grant,
                            upsert_customer,
                            get_stripe_customer_id,
                            get_user_id_by_customer,
                            insert_webhook_event_once)

app = FastAPI(title="LLM Job Copilot API")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STARTER_PRICE = os.getenv("STRIPE_PRICE_STARTER_MONTHLY")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,llm-job-copilot-web-git-dev-seans-projects-46dd2537.vercel.app")
ALLOWED_ORIGINS = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
STARTER_ALLOWANCE = int(os.getenv("MONTHLY_CREDITS_STARTER", "50"))

# helpers
async def _grant_credits(user_id: str, delta: int) -> int:
    snap = await get_user_summary(user_id) or {}
    current = int(snap.get("free_uses_remaining") or 0)
    plan = snap.get("plan") or "free"
    new_total = current + int(delta)
    await set_plan_and_grant(user_id, plan, new_total)
    return new_total

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
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

    remaining = summary.get("free_uses_remaining")

    try:
        remaining = int(remaining) if remaining is not None else 0
    except:
        remaining = 0

    return {"remaining_credits": remaining}

@app.post("/spend")
async def spend(user = Depends(verify_user)):
    remaining = await consume_free_use(user["user_id"])
    if remaining < 0:
        # Not enough credits → 402 so the UI can trigger upgrade
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
    customer_id = await get_stripe_customer_id(uid)
    if not customer_id:
        customer = stripe.Customer.create(email=email, metadata={"user_id": uid})
        customer_id = customer["id"]
        await upsert_customer(uid, customer_id)

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

@app.get("/billing/subscription-summary")
async def billing_subscription_summary(user = Depends(verify_user)):
    cust_id = await get_stripe_customer_id(user["user_id"])
    if not cust_id:
        return {"has_subscription": False}

    subs = stripe.Subscription.list(
        customer=cust_id,
        status="all",  # active, trialing, past_due etc.
        limit=1,
        expand=["data.items.data.price"]
    )
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
        "status": sub["status"],  # active, trialing, past_due, canceled, etc.
        "plan_key": plan_key,
        "plan": plan_name,
        "price_id": price_id,
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "current_period_end": sub.get("current_period_end"),  # epoch seconds
    }

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

    first_time = await insert_webhook_event_once(event_id, event_type)
    if not first_time:
        return {"received": True, "duplicate": True}
    print("🔔 Stripe webhook:", event_type)

    # 👉 when an invoice gets paid (initial or renewal), refresh monthly credits
    
    if event_type == "invoice.payment_succeeded":
        inv = event["data"]["object"]
        cust_id = inv.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if user_id:
            # Try to get the exact price that billed this invoice
            price_id = None
            try:
                lines = inv.get("lines", {}).get("data", [])
                if lines:
                    price = (lines[0].get("price") or {})
                    price_id = price.get("id")
            except Exception:
                price_id = None

            # Fallback: retrieve subscription if needed
            if not price_id and inv.get("subscription"):
                sub = stripe.Subscription.retrieve(inv["subscription"], expand=["items.data.price"])
                items = sub.get("items", {}).get("data", [])
                if items:
                    price_id = items[0]["price"]["id"]

            # Map price_id -> catalog key
            chosen = None
            for key, item in PRICE_CATALOG.items():
                if item.get("stripe_price") == price_id and item.get("kind") == "subscription":
                    chosen = item
                    break

            if chosen:
                plan = chosen.get("plan") or "starter"
                monthly = int(chosen.get("monthly_allowance") or 0)
                await set_plan_and_grant(user_id, plan, monthly)
                print(f"reset credits for {user_id} → plan={plan} allowance={monthly}")
            else:
                # default behavior if we can’t resolve tier
                monthly = int(PRICE_CATALOG["sub_starter"]["monthly_allowance"])
                await set_plan_and_grant(user_id, "starter", monthly)
                print("fallback: starter plan applied")

    # (optional) if sub is canceled, mark plan = free (keep remaining credits as-is)
    if event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        cust_id = sub.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if user_id:
            await set_plan_and_grant(user_id, "free", 0)
            print("plan set to free for user", user_id)
    
    if event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        cust_id = sub.get("customer")
        user_id = await get_user_id_by_customer(cust_id) if cust_id else None
        if user_id:
            # Find the new price_id
            items = sub.get("items", {}).get("data", [])
            price_id = items[0]["price"]["id"] if items else None

            # Map price_id -> catalog plan
            plan_key = next(
                (k for k, v in PRICE_CATALOG.items()
                if v.get("stripe_price") == price_id and v.get("kind") == "subscription"),
                None
            )
            if plan_key:
                # Update just the plan label, keep current credits unchanged
                snap = await get_user_summary(user_id) or {}
                remaining = int(snap.get("free_uses_remaining") or 0)
                plan_name = PRICE_CATALOG[plan_key]["plan"]
                await set_plan_and_grant(user_id, plan_name, remaining)
                print(f"plan updated (no credit change) → user={user_id} plan={plan_name}")
    
    if event_type == "checkout.session.completed":
        sess = event["data"]["object"]
        if sess.get("mode") == "payment" and sess.get("payment_status") == "paid":
            md = sess.get("metadata") or {}
            user_id = md.get("user_id")         # set in /billing/checkout
            price_key = md.get("price_key")     # set in /billing/checkout
            item = PRICE_CATALOG.get(price_key) if price_key else None

            if user_id and item and item.get("kind") == "pack":
                grant = int(item.get("grant") or 0)
                if grant > 0:
                    new_total = await _grant_credits(user_id, grant)
                    print(f"granted {grant} credits to {user_id} → total {new_total}")

    return {"received": True}
    

app.include_router(ingest.router)

app.include_router(draft.router)

app.include_router(resume.router)