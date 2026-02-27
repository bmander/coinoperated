from datetime import datetime, timezone
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import get_db
from app.models import Patron, Pledge, PledgeStatus, Task
from app.notifications import notify_charge_failed, notify_charge_succeeded

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "setup_intent.succeeded":
        si = event["data"]["object"]
        setup_intent_id = si["id"]
        payment_method_id = si["payment_method"]
        customer_id = si["customer"]

        pledge = (
            await db.execute(
                select(Pledge).where(Pledge.setup_intent == setup_intent_id)
            )
        ).scalar_one_or_none()

        if pledge is None:
            return {"status": "ignored"}

        # Attach payment method to customer
        stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)

        pledge.status = PledgeStatus.active
        pledge.payment_method = payment_method_id

        # Increment task counters
        task = (
            await db.execute(select(Task).where(Task.id == pledge.task_id))
        ).scalar_one_or_none()
        if task:
            task.pledge_count += 1
            task.pledge_total += pledge.amount

        await db.commit()

    elif event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        payment_intent_id = pi["id"]

        pledge = (
            await db.execute(
                select(Pledge)
                .where(Pledge.payment_intent == payment_intent_id)
                .options(selectinload(Pledge.patron), selectinload(Pledge.task))
            )
        ).scalar_one_or_none()

        if pledge is None:
            return {"status": "ignored"}

        pledge.status = PledgeStatus.collected
        pledge.collected_at = datetime.now(timezone.utc)

        task = pledge.task
        task.collected_total += pledge.amount

        await notify_charge_succeeded(db, pledge.patron, task, pledge.amount)
        await db.commit()

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        payment_intent_id = pi["id"]

        pledge = (
            await db.execute(
                select(Pledge)
                .where(Pledge.payment_intent == payment_intent_id)
                .options(selectinload(Pledge.patron), selectinload(Pledge.task))
            )
        ).scalar_one_or_none()

        if pledge is None:
            return {"status": "ignored"}

        pledge.status = PledgeStatus.failed

        await notify_charge_failed(db, pledge.patron, pledge.task, pledge.amount)
        await db.commit()

    return {"status": "ok"}
