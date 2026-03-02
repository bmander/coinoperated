from typing import Annotated

import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_patron, get_db
from app.models import LIVE_PLEDGE_STATUSES, Notification, Patron, Pledge
from app.schemas import PatronNotificationRead, PatronPledgeRead, SavedPaymentMethodRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patron", tags=["patron"])


@router.get("/pledges", response_model=list[PatronPledgeRead])
async def list_my_pledges(
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Pledge)
        .where(Pledge.patron_id == patron.id)
        .options(selectinload(Pledge.task))
        .order_by(Pledge.created_at.desc())
    )
    return result.scalars().all()


@router.get("/payment-methods", response_model=list[SavedPaymentMethodRead])
async def list_payment_methods(
    patron: Annotated[Patron, Depends(get_current_patron)],
):
    try:
        result = stripe.PaymentMethod.list(customer=patron.stripe_customer, type="card")
    except stripe.InvalidRequestError as exc:
        logger.warning("Stripe customer %s invalid: %s", patron.stripe_customer, exc)
        return []
    return [
        SavedPaymentMethodRead(
            id=pm.id,
            brand=pm.card.brand,
            last4=pm.card.last4,
            exp_month=pm.card.exp_month,
            exp_year=pm.card.exp_year,
        )
        for pm in result.data
    ]


@router.delete("/payment-methods/{pm_id}", status_code=204)
async def delete_payment_method(
    pm_id: str,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify PM belongs to this patron
    try:
        pm = stripe.PaymentMethod.retrieve(pm_id)
    except stripe.error.InvalidRequestError as err:
        raise HTTPException(status_code=404, detail="Payment method not found") from err

    if pm.customer != patron.stripe_customer:
        raise HTTPException(status_code=404, detail="Payment method not found")

    # Check if any live pledges use this PM
    active_pledge = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.payment_method == pm_id,
                Pledge.status.in_(LIVE_PLEDGE_STATUSES),
            )
        )
    ).scalar_one_or_none()
    if active_pledge:
        raise HTTPException(
            status_code=409, detail="Payment method is in use by an active pledge"
        )

    stripe.PaymentMethod.detach(pm_id)


@router.get("/notifications", response_model=list[PatronNotificationRead])
async def list_my_notifications(
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification)
        .where(Notification.patron_id == patron.id)
        .options(selectinload(Notification.task))
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()
