import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_patron, get_db
from app.models import Patron, Task, TaskStatus
from app.schemas import TaskCreate, TaskDetail, TaskListResponse, TaskRead, TaskUpdate

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


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    payload: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    patron: Annotated[Patron, Depends(get_current_patron)],
):
    task = Task(
        title=payload.title,
        description=payload.description,
        criteria=payload.criteria,
        submitted_by=patron.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = await get_task_or_404(db, task_id)

    if payload.status is not None and payload.status != task.status:
        allowed = VALID_TRANSITIONS.get(task.status, set())
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition: {task.status.value} -> {payload.status.value}",
            )

        now = datetime.now(timezone.utc)

        if payload.status == TaskStatus.accepted:
            task.accepted_at = now
        elif payload.status == TaskStatus.declined:
            task.declined_at = now
        elif payload.status == TaskStatus.completed:
            task.completed_at = now
        elif payload.status == TaskStatus.open and task.status == TaskStatus.accepted:
            task.accepted_at = None

        task.status = payload.status

    for field, value in payload.model_dump(exclude_unset=True, exclude={"status"}).items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task
