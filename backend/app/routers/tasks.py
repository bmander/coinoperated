import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.dependencies import get_active_patron, get_admin_patron, get_db, get_session_factory
from app.models import Patron, Task, TaskStatus
from app.notifications import (
    notify_task_accepted,
    notify_task_completed,
    notify_task_declined,
    notify_task_review_started,
    schedule_emails,
)
from app.schemas import TaskCreate, TaskCreateResponse, TaskDetail, TaskListResponse, TaskRead, TaskUpdate
from app.services.pledges import PaymentMethodOwnershipError, create_pledge_for_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

VALID_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.proposed: {TaskStatus.underway, TaskStatus.declined},
    TaskStatus.underway: {TaskStatus.review, TaskStatus.proposed},
    TaskStatus.review: {TaskStatus.collecting},
    TaskStatus.collecting: {TaskStatus.completed},
}


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: TaskStatus | None = None,
    sort_by: Annotated[str, Query(pattern="^(pledge_total|created_at)$")] = "created_at",
    sort_order: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    query = select(Task).options(selectinload(Task.submitted_by_patron))
    count_query = select(func.count()).select_from(Task)

    if status is not None:
        query = query.where(Task.status == status)
        count_query = count_query.where(Task.status == status)

    sort_column = getattr(Task, sort_by)
    query = query.order_by(sort_column.desc()) if sort_order == "desc" else query.order_by(sort_column.asc())

    total = (await db.execute(count_query)).scalar()
    result = await db.execute(query.offset(offset).limit(limit))
    tasks = result.scalars().all()

    return TaskListResponse(items=tasks, total=total, offset=offset, limit=limit)


async def get_task_or_404(
    db: AsyncSession, task_id: uuid.UUID, *, load_updates: bool = False
) -> Task:
    query = select(Task).where(Task.id == task_id).options(selectinload(Task.submitted_by_patron))
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
        try:
            result = await create_pledge_for_task(
                db,
                patron=patron,
                task=task,
                amount=payload.pledge_amount,
                payment_method_id=payload.payment_method_id,
                save_card=payload.save_card,
            )
        except PaymentMethodOwnershipError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        pledge_id = result.pledge.id
        client_secret = result.client_secret
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
    background_tasks: BackgroundTasks,
    _admin: Annotated[Patron, Depends(get_admin_patron)],
    session_factory=Depends(get_session_factory),
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

        now = datetime.now(UTC)

        if payload.status == TaskStatus.underway:
            task.underway_at = now
            notify_fn = notify_task_accepted
        elif payload.status == TaskStatus.declined:
            task.declined_at = now
            notify_fn = notify_task_declined
        elif payload.status == TaskStatus.review:
            task.review_at = now
            notify_fn = notify_task_review_started
        elif payload.status == TaskStatus.collecting:
            if old_status == TaskStatus.review:
                review_end = task.review_at + timedelta(days=7)
                if now < review_end:
                    remaining = review_end - now
                    days = remaining.days
                    hours = remaining.seconds // 3600
                    raise HTTPException(
                        status_code=400,
                        detail=f"Review period not over. {days}d {hours}h remaining.",
                    )
            notify_fn = notify_task_completed
        elif payload.status == TaskStatus.completed:
            task.completed_at = now
        elif payload.status == TaskStatus.proposed and old_status == TaskStatus.underway:
            task.underway_at = None

        task.status = payload.status

    for field, value in payload.model_dump(exclude_unset=True, exclude={"status"}).items():
        setattr(task, field, value)

    pending_emails = []
    if notify_fn is not None:
        pending_emails = await notify_fn(db, task)

    await db.commit()
    await db.refresh(task)
    schedule_emails(background_tasks, pending_emails, session_factory)
    return task
