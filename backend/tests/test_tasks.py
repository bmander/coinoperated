import uuid

import pytest


# --- Helpers ---


async def create_task(client, **overrides):
    payload = {"title": "Fix the bus", "description": "It's broken"}
    payload.update(overrides)
    resp = await client.post("/api/tasks", json=payload)
    assert resp.status_code == 201
    return resp.json()


async def seed_tasks(client):
    a = await create_task(client, title="Task A", description="Desc A")
    b = await create_task(client, title="Task B", description="Desc B")
    c = await create_task(client, title="Task C", description="Desc C")
    # Decline task C to have a different status
    await client.patch(f"/api/tasks/{c['id']}", json={"status": "declined"})
    return a, b, c


# --- GET /api/tasks ---


async def test_list_tasks_empty(client):
    resp = await client.get("/api/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_tasks_returns_items(client):
    await seed_tasks(client)
    resp = await client.get("/api/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_list_tasks_filter_by_status(client):
    await seed_tasks(client)
    resp = await client.get("/api/tasks", params={"status": "declined"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Task C"


async def test_list_tasks_sort_by_pledge_total(client):
    await seed_tasks(client)
    resp = await client.get(
        "/api/tasks", params={"sort_by": "pledge_total", "sort_order": "desc"}
    )
    data = resp.json()
    totals = [item["pledge_total"] for item in data["items"]]
    assert totals == sorted(totals, reverse=True)


async def test_list_tasks_pagination(client):
    await seed_tasks(client)
    resp = await client.get("/api/tasks", params={"offset": 0, "limit": 2})
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["offset"] == 0
    assert data["limit"] == 2


async def test_list_tasks_invalid_sort_by(client):
    resp = await client.get("/api/tasks", params={"sort_by": "evil"})
    assert resp.status_code == 422


# --- GET /api/tasks/{id} ---


async def test_get_task(client):
    task = await create_task(client, criteria="Bus works")
    resp = await client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Fix the bus"
    assert data["description"] == "It's broken"
    assert data["criteria"] == "Bus works"
    assert data["status"] == "open"
    assert "updates" in data
    assert data["updates"] == []


async def test_get_task_not_found(client):
    resp = await client.get(f"/api/tasks/{uuid.uuid4()}")
    assert resp.status_code == 404


# --- POST /api/tasks ---


async def test_create_task_basic(client):
    resp = await client.post(
        "/api/tasks",
        json={"title": "New task", "description": "Do something useful"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New task"
    assert data["status"] == "open"
    assert data["submitted_by"] is None


async def test_create_task_with_criteria(client):
    resp = await client.post(
        "/api/tasks",
        json={
            "title": "Another task",
            "description": "Details here",
            "criteria": "Ship it",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["criteria"] == "Ship it"


async def test_create_task_validation_empty_title(client):
    resp = await client.post(
        "/api/tasks", json={"title": "", "description": "Has a description"}
    )
    assert resp.status_code == 422


async def test_create_task_validation_missing_description(client):
    resp = await client.post("/api/tasks", json={"title": "No description"})
    assert resp.status_code == 422


# --- PATCH /api/tasks/{id} ---


async def test_update_task_accept(client):
    task = await create_task(client)
    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "accepted"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["accepted_at"] is not None


async def test_update_task_decline(client):
    task = await create_task(client)
    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "declined"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "declined"
    assert data["declined_at"] is not None


async def test_update_task_abandon(client):
    task = await create_task(client)
    await client.patch(f"/api/tasks/{task['id']}", json={"status": "accepted"})

    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "open"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "open"
    assert data["accepted_at"] is None


async def test_update_task_collecting(client):
    task = await create_task(client)
    await client.patch(f"/api/tasks/{task['id']}", json={"status": "accepted"})

    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "collecting"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "collecting"


async def test_update_task_invalid_transition(client):
    task = await create_task(client)
    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "completed"}
    )
    assert resp.status_code == 400
    assert "Invalid status transition" in resp.json()["detail"]


async def test_update_task_edit_evidence(client):
    task = await create_task(client)
    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"evidence": "Merged PR #42"}
    )
    assert resp.status_code == 200
    assert resp.json()["evidence"] == "Merged PR #42"


async def test_update_task_edit_fields(client):
    task = await create_task(client)
    resp = await client.patch(
        f"/api/tasks/{task['id']}",
        json={"title": "Updated title", "description": "Updated desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated title"
    assert data["description"] == "Updated desc"


async def test_update_task_not_found(client):
    resp = await client.patch(
        f"/api/tasks/{uuid.uuid4()}", json={"title": "Nope"}
    )
    assert resp.status_code == 404


async def test_declined_is_terminal(client):
    task = await create_task(client)
    await client.patch(f"/api/tasks/{task['id']}", json={"status": "declined"})

    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "open"}
    )
    assert resp.status_code == 400


async def test_completed_is_terminal(client):
    task = await create_task(client)
    await client.patch(f"/api/tasks/{task['id']}", json={"status": "accepted"})
    await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "collecting"}
    )
    await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "completed"}
    )

    resp = await client.patch(
        f"/api/tasks/{task['id']}", json={"status": "open"}
    )
    assert resp.status_code == 400
