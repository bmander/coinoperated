from unittest.mock import patch

from sqlalchemy import select

from app.auth import create_jwt
from app.config import settings
from app.models import MagicLinkToken, Patron
from tests.conftest import create_magic_token, create_patron


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
    await create_magic_token(test_session_maker, "new@example.com", "valid-test-token")

    resp = await client.get(
        "/api/auth/verify", params={"token": "valid-test-token"}, follow_redirects=False
    )
    assert resp.status_code == 302
    assert "session" in resp.cookies

    async with test_session_maker() as session:
        result = await session.execute(
            select(Patron).where(Patron.email == "new@example.com")
        )
        patron = result.scalar_one()
        assert patron.stripe_customer == "cus_test123"

    mock_stripe.assert_called_once_with("new@example.com")


async def test_verify_expired_token_redirects_with_error(client, test_session_maker):
    await create_magic_token(
        test_session_maker, "expired@example.com", "expired-test-token", expired=True
    )

    resp = await client.get(
        "/api/auth/verify",
        params={"token": "expired-test-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert "error=expired_token" in resp.headers["location"]


async def test_verify_used_token_redirects_with_error(client, test_session_maker):
    await create_magic_token(
        test_session_maker, "used@example.com", "used-test-token", used=True
    )

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
    patron = await create_patron(test_session_maker, "me@example.com", "cus_me")

    token = create_jwt(patron.id, settings.secret_key, 30)
    resp = await client.get("/api/auth/me", cookies={"session": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@example.com"
    assert data["id"] == str(patron.id)
    assert data["is_admin"] is False


async def test_me_without_session(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_admin_email(client, test_session_maker):
    admin_email = "admin@example.com"
    patron = await create_patron(test_session_maker, admin_email, "cus_admin")

    token = create_jwt(patron.id, settings.secret_key, 30)

    with patch("app.routers.auth.settings") as mock_settings:
        mock_settings.admin_email = admin_email
        mock_settings.secret_key = settings.secret_key
        resp = await client.get("/api/auth/me", cookies={"session": token})

    assert resp.status_code == 200
    assert resp.json()["is_admin"] is True


async def test_logout_clears_cookie(client):
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert "session" in resp.headers.get("set-cookie", "")


@patch("app.routers.auth.create_stripe_customer", return_value="cus_existing")
async def test_second_login_reuses_existing_patron(
    mock_stripe, client, test_session_maker
):
    await create_patron(test_session_maker, "existing@example.com", "cus_existing")
    await create_magic_token(
        test_session_maker, "existing@example.com", "reuse-test-token"
    )

    resp = await client.get(
        "/api/auth/verify",
        params={"token": "reuse-test-token"},
        follow_redirects=False,
    )
    assert resp.status_code == 302

    mock_stripe.assert_not_called()

    async with test_session_maker() as session:
        result = await session.execute(
            select(Patron).where(Patron.email == "existing@example.com")
        )
        patrons = result.scalars().all()
        assert len(patrons) == 1
