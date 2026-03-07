import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_active_patron, get_db
from app.models import Comment, Patron
from app.routers.tasks import get_task_or_404
from app.schemas import CommentCreate, CommentRead

router = APIRouter(prefix="/api/tasks/{task_id}/comments", tags=["comments"])


@router.get("", response_model=list[CommentRead])
async def list_comments(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await get_task_or_404(db, task_id)
    result = await db.execute(
        select(Comment)
        .where(Comment.task_id == task_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=CommentRead, status_code=201)
async def create_comment(
    task_id: uuid.UUID,
    payload: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    patron: Annotated[Patron, Depends(get_active_patron)],
):
    await get_task_or_404(db, task_id)
    comment = Comment(task_id=task_id, author_id=patron.id, body=payload.body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return comment
