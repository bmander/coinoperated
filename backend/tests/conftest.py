import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text, update as sa_update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

from app.auth import create_jwt
from app.config import settings
from app.dependencies import get_db
from app.models import Base, EmailPreference, MagicLinkToken, Notification, NotificationType, Patron, Pledge, PledgeStatus, Task


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer(
        image="postgres:16-alpine",
        username="postgres",
        password="postgres",
        dbname="coinoperated_test",
        driver="asyncpg",
    ) as pg:
        yield pg


@pytest.fixture(scope="session")
def test_engine(postgres_container):
    url = postgres_container.get_connection_url()
    return create_async_engine(url, poolclass=NullPool)


@pytest.fixture(scope="session")
def test_session_maker(test_engine):
    return async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_db(test_engine):
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables(test_engine):
    yield
    async with test_engine.begin() as conn:
        for table in ("email_preference", "notification", "magic_link_token", "update", "pledge", "task", "patron"):
            await conn.execute(text(f'DELETE FROM "{table}"'))


@pytest.fixture
async def client(test_session_maker):
    from app.main import create_app

    app = create_app()

    async def override_get_db():
        async with test_session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
async def test_patron(test_session_maker):
    return await create_patron(test_session_maker, "test@example.com")


@pytest.fixture
async def authed_client(test_patron, client):
    token = create_jwt(test_patron.id, settings.secret_key, expiry_days=30)
    client.cookies.set("session", token)
    yield client


def mock_setup_intent(si_id="si_test_123", client_secret="seti_test_secret"):
    si = MagicMock()
    si.id = si_id
    si.client_secret = client_secret
    return si


async def create_magic_token(
    session_maker,
    email: str,
    token: str,
    *,
    expired: bool = False,
    used: bool = False,
) -> MagicLinkToken:
    delta = timedelta(minutes=-1) if expired else timedelta(minutes=15)
    async with session_maker() as session:
        mlt = MagicLinkToken(
            email=email,
            token=token,
            expires_at=datetime.now(UTC) + delta,
            used=used,
        )
        session.add(mlt)
        await session.commit()
        return mlt


def auth_cookies(patron):
    token = create_jwt(patron.id, settings.secret_key, expiry_days=30)
    return {"session": token}


async def create_patron(
    session_maker,
    email: str,
    stripe_customer: str = "cus_test",
    is_banned: bool = False,
) -> Patron:
    async with session_maker() as session:
        patron = Patron(email=email, stripe_customer=stripe_customer, is_banned=is_banned)
        session.add(patron)
        await session.commit()
        await session.refresh(patron)
        return patron


async def create_task(session_maker, **overrides) -> Task:
    defaults = {"title": "Test task", "description": "A test task", "status": "proposed"}
    defaults.update(overrides)
    async with session_maker() as session:
        task = Task(**defaults)
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return task


async def create_pledge(session_maker, *, patron_id, task_id, **overrides) -> Pledge:
    defaults = {
        "patron_id": patron_id,
        "task_id": task_id,
        "amount": 1000,
        "status": PledgeStatus.active,
        "setup_intent": "si_test",
        "payment_method": "pm_test",
        "save_card": True,
    }
    defaults.update(overrides)
    async with session_maker() as session:
        pledge = Pledge(**defaults)
        session.add(pledge)
        await session.commit()
        await session.refresh(pledge)
        return pledge


async def backdate_review(session_maker, task_id, days_ago=8):
    """Set review_at to the past so the review period has elapsed."""
    task_uuid = task_id if isinstance(task_id, uuid.UUID) else uuid.UUID(task_id)
    async with session_maker() as session:
        await session.execute(
            sa_update(Task)
            .where(Task.id == task_uuid)
            .values(review_at=datetime.now(UTC) - timedelta(days=days_ago))
        )
        await session.commit()


async def create_notification(
    session_maker, *, patron_id, task_id, **overrides
) -> Notification:
    defaults = {
        "patron_id": patron_id,
        "task_id": task_id,
        "type": NotificationType.task_accepted,
        "subject": "Test notification",
        "body": "Test body",
        "email_sent": False,
    }
    defaults.update(overrides)
    async with session_maker() as session:
        notification = Notification(**defaults)
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return notification


async def create_email_preference(
    session_maker, *, patron_id, notification_type, enabled=True
) -> EmailPreference:
    async with session_maker() as session:
        pref = EmailPreference(
            patron_id=patron_id,
            notification_type=notification_type,
            enabled=enabled,
        )
        session.add(pref)
        await session.commit()
        await session.refresh(pref)
        return pref
