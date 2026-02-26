import subprocess
import time

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models import Base
from app.dependencies import get_db

CONTAINER_NAME = "coinoperated-test-pg"
TEST_PORT = 5433
TEST_DB_URL = f"postgresql+asyncpg://postgres:postgres@localhost:{TEST_PORT}/coinoperated_test"


def _pg_container_running() -> bool:
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.State.Running}}", CONTAINER_NAME],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0 and result.stdout.strip() == "true"


def _start_pg_container():
    if _pg_container_running():
        return
    # Remove stale container if it exists but isn't running
    subprocess.run(["docker", "rm", "-f", CONTAINER_NAME], capture_output=True)
    subprocess.run(
        [
            "docker", "run", "-d",
            "--name", CONTAINER_NAME,
            "-e", "POSTGRES_PASSWORD=postgres",
            "-e", "POSTGRES_DB=coinoperated_test",
            "-p", f"{TEST_PORT}:5432",
            "postgres:16-alpine",
        ],
        check=True,
    )
    # Wait for Postgres to accept connections
    for _ in range(30):
        result = subprocess.run(
            ["docker", "exec", CONTAINER_NAME, "pg_isready", "-U", "postgres"],
            capture_output=True,
        )
        if result.returncode == 0:
            return
        time.sleep(0.5)
    raise RuntimeError("Test Postgres container did not become ready")


def _stop_pg_container():
    subprocess.run(["docker", "rm", "-f", CONTAINER_NAME], capture_output=True)


_start_pg_container()

test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()
    _stop_pg_container()


@pytest.fixture(autouse=True)
async def clean_tables():
    yield
    async with test_engine.begin() as conn:
        for table in ("update", "pledge", "task", "patron"):
            await conn.execute(text(f'DELETE FROM "{table}"'))


@pytest.fixture
async def client():
    from app.main import create_app

    app = create_app()

    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
