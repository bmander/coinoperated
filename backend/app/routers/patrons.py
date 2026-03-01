import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db
from app.models import Patron
from app.schemas import PatronProfileRead

router = APIRouter(prefix="/api/patrons", tags=["patrons"])


@router.get("/{patron_id}", response_model=PatronProfileRead)
async def get_patron(
    patron_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Patron)
        .where(Patron.id == patron_id)
        .options(selectinload(Patron.submitted_tasks))
    )
    patron = result.scalar_one_or_none()
    if patron is None:
        raise HTTPException(status_code=404, detail="Patron not found")
    return patron
