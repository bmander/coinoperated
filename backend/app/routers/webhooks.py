from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from typing import Annotated

from app.config import settings
from app.dependencies import get_db
from app.models import Pledge, PledgeStatus, Task, TaskStatus

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
                select(Pledge).where(Pledge.payment_intent == payment_intent_id)
            )
        ).scalar_one_or_none()

        if pledge is None:
            return {"status": "ignored"}

        if pledge.status != PledgeStatus.collected:
            pledge.status = PledgeStatus.collected
            pledge.collected_at = datetime.now(timezone.utc)
            await db.commit()

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        payment_intent_id = pi["id"]

        pledge = (
            await db.execute(
                select(Pledge).where(Pledge.payment_intent == payment_intent_id)
            )
        ).scalar_one_or_none()

        if pledge is None:
            return {"status": "ignored"}

        if pledge.status not in (PledgeStatus.collected, PledgeStatus.failed):
            pledge.status = PledgeStatus.failed

            # Recalculate task collected_total
            task = (
                await db.execute(select(Task).where(Task.id == pledge.task_id))
            ).scalar_one_or_none()
            if task:
                task.collected_total = max(0, task.collected_total - pledge.amount)

            await db.commit()

    return {"status": "ok"}
