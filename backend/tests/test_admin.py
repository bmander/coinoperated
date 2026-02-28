import uuid
from unittest.mock import MagicMock, patch

import stripe as stripe_module
from sqlalchemy import select

from app.auth import create_jwt
from app.config import settings
from app.models import Notification, Patron, Pledge, PledgeStatus, Task, TaskStatus, Update
from tests.conftest import create_notification, create_patron, create_pledge, create_task

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
    _admin, token = await _make_admin(test_session_maker)
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


# --- POST /api/tasks/{task_id}/collect ---


def _mock_payment_intent(pi_id="pi_test_123"):
    pi = MagicMock()
    pi.id = pi_id
    return pi


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_charges_active_pledges(mock_pi_create, client, test_session_maker):
    mock_pi_create.return_value = _mock_payment_intent("pi_collected")
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=2, pledge_total=3000
    )
    backer1 = await create_patron(test_session_maker, "b1@example.com", "cus_b1")
    backer2 = await create_patron(test_session_maker, "b2@example.com", "cus_b2")
    await create_pledge(
        test_session_maker, patron_id=backer1.id, task_id=task.id, amount=1000
    )
    await create_pledge(
        test_session_maker, patron_id=backer2.id, task_id=task.id, amount=2000
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_count"] == 2
    assert data["failed_count"] == 0
    assert data["collected_total"] == 3000
    assert data["pledge_total"] == 3000
    assert len(data["results"]) == 2

    # Verify task moved to completed
    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.status == TaskStatus.completed
        assert t.collected_total == 3000
        assert t.completed_at is not None

    # Verify pledges updated
    async with test_session_maker() as session:
        for backer_id in [backer1.id, backer2.id]:
            p = (
                await session.execute(
                    select(Pledge).where(
                        Pledge.patron_id == backer_id, Pledge.task_id == task.id
                    )
                )
            ).scalar_one()
            assert p.status == PledgeStatus.collected
            assert p.payment_intent == "pi_collected"
            assert p.collected_at is not None


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_handles_card_errors(mock_pi_create, client, test_session_maker):
    mock_pi_create.side_effect = stripe_module.error.CardError(
        "Your card was declined.", param=None, code="card_declined"
    )
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=1, pledge_total=1000
    )
    backer = await create_patron(test_session_maker, "fail@example.com", "cus_fail")
    await create_pledge(
        test_session_maker, patron_id=backer.id, task_id=task.id, amount=1000
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_count"] == 0
    assert data["failed_count"] == 1
    assert data["collected_total"] == 0

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.status == TaskStatus.completed
        assert t.collected_total == 0


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_mixed_success_and_failure(mock_pi_create, client, test_session_maker):
    call_count = 0

    def side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_payment_intent("pi_ok")
        raise stripe_module.error.CardError("declined", param=None, code="card_declined")

    mock_pi_create.side_effect = side_effect
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=2, pledge_total=3000
    )
    backer1 = await create_patron(test_session_maker, "ok@example.com", "cus_ok")
    backer2 = await create_patron(test_session_maker, "bad@example.com", "cus_bad")
    await create_pledge(
        test_session_maker, patron_id=backer1.id, task_id=task.id, amount=1000
    )
    await create_pledge(
        test_session_maker, patron_id=backer2.id, task_id=task.id, amount=2000
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_count"] == 1
    assert data["failed_count"] == 1
    assert data["collected_total"] == 1000


async def test_collect_rejects_non_collecting_task(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(test_session_maker, status=TaskStatus.accepted)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 400
    assert "collecting" in resp.json()["detail"].lower()


async def test_collect_requires_admin(client, test_session_maker):
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    resp = await client.post(f"/api/tasks/{task.id}/collect")
    assert resp.status_code == 401


async def test_collect_rejects_non_admin(client, test_session_maker):
    patron = await create_patron(test_session_maker, "user@example.com", "cus_user")
    token = create_jwt(patron.id, settings.secret_key, 30)
    task = await create_task(test_session_maker, status=TaskStatus.collecting)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )
    assert resp.status_code == 403


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_idempotent_no_double_charge(mock_pi_create, client, test_session_maker):
    """Calling collect twice should not double-charge already-processed pledges."""
    mock_pi_create.return_value = _mock_payment_intent("pi_first")
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=1, pledge_total=1000
    )
    backer = await create_patron(test_session_maker, "idem@example.com", "cus_idem")
    await create_pledge(
        test_session_maker, patron_id=backer.id, task_id=task.id, amount=1000
    )

    # First collect
    with patch("app.dependencies.settings", _admin_settings()):
        resp1 = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )
    assert resp1.status_code == 200
    assert resp1.json()["collected_count"] == 1

    # Reset task to collecting to simulate re-call (task is completed after first collect)
    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        t.status = TaskStatus.collecting
        await session.commit()

    # Second collect - should not create new PaymentIntents
    mock_pi_create.reset_mock()
    with patch("app.dependencies.settings", _admin_settings()):
        resp2 = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["collected_count"] == 1
    assert data["collected_total"] == 1000
    # PaymentIntent.create should NOT have been called again
    mock_pi_create.assert_not_called()

    # Task should still transition to completed
    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.status == TaskStatus.completed


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_handles_invalid_request_error(mock_pi_create, client, test_session_maker):
    """InvalidRequestError (e.g. expired payment method) should mark pledge as failed."""
    mock_pi_create.side_effect = stripe_module.error.InvalidRequestError(
        "No such payment method: pm_expired", param="payment_method"
    )
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=1, pledge_total=1500
    )
    backer = await create_patron(test_session_maker, "expired@example.com", "cus_expired")
    await create_pledge(
        test_session_maker, patron_id=backer.id, task_id=task.id, amount=1500
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_count"] == 0
    assert data["failed_count"] == 1
    assert data["collected_total"] == 0
    assert data["results"][0]["status"] == "failed"

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.status == TaskStatus.completed
        assert t.collected_total == 0


@patch("app.routers.admin.stripe.PaymentIntent.create")
async def test_collect_no_active_pledges(mock_pi_create, client, test_session_maker):
    """Collecting on a task with no active pledges should complete with zeros."""
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(
        test_session_maker, status=TaskStatus.collecting, pledge_count=0, pledge_total=0
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/tasks/{task.id}/collect", cookies={"session": token}
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_count"] == 0
    assert data["failed_count"] == 0
    assert data["collected_total"] == 0

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.status == TaskStatus.completed


# --- DELETE /api/tasks/{task_id} ---


async def test_delete_task_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.delete(f"/api/tasks/{task.id}")
    assert resp.status_code == 401


async def test_delete_task_rejects_non_admin(client, test_session_maker):
    patron = await create_patron(test_session_maker, "user@example.com", "cus_user")
    token = create_jwt(patron.id, settings.secret_key, 30)
    task = await create_task(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.delete(
            f"/api/tasks/{task.id}", cookies={"session": token}
        )
    assert resp.status_code == 403


async def test_delete_task_succeeds(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.delete(
            f"/api/tasks/{task.id}", cookies={"session": token}
        )

    assert resp.status_code == 204
    async with test_session_maker() as session:
        assert await session.get(Task, task.id) is None


async def test_delete_task_cascades_related_records(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    task = await create_task(test_session_maker, status=TaskStatus.accepted)
    backer = await create_patron(test_session_maker, "backer@example.com", "cus_backer")
    pledge = await create_pledge(
        test_session_maker, patron_id=backer.id, task_id=task.id, amount=1000
    )
    notification = await create_notification(
        test_session_maker, patron_id=backer.id, task_id=task.id
    )
    async with test_session_maker() as session:
        update = Update(task_id=task.id, body="progress")
        session.add(update)
        await session.commit()
        await session.refresh(update)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.delete(
            f"/api/tasks/{task.id}", cookies={"session": token}
        )

    assert resp.status_code == 204
    async with test_session_maker() as session:
        assert await session.get(Task, task.id) is None
        assert await session.get(Pledge, pledge.id) is None
        assert await session.get(Notification, notification.id) is None
        assert await session.get(Update, update.id) is None


async def test_delete_task_not_found(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    fake_id = uuid.uuid4()
    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.delete(
            f"/api/tasks/{fake_id}", cookies={"session": token}
        )
    assert resp.status_code == 404


# --- GET /api/admin/patrons ---


async def test_list_patrons_requires_admin(client):
    resp = await client.get("/api/admin/patrons")
    assert resp.status_code == 401


async def test_list_patrons_returns_all(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    await create_patron(test_session_maker, "user@example.com", "cus_user")

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.get("/api/admin/patrons", cookies={"session": token})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    emails = {p["email"] for p in data["items"]}
    assert ADMIN_EMAIL in emails
    assert "user@example.com" in emails


# --- POST /api/admin/patrons/{id}/ban ---


async def test_ban_patron(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    user = await create_patron(test_session_maker, "bad@example.com", "cus_bad")

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{user.id}/ban", cookies={"session": token}
        )

    assert resp.status_code == 200
    assert resp.json()["is_banned"] is True

    async with test_session_maker() as session:
        p = await session.get(Patron, user.id)
        assert p.is_banned is True


async def test_ban_patron_not_found(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{uuid.uuid4()}/ban", cookies={"session": token}
        )
    assert resp.status_code == 404


async def test_ban_requires_admin(client, test_session_maker):
    user = await create_patron(test_session_maker, "user@example.com", "cus_user")
    token = create_jwt(user.id, settings.secret_key, 30)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{user.id}/ban", cookies={"session": token}
        )
    assert resp.status_code == 403


async def test_ban_already_banned_is_idempotent(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    user = await create_patron(
        test_session_maker, "already@example.com", "cus_already", is_banned=True
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{user.id}/ban", cookies={"session": token}
        )

    assert resp.status_code == 200
    assert resp.json()["is_banned"] is True


# --- POST /api/admin/patrons/{id}/unban ---


async def test_unban_patron(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)
    user = await create_patron(
        test_session_maker, "banned@example.com", "cus_banned", is_banned=True
    )

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{user.id}/unban", cookies={"session": token}
        )

    assert resp.status_code == 200
    assert resp.json()["is_banned"] is False

    async with test_session_maker() as session:
        p = await session.get(Patron, user.id)
        assert p.is_banned is False


async def test_unban_requires_admin(client, test_session_maker):
    user = await create_patron(
        test_session_maker, "user@example.com", "cus_user", is_banned=True
    )
    token = create_jwt(user.id, settings.secret_key, 30)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{user.id}/unban", cookies={"session": token}
        )
    assert resp.status_code == 403


async def test_unban_patron_not_found(client, test_session_maker):
    _admin, token = await _make_admin(test_session_maker)

    with patch("app.dependencies.settings", _admin_settings()):
        resp = await client.post(
            f"/api/admin/patrons/{uuid.uuid4()}/unban", cookies={"session": token}
        )
    assert resp.status_code == 404
