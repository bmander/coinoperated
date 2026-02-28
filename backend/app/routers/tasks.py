import uuid
from datetime import datetime, timezone
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import get_active_patron, get_db
from app.models import Patron, Pledge, PledgeStatus, Task, TaskStatus
from app.notifications import notify_task_accepted, notify_task_completed, notify_task_declined
from app.schemas import TaskCreate, TaskCreateResponse, TaskDetail, TaskListResponse, TaskRead, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

VALID_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.open: {TaskStatus.accepted, TaskStatus.declined},
    TaskStatus.accepted: {TaskStatus.collecting, TaskStatus.open},
    TaskStatus.collecting: {TaskStatus.completed},
}


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: TaskStatus | None = None,
    sort_by: str = Query("created_at", pattern="^(pledge_total|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = select(Task)
    count_query = select(func.count()).select_from(Task)

    if status is not None:
        query = query.where(Task.status == status)
        count_query = count_query.where(Task.status == status)

    sort_column = getattr(Task, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    total = (await db.execute(count_query)).scalar()
    result = await db.execute(query.offset(offset).limit(limit))
    tasks = result.scalars().all()

    return TaskListResponse(items=tasks, total=total, offset=offset, limit=limit)


async def get_task_or_404(
    db: AsyncSession, task_id: uuid.UUID, *, load_updates: bool = False
) -> Task:
    query = select(Task).where(Task.id == task_id)
    if load_updates:
        query = query.options(selectinload(Task.updates))
    task = (await db.execute(query)).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}", response_model=TaskDetail)
async def get_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_task_or_404(db, task_id, load_updates=True)


@router.post("", response_model=TaskCreateResponse, status_code=201)
async def create_task(
    payload: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    patron: Annotated[Patron, Depends(get_active_patron)],
):
    is_admin = patron.email == settings.admin_email

    if not is_admin and payload.pledge_amount is None:
        raise HTTPException(
            status_code=400, detail="A pledge is required when submitting a task"
        )

    task = Task(
        title=payload.title,
        description=payload.description,
        criteria=payload.criteria,
        submitted_by=patron.id,
    )
    db.add(task)
    await db.flush()

    pledge_id = None
    client_secret = None
    publishable_key = None

    if payload.pledge_amount is not None:
        if payload.payment_method_id:
            # Reuse saved payment method — skip SetupIntent
            pm = stripe.PaymentMethod.retrieve(payload.payment_method_id)
            if pm.customer != patron.stripe_customer:
                raise HTTPException(
                    status_code=400, detail="Payment method does not belong to you"
                )

            pledge = Pledge(
                patron_id=patron.id,
                task_id=task.id,
                amount=payload.pledge_amount,
                setup_intent=None,
                status=PledgeStatus.active,
                payment_method=payload.payment_method_id,
                save_card=True,
            )
            db.add(pledge)
            await db.flush()

            task.pledge_count += 1
            task.pledge_total += payload.pledge_amount

            pledge_id = pledge.id
            publishable_key = settings.stripe_publishable_key
        else:
            si = stripe.SetupIntent.create(
                customer=patron.stripe_customer,
                metadata={
                    "pledge_task_id": str(task.id),
                    "pledge_patron_id": str(patron.id),
                },
            )
            pledge = Pledge(
                patron_id=patron.id,
                task_id=task.id,
                amount=payload.pledge_amount,
                setup_intent=si.id,
                status=PledgeStatus.pending,
                payment_method=None,
                save_card=payload.save_card,
            )
            db.add(pledge)
            await db.flush()
            pledge_id = pledge.id
            client_secret = si.client_secret
            publishable_key = settings.stripe_publishable_key

    await db.commit()
    await db.refresh(task)

    task_data = TaskRead.model_validate(task)
    return TaskCreateResponse(
        **task_data.model_dump(),
        pledge_id=pledge_id,
        client_secret=client_secret,
        publishable_key=publishable_key,
    )


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await get_task_or_404(db, task_id)

    notify_fn = None

    if payload.status is not None and payload.status != task.status:
        old_status = task.status
        allowed = VALID_TRANSITIONS.get(old_status, set())
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition: {old_status.value} -> {payload.status.value}",
            )

        now = datetime.now(timezone.utc)

        if payload.status == TaskStatus.accepted:
            task.accepted_at = now
            notify_fn = notify_task_accepted
        elif payload.status == TaskStatus.declined:
            task.declined_at = now
            notify_fn = notify_task_declined
        elif payload.status == TaskStatus.collecting:
            notify_fn = notify_task_completed
        elif payload.status == TaskStatus.completed:
            task.completed_at = now
        elif payload.status == TaskStatus.open and old_status == TaskStatus.accepted:
            task.accepted_at = None

        task.status = payload.status

    for field, value in payload.model_dump(exclude_unset=True, exclude={"status"}).items():
        setattr(task, field, value)

    if notify_fn is not None:
        await notify_fn(db, task)

    await db.commit()
    await db.refresh(task)
    return task
