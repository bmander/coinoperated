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


async def _resolve_patron(request: Request, db: AsyncSession) -> Patron | None:
    token = request.cookies.get("session")
    if not token:
        return None
    patron_id = decode_jwt(token, settings.secret_key)
    if patron_id is None:
        return None
    result = await db.execute(select(Patron).where(Patron.id == patron_id))
    return result.scalar_one_or_none()


async def get_current_patron(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Patron:
    patron = await _resolve_patron(request, db)
    if patron is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return patron


async def get_optional_patron(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Patron | None:
    return await _resolve_patron(request, db)


async def get_active_patron(
    patron: Annotated[Patron, Depends(get_current_patron)],
) -> Patron:
    if patron.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been suspended")
    return patron


async def get_admin_patron(
    patron: Annotated[Patron, Depends(get_current_patron)],
) -> Patron:
    if patron.email != settings.admin_email:
        raise HTTPException(status_code=403, detail="Admin access required")
    return patron
