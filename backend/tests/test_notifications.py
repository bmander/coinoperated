import uuid
from unittest.mock import AsyncMock, patch

from app.auth import create_jwt
from app.config import settings
from app.models import Notification, NotificationType, PledgeStatus, Task, TaskStatus
from app.notifications import (
    _charge_failed_email,
    _charge_succeeded_email,
    _task_accepted_email,
    _task_completed_email,
    _task_declined_email,
)

from tests.conftest import create_patron, create_pledge, create_task


# --- Helpers ---


def auth_cookies(patron_id: uuid.UUID) -> dict:
    token = create_jwt(patron_id, settings.secret_key, settings.session_expiry_days)
    return {"session": token}


# --- Template unit tests ---


async def test_task_accepted_template(test_session_maker):
    task = await create_task(test_session_maker, title="Fix login bug")
    subject, body = _task_accepted_email(task)
    assert "Fix login bug" in subject
    assert "accepted" in subject.lower()
    assert "Fix login bug" in body


async def test_task_completed_template(test_session_maker):
    task = await create_task(test_session_maker, title="Add dark mode")
    subject, body = _task_completed_email(task, 1500)
    assert "Add dark mode" in subject
    assert "completed" in subject.lower()
    assert "$15.00" in body


async def test_task_declined_template(test_session_maker):
    task = await create_task(test_session_maker, title="Rewrite in Rust")
    subject, body = _task_declined_email(task)
    assert "Rewrite in Rust" in subject
    assert "declined" in subject.lower()
    assert "released" in body.lower()


async def test_charge_succeeded_template(test_session_maker):
    task = await create_task(test_session_maker, title="Fix search")
    subject, body = _charge_succeeded_email(task, 2000)
    assert "$20.00" in subject
    assert "Fix search" in subject
    assert "$20.00" in body


async def test_charge_failed_template(test_session_maker):
    task = await create_task(test_session_maker, title="Improve perf")
    subject, body = _charge_failed_email(task, 500)
    assert "$5.00" in subject
    assert "Improve perf" in subject
    assert "unable" in body.lower()


# --- Integration: task status change creates notifications ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_accepted_creates_notification(mock_send, client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_a@example.com", "cus_notif_a")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "accepted"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.task_accepted,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert notifications[0].patron_id == patron.id
        assert "accepted" in notifications[0].subject.lower()

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_collecting_creates_completed_notification(mock_send, client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_b@example.com", "cus_notif_b")
    task = await create_task(test_session_maker, status=TaskStatus.accepted)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "collecting"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.task_completed,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert "$10.00" in notifications[0].body  # 1000 cents = $10.00

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_declined_creates_notification(mock_send, client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_c@example.com", "cus_notif_c")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "declined"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.task_declined,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_multiple_pledgers_get_notifications(mock_send, client, test_session_maker):
    patron1 = await create_patron(test_session_maker, "multi_a@example.com", "cus_multi_a")
    patron2 = await create_patron(test_session_maker, "multi_b@example.com", "cus_multi_b")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron1.id, task_id=task.id)
    await create_pledge(
        test_session_maker, patron_id=patron2.id, task_id=task.id,
        setup_intent="si_test_2", amount=2000,
    )

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "accepted"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(Notification.task_id == task.id)
        )
        notifications = result.scalars().all()
        assert len(notifications) == 2

    assert mock_send.call_count == 2


# --- Email failure doesn't break the API ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=False)
async def test_email_failure_does_not_break_api(mock_send, client, test_session_maker):
    patron = await create_patron(test_session_maker, "fail@example.com", "cus_fail")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "accepted"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    mock_send.assert_called_once()


# --- No pledgers = no notifications ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_no_pledgers_no_notifications(mock_send, client, test_session_maker):
    await create_task(test_session_maker)
    task = await create_task(test_session_maker)

    resp = await client.patch(
        f"/api/tasks/{task.id}", json={"status": "accepted"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(Notification.task_id == task.id)
        )
        assert result.scalars().all() == []

    mock_send.assert_not_called()


# --- Webhook charge notification tests ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_succeeded_creates_notification(
    mock_construct, mock_send, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "charge_ok@example.com", "cus_charge_ok")
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        payment_intent="pi_succeeded_123",
    )

    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_succeeded_123"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.charge_succeeded,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert notifications[0].patron_id == patron.id

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_failed_creates_notification(
    mock_construct, mock_send, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "charge_fail@example.com", "cus_charge_fail")
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        payment_intent="pi_failed_123",
    )

    mock_construct.return_value = {
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_failed_123"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.charge_failed,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert notifications[0].patron_id == patron.id

    mock_send.assert_called_once()


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_succeeded_unknown_pledge_ignored(
    mock_construct, client, test_session_maker
):
    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_unknown"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
