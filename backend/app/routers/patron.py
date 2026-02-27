from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_patron, get_db
from app.models import Notification, Patron, Pledge
from app.schemas import NotificationRead, PatronPledgeRead

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


@router.get("/notifications", response_model=list[NotificationRead])
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
    notifications = result.scalars().all()
    return [
        NotificationRead(
            id=n.id,
            task_id=n.task_id,
            task_title=n.task.title,
            event=n.event,
            message=n.message,
            created_at=n.created_at,
        )
        for n in notifications
    ]
