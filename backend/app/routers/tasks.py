import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models import Task, TaskStatus
from app.schemas import TaskCreate, TaskDetail, TaskListResponse, TaskRead, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

VALID_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.open: {TaskStatus.accepted, TaskStatus.declined},
    TaskStatus.accepted: {TaskStatus.collecting, TaskStatus.open},
    TaskStatus.collecting: {TaskStatus.completed},
}


async def get_db():
    async with async_session() as session:
        yield session


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


@router.get("/{task_id}", response_model=TaskDetail)
async def get_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.updates))
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    payload: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = Task(
        title=payload.title,
        description=payload.description,
        criteria=payload.criteria,
        submitted_by=payload.submitted_by,
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
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

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

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.criteria is not None:
        task.criteria = payload.criteria
    if payload.evidence is not None:
        task.evidence = payload.evidence

    await db.commit()
    await db.refresh(task)
    return task
