import uuid

import pytest

from tests.conftest import create_patron, create_task


# --- GET /api/patrons/{patron_id} ---


async def test_get_patron_not_found(client):
    resp = await client.get(f"/api/patrons/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_get_patron_invalid_id(client):
    resp = await client.get("/api/patrons/not-a-uuid")
    assert resp.status_code == 422


async def test_get_patron_basic(client, test_session_maker):
    patron = await create_patron(test_session_maker, "alice@example.com")
    resp = await client.get(f"/api/patrons/{patron.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(patron.id)
    assert data["created_at"] is not None
    assert "submitted_tasks" in data


async def test_get_patron_display_name(client, test_session_maker):
    patron = await create_patron(test_session_maker, "bob@example.com")
    # Default patron has no display_name
    resp = await client.get(f"/api/patrons/{patron.id}")
    assert resp.json()["display_name"] is None


async def test_get_patron_does_not_expose_email(client, test_session_maker):
    patron = await create_patron(test_session_maker, "private@example.com")
    resp = await client.get(f"/api/patrons/{patron.id}")
    data = resp.json()
    assert "email" not in data


async def test_get_patron_with_submitted_tasks(client, test_session_maker):
    patron = await create_patron(test_session_maker, "carol@example.com")
    task1 = await create_task(test_session_maker, title="Fix the road", submitted_by=patron.id)
    task2 = await create_task(test_session_maker, title="Build the park", submitted_by=patron.id)

    resp = await client.get(f"/api/patrons/{patron.id}")
    assert resp.status_code == 200
    data = resp.json()
    task_titles = {t["title"] for t in data["submitted_tasks"]}
    assert task_titles == {"Fix the road", "Build the park"}


async def test_get_patron_no_submitted_tasks(client, test_session_maker):
    patron = await create_patron(test_session_maker, "dave@example.com")
    resp = await client.get(f"/api/patrons/{patron.id}")
    assert resp.json()["submitted_tasks"] == []


async def test_get_patron_excludes_other_patrons_tasks(client, test_session_maker):
    patron_a = await create_patron(test_session_maker, "a@example.com", "cus_a")
    patron_b = await create_patron(test_session_maker, "b@example.com", "cus_b")
    await create_task(test_session_maker, title="A's task", submitted_by=patron_a.id)
    await create_task(test_session_maker, title="B's task", submitted_by=patron_b.id)

    resp = await client.get(f"/api/patrons/{patron_a.id}")
    tasks = resp.json()["submitted_tasks"]
    assert len(tasks) == 1
    assert tasks[0]["title"] == "A's task"
