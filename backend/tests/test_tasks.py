import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select

from app.config import settings
from app.models import Pledge
from tests.conftest import auth_cookies, backdate_review, mock_setup_intent
from tests.conftest import create_patron as create_patron_db

# --- Helpers ---

ADMIN_EMAIL = "test@example.com"


def _admin_settings():
    """Return a mock settings object with admin_email matching the test patron."""

    class FakeSettings:
        admin_email = ADMIN_EMAIL
        secret_key = settings.secret_key
        stripe_publishable_key = settings.stripe_publishable_key

    return FakeSettings()


@pytest.fixture(autouse=True)
def _patch_admin_settings():
    """Make the default test patron (test@example.com) an admin for task CRUD tests."""
    fake = _admin_settings()
    with patch("app.routers.tasks.settings", fake), patch("app.dependencies.settings", fake):
        yield


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


async def test_list_tasks_returns_items(authed_client):
    await seed_tasks(authed_client)
    resp = await authed_client.get("/api/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_list_tasks_filter_by_status(authed_client):
    await seed_tasks(authed_client)
    resp = await authed_client.get("/api/tasks", params={"status": "declined"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Task C"


async def test_list_tasks_sort_by_pledge_total(authed_client):
    await seed_tasks(authed_client)
    resp = await authed_client.get(
        "/api/tasks", params={"sort_by": "pledge_total", "sort_order": "desc"}
    )
    data = resp.json()
    totals = [item["pledge_total"] for item in data["items"]]
    assert totals == sorted(totals, reverse=True)


async def test_list_tasks_pagination(authed_client):
    await seed_tasks(authed_client)
    resp = await authed_client.get("/api/tasks", params={"offset": 0, "limit": 2})
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["offset"] == 0
    assert data["limit"] == 2


async def test_list_tasks_invalid_sort_by(client):
    resp = await client.get("/api/tasks", params={"sort_by": "evil"})
    assert resp.status_code == 422


# --- GET /api/tasks/{id} ---


async def test_get_task(authed_client):
    task = await create_task(authed_client, criteria="Bus works")
    resp = await authed_client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Fix the bus"
    assert data["description"] == "It's broken"
    assert data["criteria"] == "Bus works"
    assert data["status"] == "proposed"
    assert "updates" in data
    assert data["updates"] == []


async def test_get_task_not_found(client):
    resp = await client.get(f"/api/tasks/{uuid.uuid4()}")
    assert resp.status_code == 404


# --- POST /api/tasks (admin) ---


async def test_create_task_requires_auth(client):
    resp = await client.post(
        "/api/tasks",
        json={"title": "New task", "description": "Do something useful"},
    )
    assert resp.status_code == 401


async def test_create_task_basic(authed_client, test_patron):
    resp = await authed_client.post(
        "/api/tasks",
        json={"title": "New task", "description": "Do something useful"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "New task"
    assert data["status"] == "proposed"
    assert data["submitted_by"] == str(test_patron.id)
    assert data["pledge_id"] is None
    assert data["client_secret"] is None


async def test_create_task_with_criteria(authed_client):
    resp = await authed_client.post(
        "/api/tasks",
        json={
            "title": "Another task",
            "description": "Details here",
            "criteria": "Ship it",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["criteria"] == "Ship it"


async def test_create_task_validation_empty_title(authed_client):
    resp = await authed_client.post(
        "/api/tasks", json={"title": "", "description": "Has a description"}
    )
    assert resp.status_code == 422


async def test_create_task_validation_missing_description(authed_client):
    resp = await authed_client.post("/api/tasks", json={"title": "No description"})
    assert resp.status_code == 422


async def test_create_task_banned_user_gets_403(client, test_session_maker):
    banned = await create_patron_db(
        test_session_maker, "banned@example.com", "cus_banned", is_banned=True
    )
    resp = await client.post(
        "/api/tasks",
        json={"title": "Sneaky task", "description": "Should be blocked"},
        cookies=auth_cookies(banned),
    )
    assert resp.status_code == 403


# --- POST /api/tasks (non-admin pledge requirement) ---


async def test_create_task_non_admin_requires_pledge(client, test_session_maker):
    patron = await create_patron_db(test_session_maker, "user@example.com", "cus_user")
    resp = await client.post(
        "/api/tasks",
        json={"title": "My task", "description": "Do something"},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 400
    assert "pledge is required" in resp.json()["detail"].lower()


async def test_create_task_non_admin_pledge_below_minimum(client, test_session_maker):
    patron = await create_patron_db(
        test_session_maker, "user2@example.com", "cus_user2"
    )
    resp = await client.post(
        "/api/tasks",
        json={"title": "My task", "description": "Do something", "pledge_amount": 50},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 422


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_task_non_admin_with_pledge(
    mock_si_create, client, test_session_maker
):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron_db(
        test_session_maker, "user3@example.com", "cus_user3"
    )
    resp = await client.post(
        "/api/tasks",
        json={
            "title": "My task",
            "description": "Do something",
            "pledge_amount": 500,
        },
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My task"
    assert data["status"] == "proposed"
    assert data["pledge_id"] is not None
    assert data["client_secret"] == "seti_test_secret"
    assert data["publishable_key"] == settings.stripe_publishable_key
    mock_si_create.assert_called_once()


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_task_admin_with_optional_pledge(
    mock_si_create, authed_client, test_patron
):
    """Admin can optionally include a pledge when creating a task."""
    mock_si_create.return_value = mock_setup_intent()
    resp = await authed_client.post(
        "/api/tasks",
        json={
            "title": "Admin task with pledge",
            "description": "Details",
            "pledge_amount": 2500,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["pledge_id"] is not None
    assert data["client_secret"] == "seti_test_secret"
    mock_si_create.assert_called_once()


# --- PATCH /api/tasks/{id} ---


async def test_update_task_accept(authed_client):
    task = await create_task(authed_client)
    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "underway"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "underway"
    assert data["underway_at"] is not None


async def test_update_task_decline(authed_client):
    task = await create_task(authed_client)
    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "declined"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "declined"
    assert data["declined_at"] is not None


async def test_update_task_abandon(authed_client):
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "proposed"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "proposed"
    assert data["underway_at"] is None


async def test_update_task_review(authed_client):
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "review"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "review"
    assert data["review_at"] is not None


async def test_underway_to_collecting_invalid(authed_client):
    """Direct underway -> collecting is no longer valid; must go through review."""
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "collecting"}
    )
    assert resp.status_code == 400
    assert "Invalid status transition" in resp.json()["detail"]


async def test_update_task_invalid_transition(authed_client):
    task = await create_task(authed_client)
    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "completed"}
    )
    assert resp.status_code == 400
    assert "Invalid status transition" in resp.json()["detail"]


async def test_update_task_edit_evidence(authed_client):
    task = await create_task(authed_client)
    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"evidence": "Merged PR #42"}
    )
    assert resp.status_code == 200
    assert resp.json()["evidence"] == "Merged PR #42"


async def test_update_task_edit_fields(authed_client):
    task = await create_task(authed_client)
    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}",
        json={"title": "Updated title", "description": "Updated desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated title"
    assert data["description"] == "Updated desc"


async def test_update_task_not_found(authed_client):
    resp = await authed_client.patch(
        f"/api/tasks/{uuid.uuid4()}", json={"title": "Nope"}
    )
    assert resp.status_code == 404


async def test_declined_is_terminal(authed_client):
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "declined"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "proposed"}
    )
    assert resp.status_code == 400


async def test_completed_is_terminal(authed_client, test_session_maker):
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "review"})
    await backdate_review(test_session_maker, task["id"])
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "collecting"})
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "completed"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "proposed"}
    )
    assert resp.status_code == 400


# --- POST /api/tasks with payment_method_id / save_card ---


@patch("app.services.pledges.stripe.PaymentMethod.retrieve")
async def test_create_task_with_saved_pm(mock_pm_retrieve, client, test_session_maker):
    patron = await create_patron_db(test_session_maker, "user4@example.com", "cus_user4")
    mock_pm = MagicMock()
    mock_pm.customer = "cus_user4"
    mock_pm_retrieve.return_value = mock_pm

    resp = await client.post(
        "/api/tasks",
        json={
            "title": "My task",
            "description": "Do something",
            "pledge_amount": 500,
            "payment_method_id": "pm_saved_123",
        },
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["pledge_id"] is not None
    assert data["client_secret"] is None
    assert data["publishable_key"] == settings.stripe_publishable_key
    mock_pm_retrieve.assert_called_once_with("pm_saved_123")

    # Verify task counts were updated
    task_resp = await client.get(f"/api/tasks/{data['id']}")
    assert task_resp.json()["pledge_count"] == 1
    assert task_resp.json()["pledge_total"] == 500


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_task_save_card_false(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron_db(test_session_maker, "user5@example.com", "cus_user5")

    resp = await client.post(
        "/api/tasks",
        json={
            "title": "My task",
            "description": "Do something",
            "pledge_amount": 500,
            "save_card": False,
        },
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 201
    data = resp.json()
    pledge_id = data["pledge_id"]
    assert pledge_id is not None
    assert data["client_secret"] == "seti_test_secret"

    # Verify pledge.save_card is False
    async with test_session_maker() as session:
        pledge = (
            await session.execute(
                select(Pledge).where(Pledge.id == uuid.UUID(pledge_id))
            )
        ).scalar_one()
        assert pledge.save_card is False


# --- Review phase tests ---


async def test_review_to_collecting_too_early(authed_client, test_session_maker):
    """Cannot transition review -> collecting before 1 week."""
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "review"})

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "collecting"}
    )
    assert resp.status_code == 400
    assert "Review period not over" in resp.json()["detail"]


async def test_review_to_collecting_after_week(authed_client, test_session_maker):
    """Can transition review -> collecting after 1 week."""
    task = await create_task(authed_client)
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "underway"})
    await authed_client.patch(f"/api/tasks/{task['id']}", json={"status": "review"})
    await backdate_review(test_session_maker, task["id"])

    resp = await authed_client.patch(
        f"/api/tasks/{task['id']}", json={"status": "collecting"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "collecting"
