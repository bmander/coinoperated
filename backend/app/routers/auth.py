from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_jwt,
    create_stripe_customer,
    generate_magic_token,
    send_magic_link,
)
from app.config import settings
from app.dependencies import get_current_patron, get_db
from app.models import MagicLinkToken, Patron
from app.schemas import LoginRequest, PatronMe

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _error_redirect(error_code: str) -> RedirectResponse:
    return RedirectResponse(
        url=f"{settings.frontend_url}/signin?error={error_code}",
        status_code=302,
    )


@router.post("/login")
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    token = generate_magic_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.magic_link_expiry_minutes
    )
    magic_link = MagicLinkToken(
        email=payload.email,
        token=token,
        expires_at=expires_at,
    )
    db.add(magic_link)
    await db.commit()

    link = f"{settings.frontend_url}/api/auth/verify?token={token}"
    await send_magic_link(payload.email, link)

    return {"message": "Check your email"}


@router.get("/verify")
async def verify(
    token: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(MagicLinkToken).where(MagicLinkToken.token == token)
    )
    magic_token = result.scalar_one_or_none()

    if magic_token is None or magic_token.used:
        return _error_redirect("invalid_token")

    if magic_token.expires_at < datetime.now(timezone.utc):
        return _error_redirect("expired_token")

    magic_token.used = True
    await db.flush()

    # Find or create patron
    patron_result = await db.execute(
        select(Patron).where(Patron.email == magic_token.email)
    )
    patron = patron_result.scalar_one_or_none()

    if patron is None:
        stripe_customer_id = create_stripe_customer(magic_token.email)
        patron = Patron(
            email=magic_token.email,
            stripe_customer=stripe_customer_id,
        )
        db.add(patron)
        await db.flush()
        await db.refresh(patron)

    await db.commit()

    jwt_token = create_jwt(patron.id, settings.secret_key, settings.session_expiry_days)

    response = RedirectResponse(url=f"{settings.frontend_url}/", status_code=302)
    response.set_cookie(
        key="session",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_expiry_days * 86400,
    )
    return response


@router.get("/me", response_model=PatronMe)
async def me(
    patron: Annotated[Patron, Depends(get_current_patron)],
):
    return PatronMe(
        id=patron.id,
        email=patron.email,
        display_name=patron.display_name,
        is_admin=patron.email == settings.admin_email,
        is_banned=patron.is_banned,
        has_payment_method=patron.default_payment_method is not None,
        default_payment_method=patron.default_payment_method,
    )


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key="session")
    return response
