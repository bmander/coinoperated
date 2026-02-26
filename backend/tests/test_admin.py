import uuid
from unittest.mock import patch

from app.auth import create_jwt
from app.config import settings
from tests.conftest import create_patron, create_pledge, create_task

ADMIN_EMAIL = "admin@example.com"


def _admin_settings():
    """Return a mock settings object with admin_email set."""

    class FakeSettings:
        admin_email = ADMIN_EMAIL
        secret_key = settings.secret_key

    return FakeSettings()


async def _make_admin(session_maker):
    patron = await create_patron(session_maker, ADMIN_EMAIL, "cus_admin")
    token = create_jwt(patron.id, settings.secret_key, 30)
    return patron, token


# --- GET /api/admin/tasks ---


async def test_admin_tasks_requires_auth(client):
    resp = await client.get("/api/admin/tasks")
    assert resp.status_code == 401


async def test_admin_tasks_rejects_non_admin(client, test_session_maker):
    patron = await create_patron(test_session_maker, "user@example.com", "cus_user")
    token = create_jwt(patron.id, settings.secret_key, 30)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.get("/api/admin/tasks", cookies={"session": token})
    assert resp.status_code == 403


async def test_admin_tasks_returns_tasks_with_pledges(client, test_session_maker):
    admin, token = await _make_admin(test_session_maker)
    task = await create_task(test_session_maker, title="Task with pledges")

    backer = await create_patron(test_session_maker, "backer@example.com", "cus_backer")
    await create_pledge(test_session_maker, patron_id=backer.id, task_id=task.id, amount=2000)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.get("/api/admin/tasks", cookies={"session": token})

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1

    item = data["items"][0]
    assert item["title"] == "Task with pledges"
    assert len(item["pledges"]) == 1
    assert item["pledges"][0]["patron_email"] == "backer@example.com"
    assert item["pledges"][0]["amount"] == 2000


async def test_admin_tasks_empty(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.get("/api/admin/tasks", cookies={"session": token})

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


# --- POST /api/tasks/{task_id}/updates ---


async def test_post_update_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.post(f"/api/tasks/{task.id}/updates", json={"body": "hi"})
    assert resp.status_code == 401


async def test_post_update_rejects_non_admin(client, test_session_maker):
    patron = await create_patron(test_session_maker, "user@example.com", "cus_user")
    token = create_jwt(patron.id, settings.secret_key, 30)
    task = await create_task(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/updates",
            json={"body": "sneaky"},
            cookies={"session": token},
        )
    assert resp.status_code == 403


async def test_post_update_creates_update(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/updates",
            json={"body": "Making progress!"},
            cookies={"session": token},
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "Making progress!"
    assert data["task_id"] == str(task.id)
    assert "id" in data
    assert "created_at" in data


async def test_post_update_task_not_found(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    fake_id = uuid.uuid4()
    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{fake_id}/updates",
            json={"body": "no task"},
            cookies={"session": token},
        )
    assert resp.status_code == 404
