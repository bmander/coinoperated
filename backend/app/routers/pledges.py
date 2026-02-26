import uuid
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_patron, get_db
from app.models import Patron, Pledge, PledgeStatus, Task, TaskStatus
from app.schemas import (
    PledgeCreateRequest,
    PledgeCreateResponse,
    PledgeMyResponse,
    PledgeUpdateRequest,
    PledgeUpdateResponse,
)

router = APIRouter(prefix="/api/tasks/{task_id}/pledges", tags=["pledges"])

PLEDGEABLE_STATUSES = {TaskStatus.open, TaskStatus.accepted}


async def _get_task_or_404(db: AsyncSession, task_id: uuid.UUID) -> Task:
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=PledgeCreateResponse, status_code=201)
async def create_pledge(
    task_id: uuid.UUID,
    payload: PledgeCreateRequest,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await _get_task_or_404(db, task_id)
    if task.status not in PLEDGEABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Task is not accepting pledges")

    existing = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.task_id == task_id,
                Pledge.status.in_([PledgeStatus.active, PledgeStatus.pending]),
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pledge on this task")

    si = stripe.SetupIntent.create(
        customer=patron.stripe_customer,
        metadata={"pledge_task_id": str(task_id), "pledge_patron_id": str(patron.id)},
    )

    pledge = Pledge(
        patron_id=patron.id,
        task_id=task_id,
        amount=payload.amount,
        setup_intent=si.id,
        status=PledgeStatus.pending,
        payment_method=None,
    )
    db.add(pledge)
    await db.commit()
    await db.refresh(pledge)

    return PledgeCreateResponse(
        pledge_id=pledge.id,
        client_secret=si.client_secret,
        publishable_key=settings.stripe_publishable_key,
    )


@router.get("/me", response_model=PledgeMyResponse)
async def get_my_pledge(
    task_id: uuid.UUID,
    patron: Annotated[Patron, Depends(get_current_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_task_or_404(db, task_id)

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
    await _get_task_or_404(db, task_id)

    pledge = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.task_id == task_id,
                Pledge.status.in_([PledgeStatus.active, PledgeStatus.pending]),
            )
        )
    ).scalar_one_or_none()
    if pledge is None:
        raise HTTPException(status_code=404, detail="No pledge found")

    was_active = pledge.status == PledgeStatus.active

    # Cancel old SetupIntent if pending
    if pledge.status == PledgeStatus.pending:
        try:
            stripe.SetupIntent.cancel(pledge.setup_intent)
        except stripe.error.InvalidRequestError:
            pass

    # Create new SetupIntent
    si = stripe.SetupIntent.create(
        customer=patron.stripe_customer,
        metadata={"pledge_task_id": str(task_id), "pledge_patron_id": str(patron.id)},
    )

    # If was active, decrement task counts (will be re-incremented on webhook success)
    if was_active:
        task = await _get_task_or_404(db, task_id)
        task.pledge_count = max(0, task.pledge_count - 1)
        task.pledge_total = max(0, task.pledge_total - pledge.amount)

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
    await _get_task_or_404(db, task_id)

    pledge = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.task_id == task_id,
                Pledge.status.in_([PledgeStatus.active, PledgeStatus.pending]),
            )
        )
    ).scalar_one_or_none()
    if pledge is None:
        raise HTTPException(status_code=404, detail="No pledge found")

    if pledge.status == PledgeStatus.active:
        task = await _get_task_or_404(db, task_id)
        task.pledge_count = max(0, task.pledge_count - 1)
        task.pledge_total = max(0, task.pledge_total - pledge.amount)

    if pledge.status == PledgeStatus.pending:
        try:
            stripe.SetupIntent.cancel(pledge.setup_intent)
        except stripe.error.InvalidRequestError:
            pass

    pledge.status = PledgeStatus.released
    await db.commit()
