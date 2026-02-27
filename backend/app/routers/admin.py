import uuid
from datetime import datetime, timezone
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_admin_patron, get_db
from app.models import Notification, Patron, Pledge, PledgeStatus, Task, TaskStatus, Update
from app.routers.tasks import get_task_or_404
from app.schemas import (
    AdminPledgeRead,
    AdminTaskListResponse,
    AdminTaskRead,
    CollectResponse,
    PledgeCollectResult,
    TaskRead,
    UpdateRead,
)

router = APIRouter(tags=["admin"])


@router.get("/api/admin/tasks", response_model=AdminTaskListResponse)
async def list_admin_tasks(
    _admin: Annotated[Patron, Depends(get_admin_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.pledges).selectinload(Pledge.patron))
        .order_by(Task.created_at.desc())
    )
    tasks = result.scalars().all()

    items = []
    for task in tasks:
        pledge_reads = [
            AdminPledgeRead(
                id=p.id,
                patron_email=p.patron.email,
                amount=p.amount,
                status=p.status,
                created_at=p.created_at,
            )
            for p in task.pledges
        ]
        task_data = TaskRead.model_validate(task).model_dump()
        task_data["pledges"] = pledge_reads
        items.append(AdminTaskRead(**task_data))

    return AdminTaskListResponse(items=items, total=len(items))


class PostUpdateBody(BaseModel):
    body: str


@router.post(
    "/api/tasks/{task_id}/updates",
    response_model=UpdateRead,
    status_code=201,
)
async def create_update(
    task_id: uuid.UUID,
    payload: PostUpdateBody,
    _admin: Annotated[Patron, Depends(get_admin_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)

    update = Update(task_id=task_id, body=payload.body)
    db.add(update)
    await db.commit()
    await db.refresh(update)
    return update


def _pledge_result(pledge: Pledge) -> PledgeCollectResult:
    return PledgeCollectResult(
        pledge_id=pledge.id,
        patron_email=pledge.patron.email,
        amount=pledge.amount,
        status=pledge.status,
    )


@router.post("/api/tasks/{task_id}/collect", response_model=CollectResponse)
async def collect_payments(
    task_id: uuid.UUID,
    _admin: Annotated[Patron, Depends(get_admin_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await get_task_or_404(db, task_id)

    if task.status != TaskStatus.collecting:
        raise HTTPException(
            status_code=400,
            detail=f"Task must be in collecting state, currently {task.status.value}",
        )

    # Fetch active pledges with patron info for response
    result = await db.execute(
        select(Pledge)
        .options(selectinload(Pledge.patron))
        .where(Pledge.task_id == task_id, Pledge.status == PledgeStatus.active)
    )
    active_pledges = result.scalars().all()

    # Also check for already-processed pledges (idempotency)
    already_result = await db.execute(
        select(Pledge)
        .options(selectinload(Pledge.patron))
        .where(
            Pledge.task_id == task_id,
            Pledge.status.in_([PledgeStatus.collected, PledgeStatus.failed]),
        )
    )
    already_processed = already_result.scalars().all()

    results: list[PledgeCollectResult] = []
    collected_total = 0

    for pledge in active_pledges:
        try:
            pi = stripe.PaymentIntent.create(
                amount=pledge.amount,
                currency="usd",
                customer=pledge.patron.stripe_customer,
                payment_method=pledge.payment_method,
                off_session=True,
                confirm=True,
            )
            pledge.payment_intent = pi.id
            pledge.status = PledgeStatus.collected
            pledge.collected_at = datetime.now(timezone.utc)
            collected_total += pledge.amount
        except (stripe.error.CardError, stripe.error.InvalidRequestError):
            pledge.status = PledgeStatus.failed
        results.append(_pledge_result(pledge))

    for p in already_processed:
        if p.status == PledgeStatus.collected:
            collected_total += p.amount
        results.append(_pledge_result(p))

    task.collected_total = collected_total
    task.status = TaskStatus.completed
    task.completed_at = datetime.now(timezone.utc)

    await db.commit()

    collected_count = sum(1 for r in results if r.status == PledgeStatus.collected)
    failed_count = sum(1 for r in results if r.status == PledgeStatus.failed)

    return CollectResponse(
        collected_count=collected_count,
        failed_count=failed_count,
        collected_total=collected_total,
        pledge_total=task.pledge_total,
        results=results,
    )


@router.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    _admin: Annotated[Patron, Depends(get_admin_patron)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)

    await db.execute(delete(Notification).where(Notification.task_id == task_id))
    await db.execute(delete(Update).where(Update.task_id == task_id))
    await db.execute(delete(Pledge).where(Pledge.task_id == task_id))
    await db.execute(delete(Task).where(Task.id == task_id))
    await db.commit()
