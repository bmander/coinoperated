from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_jwt
from app.config import settings
from app.database import async_session
from app.models import Patron


async def get_db():
    async with async_session() as session:
        yield session


async def get_current_patron(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Patron:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    patron_id = decode_jwt(token, settings.secret_key)
    if patron_id is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    result = await db.execute(select(Patron).where(Patron.id == patron_id))
    patron = result.scalar_one_or_none()
    if patron is None:
        raise HTTPException(status_code=401, detail="Patron not found")
    return patron


async def get_optional_patron(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Patron | None:
    token = request.cookies.get("session")
    if not token:
        return None
    patron_id = decode_jwt(token, settings.secret_key)
    if patron_id is None:
        return None
    result = await db.execute(select(Patron).where(Patron.id == patron_id))
    return result.scalar_one_or_none()
