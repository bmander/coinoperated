import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import select

from app.auth import create_jwt
from app.models import MagicLinkToken, Patron


async def test_login_returns_200_and_creates_token(client, test_session_maker):
    resp = await client.post("/api/auth/login", json={"email": "test@example.com"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "Check your email"

    async with test_session_maker() as session:
        result = await session.execute(
            select(MagicLinkToken).where(MagicLinkToken.email == "test@example.com")
        )
        token = result.scalar_one()
        assert token is not None
        assert not token.used


async def test_login_invalid_email_returns_422(client):
    resp = await client.post("/api/auth/login", json={})
    assert resp.status_code == 422


@patch("app.routers.auth.create_stripe_customer", return_value="cus_test123")
async def test_verify_valid_token_sets_cookie_creates_patron(
    mock_stripe, client, test_session_maker
):
    # Create a magic link token
    async with test_session_maker() as session:
        mlt = MagicLinkToken(
            email="new@example.com",
            token="valid-test-token",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        session.add(mlt)
        await session.commit()

    resp = await client.get(
        "/api/auth/verify", params={"token": "valid-test-token"}, follow_redirects=False
    )
    assert resp.status_code == 302
    assert "session" in resp.cookies

    # Verify patron was created
    async with test_session_maker() as session:
        result = await session.execute(
            select(Patron).where(Patron.email == "new@example.com")
        )
        patron = result.scalar_one()
        assert patron.stripe_customer == "cus_test123"

    mock_stripe.assert_called_once_with("new@example.com")


async def test_verify_expired_token_redirects_with_error(client, test_session_maker):
    async with test_session_maker() as session:
        mlt = MagicLinkToken(
            email="expired@example.com",
            token="expired-test-token",
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        session.add(mlt)
        await session.commit()

    resp = await client.get(
        "/api/auth/verify",
        params={"token": "expired-test-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error=expired_token" in resp.headers["location"]


async def test_verify_used_token_redirects_with_error(client, test_session_maker):
    async with test_session_maker() as session:
        mlt = MagicLinkToken(
            email="used@example.com",
            token="used-test-token",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
            used=True,
        )
        session.add(mlt)
        await session.commit()

    resp = await client.get(
        "/api/auth/verify",
        params={"token": "used-test-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error=invalid_token" in resp.headers["location"]


async def test_verify_nonexistent_token_redirects_with_error(client):
    resp = await client.get(
        "/api/auth/verify",
        params={"token": "no-such-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error=invalid_token" in resp.headers["location"]


async def test_me_with_valid_session(client, test_session_maker):
    # Create patron directly
    async with test_session_maker() as session:
        patron = Patron(
            email="me@example.com",
            stripe_customer="cus_me",
        )
        session.add(patron)
        await session.commit()
        await session.refresh(patron)
        patron_id = patron.id

    token = create_jwt(patron_id, "change-me-in-production", 30)
    resp = await client.get("/api/auth/me", cookies={"session": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["id"] == str(patron_id)
    assert data["is_admin"] is False


async def test_me_without_session(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_admin_email(client, test_session_maker):
    admin_email = "admin@example.com"

    async with test_session_maker() as session:
        patron = Patron(
            email=admin_email,
            stripe_customer="cus_admin",
        )
        session.add(patron)
        await session.commit()
        await session.refresh(patron)
        patron_id = patron.id

    token = create_jwt(patron_id, "change-me-in-production", 30)

    with patch("app.routers.auth.settings") as mock_settings:
        mock_settings.admin_email = admin_email
        mock_settings.secret_key = "change-me-in-production"
        resp = await client.get("/api/auth/me", cookies={"session": token})

    assert resp.status_code == 200
    assert resp.json()["is_admin"] is True


async def test_logout_clears_cookie(client):
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    # Cookie should be cleared (set with max-age=0 or deleted)
    assert "session" in resp.headers.get("set-cookie", "")


@patch("app.routers.auth.create_stripe_customer", return_value="cus_existing")
async def test_second_login_reuses_existing_patron(
    mock_stripe, client, test_session_maker
):
    # Create existing patron
    async with test_session_maker() as session:
        patron = Patron(
            email="existing@example.com",
            stripe_customer="cus_existing",
        )
        session.add(patron)
        await session.commit()

    # Create a magic link token
    async with test_session_maker() as session:
        mlt = MagicLinkToken(
            email="existing@example.com",
            token="reuse-test-token",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        )
        session.add(mlt)
        await session.commit()

    resp = await client.get(
        "/api/auth/verify",
        params={"token": "reuse-test-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302

    # Should not have created a new Stripe customer
    mock_stripe.assert_not_called()

    # Should still be only one patron with that email
    async with test_session_maker() as session:
        result = await session.execute(
            select(Patron).where(Patron.email == "existing@example.com")
        )
        patrons = result.scalars().all()
        assert len(patrons) == 1
