from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer

from app.models import Base, MagicLinkToken, Patron
from app.dependencies import get_db
from app.config import settings


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
        for table in ("magic_link_token", "update", "pledge", "task", "patron"):
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
            expires_at=datetime.now(timezone.utc) + delta,
            used=used,
        )
        session.add(mlt)
        await session.commit()
        return mlt


async def create_patron(
    session_maker,
    email: str,
    stripe_customer: str = "cus_test",
) -> Patron:
    async with session_maker() as session:
        patron = Patron(email=email, stripe_customer=stripe_customer)
        session.add(patron)
        await session.commit()
        await session.refresh(patron)
        return patron
