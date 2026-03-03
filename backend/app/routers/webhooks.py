import contextlib
from datetime import UTC, datetime
from typing import Annotated

import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import get_db, get_session_factory
from app.models import Patron, Pledge, PledgeStatus, Task
from app.notifications import notify_charge_failed, notify_charge_succeeded, schedule_emails
from app.routers.pledges import maybe_detach_pm

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


async def _get_pledge_by_payment_intent(
    db: AsyncSession, payment_intent_id: str
) -> Pledge | None:
    return (
        await db.execute(
            select(Pledge)
            .where(Pledge.payment_intent == payment_intent_id)
            .options(selectinload(Pledge.patron), selectinload(Pledge.task))
        )
    ).scalar_one_or_none()


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
    session_factory=Depends(get_session_factory),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid payload") from err
    except stripe.error.SignatureVerificationError as err:
        raise HTTPException(status_code=400, detail="Invalid signature") from err

    pending_emails = []

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

        # Attach payment method to customer (may already be attached)
        with contextlib.suppress(stripe.error.InvalidRequestError):
            stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)

        pledge.status = PledgeStatus.active
        pledge.payment_method = payment_method_id

        # Save default payment method on patron
        patron = (
            await db.execute(select(Patron).where(Patron.id == pledge.patron_id))
        ).scalar_one_or_none()
        if patron:
            patron.default_payment_method = payment_method_id

        # Increment task counters only for new pledges (updates already adjusted)
        is_update = si.get("metadata", {}).get("is_update") == "true"
        if not is_update:
            task = (
                await db.execute(select(Task).where(Task.id == pledge.task_id))
            ).scalar_one_or_none()
            if task:
                task.pledge_count += 1
                task.pledge_total += pledge.amount

        await db.commit()

    elif event["type"] == "payment_intent.succeeded":
        pledge = await _get_pledge_by_payment_intent(db, event["data"]["object"]["id"])

        if pledge is None:
            return {"status": "ignored"}

        if pledge.status != PledgeStatus.collected:
            pledge.status = PledgeStatus.collected
            pledge.collected_at = datetime.now(UTC)
            pending_emails = await notify_charge_succeeded(db, pledge.patron, pledge.task, pledge.amount)
            await db.commit()

            if not pledge.save_card and pledge.payment_method:
                await maybe_detach_pm(db, pledge.payment_method, exclude_pledge_id=pledge.id)

    elif event["type"] == "payment_intent.payment_failed":
        pledge = await _get_pledge_by_payment_intent(db, event["data"]["object"]["id"])

        if pledge is None:
            return {"status": "ignored"}

        if pledge.status not in (PledgeStatus.collected, PledgeStatus.failed):
            pledge.status = PledgeStatus.failed

            task = pledge.task
            if task:
                task.collected_total = max(0, task.collected_total - pledge.amount)

            pending_emails = await notify_charge_failed(db, pledge.patron, pledge.task, pledge.amount)
            await db.commit()

            if not pledge.save_card and pledge.payment_method:
                await maybe_detach_pm(db, pledge.payment_method, exclude_pledge_id=pledge.id)

    schedule_emails(background_tasks, pending_emails, session_factory)
    return {"status": "ok"}
