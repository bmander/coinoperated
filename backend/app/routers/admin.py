import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_admin_patron, get_db
from app.models import Patron, Pledge, Task, Update
from app.routers.tasks import get_task_or_404
from app.schemas import AdminPledgeRead, AdminTaskListResponse, AdminTaskRead, TaskRead, UpdateRead

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
