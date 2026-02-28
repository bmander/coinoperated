import contextlib
import uuid
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_active_patron, get_current_patron, get_db
from app.models import LIVE_PLEDGE_STATUSES, Patron, Pledge, PledgeStatus, Task, TaskStatus
from app.routers.tasks import get_task_or_404
from app.schemas import (
    PledgeCreateRequest,
    PledgeCreateResponse,
    PledgeMyResponse,
    PledgeUpdateRequest,
    PledgeUpdateResponse,
)
from app.services.pledges import create_pledge_for_task

router = APIRouter(prefix="/api/tasks/{task_id}/pledges", tags=["pledges"])

PLEDGEABLE_STATUSES = {TaskStatus.open, TaskStatus.accepted}


async def _get_patron_pledge(
    db: AsyncSession, patron_id: uuid.UUID, task_id: uuid.UUID
) -> Pledge | None:
    return (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron_id,
                Pledge.task_id == task_id,
                Pledge.status.in_(LIVE_PLEDGE_STATUSES),
            )
        )
    ).scalar_one_or_none()


def _cancel_setup_intent(setup_intent_id: str) -> None:
    with contextlib.suppress(stripe.error.InvalidRequestError):
        stripe.SetupIntent.cancel(setup_intent_id)


def _decrement_task_counts(task: Task, amount: int) -> None:
    task.pledge_count = max(0, task.pledge_count - 1)
    task.pledge_total = max(0, task.pledge_total - amount)


async def maybe_detach_pm(
    db: AsyncSession, payment_method_id: str, exclude_pledge_id: uuid.UUID
) -> None:
    """Detach a payment method if no other live pledges reference it."""
    other = (
        await db.execute(
            select(Pledge).where(
                Pledge.payment_method == payment_method_id,
                Pledge.id != exclude_pledge_id,
                Pledge.status.in_(LIVE_PLEDGE_STATUSES),
            )
        )
    ).scalar_one_or_none()
    if other is None:
        with contextlib.suppress(stripe.error.InvalidRequestError):
            stripe.PaymentMethod.detach(payment_method_id)


@router.post("", response_model=PledgeCreateResponse, status_code=201)
async def create_pledge(
    task_id: uuid.UUID,
    payload: PledgeCreateRequest,
    patron: Annotated[Patron, Depends(get_active_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await get_task_or_404(db, task_id)
    if task.status not in PLEDGEABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Task is not accepting pledges")

    existing = await _get_patron_pledge(db, patron.id, task_id)
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pledge on this task")

    result = await create_pledge_for_task(
        db,
        patron=patron,
        task=task,
        amount=payload.amount,
        payment_method_id=payload.payment_method_id,
        save_card=payload.save_card,
    )

    await db.commit()
    await db.refresh(result.pledge)

    return PledgeCreateResponse(
        pledge_id=result.pledge.id,
        client_secret=result.client_secret,
        publishable_key=settings.stripe_publishable_key,
    )


@router.get("/me", response_model=PledgeMyResponse)
async def get_my_pledge(
    task_id: uuid.UUID,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)

    pledge = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.task_id == task_id,
                Pledge.status != PledgeStatus.released,
            )
        )
    ).scalar_one_or_none()
    if pledge is None:
        raise HTTPException(status_code=404, detail="No pledge found")
    return pledge


@router.patch("/me", response_model=PledgeUpdateResponse)
async def update_my_pledge(
    task_id: uuid.UUID,
    payload: PledgeUpdateRequest,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)

    pledge = await _get_patron_pledge(db, patron.id, task_id)
    if pledge is None:
        raise HTTPException(status_code=404, detail="No pledge found")

    if pledge.status == PledgeStatus.pending:
        _cancel_setup_intent(pledge.setup_intent)

    si = stripe.SetupIntent.create(
        customer=patron.stripe_customer,
        metadata={
            "pledge_task_id": str(task_id),
            "pledge_patron_id": str(patron.id),
            "is_update": "true",
            "old_amount": str(pledge.amount),
        },
    )

    # Adjust pledge_total for the new amount (pledge stays counted)
    task = await get_task_or_404(db, task_id)
    task.pledge_total += payload.amount - pledge.amount

    pledge.amount = payload.amount
    pledge.setup_intent = si.id
    pledge.status = PledgeStatus.pending
    pledge.payment_method = None

    await db.commit()
    await db.refresh(pledge)

    return PledgeUpdateResponse(
        pledge_id=pledge.id,
        client_secret=si.client_secret,
        publishable_key=settings.stripe_publishable_key,
    )


@router.delete("/me", status_code=204)
async def delete_my_pledge(
    task_id: uuid.UUID,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)

    pledge = await _get_patron_pledge(db, patron.id, task_id)
    if pledge is None:
        raise HTTPException(status_code=404, detail="No pledge found")

    if pledge.status == PledgeStatus.active:
        task = await get_task_or_404(db, task_id)
        _decrement_task_counts(task, pledge.amount)

    if pledge.status == PledgeStatus.pending and pledge.setup_intent:
        _cancel_setup_intent(pledge.setup_intent)

    # Detach unsaved PM if no other live pledges use it
    if not pledge.save_card and pledge.payment_method:
        await maybe_detach_pm(db, pledge.payment_method, exclude_pledge_id=pledge.id)

    pledge.status = PledgeStatus.released
    await db.commit()
