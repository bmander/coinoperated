import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy import select, update as sa_update

from app.auth import create_jwt
from app.config import settings
from app.models import Notification, NotificationType, Pledge, PledgeStatus, Task as TaskModel, TaskStatus
from app.notifications import (
    PendingEmail,
    _charge_failed_email,
    _charge_succeeded_email,
    _task_accepted_email,
    _task_completed_email,
    _task_declined_email,
    _task_review_started_email,
    send_pending_emails,
)
from tests.conftest import create_patron, create_pledge, create_notification, create_task

# --- Helpers ---


def auth_cookies(patron_id: uuid.UUID) -> dict:
    token = create_jwt(patron_id, settings.secret_key, settings.session_expiry_days)
    return {"session": token}


# --- Template unit tests ---


async def test_task_accepted_template(test_session_maker):
    patron = await create_patron(test_session_maker, "tmpl_a@example.com", "cus_tmpl_a")
    task = await create_task(test_session_maker, title="Fix login bug")
    pledge = await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)
    subject, body = _task_accepted_email(task, pledge)
    assert "Fix login bug" in subject
    assert "accepted" in subject.lower()
    assert "Fix login bug" in body


async def test_task_completed_template(test_session_maker):
    patron = await create_patron(test_session_maker, "tmpl_b@example.com", "cus_tmpl_b")
    task = await create_task(test_session_maker, title="Add dark mode")
    pledge = await create_pledge(
        test_session_maker, patron_id=patron.id, task_id=task.id, amount=1500
    )
    subject, body = _task_completed_email(task, pledge)
    assert "Add dark mode" in subject
    assert "completed" in subject.lower()
    assert "$15.00" in body


async def test_task_declined_template(test_session_maker):
    patron = await create_patron(test_session_maker, "tmpl_c@example.com", "cus_tmpl_c")
    task = await create_task(test_session_maker, title="Rewrite in Rust")
    pledge = await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)
    subject, body = _task_declined_email(task, pledge)
    assert "Rewrite in Rust" in subject
    assert "declined" in subject.lower()
    assert "released" in body.lower()


async def test_task_review_started_template(test_session_maker):
    patron = await create_patron(test_session_maker, "tmpl_rev@example.com", "cus_tmpl_rev")
    task = await create_task(test_session_maker, title="Improve search")
    pledge = await create_pledge(
        test_session_maker, patron_id=patron.id, task_id=task.id, amount=2000
    )
    subject, body = _task_review_started_email(task, pledge)
    assert "Improve search" in subject
    assert "review" in subject.lower()
    assert "$20.00" in body
    assert "1 week" in body
    assert "revoke" in body.lower()


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
async def test_task_accepted_creates_notification(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_a@example.com", "cus_notif_a")
    task = await create_task(test_session_maker, status=TaskStatus.proposed)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
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
        assert notifications[0].email_sent is True

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_review_creates_notification(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_rev@example.com", "cus_notif_rev")
    task = await create_task(test_session_maker, status=TaskStatus.underway)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "review"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.task_review_started,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert "review" in notifications[0].subject.lower()
        assert notifications[0].email_sent is True

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_collecting_creates_completed_notification(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_b@example.com", "cus_notif_b")
    task = await create_task(
        test_session_maker,
        status=TaskStatus.review,
        review_at=datetime.now(UTC) - timedelta(days=8),
    )
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "collecting"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.task_completed,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert "$10.00" in notifications[0].body  # 1000 cents = $10.00
        assert notifications[0].email_sent is True

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_task_declined_creates_notification(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "notif_c@example.com", "cus_notif_c")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "declined"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
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
async def test_multiple_pledgers_get_notifications(mock_send, admin_client, test_session_maker):
    patron1 = await create_patron(test_session_maker, "multi_a@example.com", "cus_multi_a")
    patron2 = await create_patron(test_session_maker, "multi_b@example.com", "cus_multi_b")
    task = await create_task(test_session_maker, status=TaskStatus.proposed)
    await create_pledge(test_session_maker, patron_id=patron1.id, task_id=task.id)
    await create_pledge(
        test_session_maker, patron_id=patron2.id, task_id=task.id,
        setup_intent="si_test_2", amount=2000,
    )

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        result = await session.execute(
            select(Notification).where(Notification.task_id == task.id)
        )
        notifications = result.scalars().all()
        assert len(notifications) == 2
        assert all(n.email_sent is True for n in notifications)

    assert mock_send.call_count == 2


# --- Email failure doesn't break the API ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=False)
async def test_email_failure_does_not_break_api(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "fail@example.com", "cus_fail")
    task = await create_task(test_session_maker, status=TaskStatus.proposed)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "underway"

    # email_sent should be False since send_email returned False
    async with test_session_maker() as session:
        result = await session.execute(
            select(Notification).where(Notification.task_id == task.id)
        )
        notification = result.scalars().first()
        assert notification is not None
        assert notification.email_sent is False

    mock_send.assert_called_once()


# --- No pledgers = no notifications ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_no_pledgers_no_notifications(mock_send, admin_client, test_session_maker):
    await create_task(test_session_maker)
    task = await create_task(test_session_maker, status=TaskStatus.proposed)

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
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
    pledge = await create_pledge(
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
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.charge_succeeded,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert notifications[0].patron_id == patron.id
        assert notifications[0].email_sent is True

    # Verify pledge state updated
    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.collected
        assert p.collected_at is not None

    mock_send.assert_called_once()


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_failed_creates_notification(
    mock_construct, mock_send, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "charge_fail@example.com", "cus_charge_fail")
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    pledge = await create_pledge(
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
        result = await session.execute(
            select(Notification).where(
                Notification.task_id == task.id,
                Notification.type == NotificationType.charge_failed,
            )
        )
        notifications = result.scalars().all()
        assert len(notifications) == 1
        assert notifications[0].patron_id == patron.id
        assert notifications[0].email_sent is True

    # Verify pledge state updated
    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.failed

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


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_failed_unknown_pledge_ignored(
    mock_construct, client, test_session_maker
):
    mock_construct.return_value = {
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_unknown_fail"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


# --- Pending pledgers are excluded from notifications ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_pending_pledger_not_notified(mock_send, admin_client, test_session_maker):
    patron = await create_patron(test_session_maker, "pending@example.com", "cus_pending")
    task = await create_task(test_session_maker, status=TaskStatus.proposed)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
    )

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        result = await session.execute(
            select(Notification).where(Notification.task_id == task.id)
        )
        assert result.scalars().all() == []

    mock_send.assert_not_called()


# --- Background email sending ---


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_send_pending_emails_marks_sent(mock_send, test_session_maker):
    """send_pending_emails sends emails and sets email_sent=True via bulk UPDATE."""
    patron = await create_patron(test_session_maker, "bg_ok@example.com", "cus_bg_ok")
    task = await create_task(test_session_maker)
    n = await create_notification(
        test_session_maker, patron_id=patron.id, task_id=task.id,
        email_sent=False,
    )

    pending = [PendingEmail(n.id, patron.email, n.subject, n.body)]
    await send_pending_emails(pending, test_session_maker)

    async with test_session_maker() as session:
        updated = await session.get(Notification, n.id)
        assert updated.email_sent is True

    mock_send.assert_called_once_with(patron.email, n.subject, n.body)


@patch("app.notifications.send_email", new_callable=AsyncMock)
async def test_send_pending_emails_mixed_success_failure(mock_send, test_session_maker):
    """When some emails succeed and others fail, each notification gets the correct email_sent value."""
    patron1 = await create_patron(test_session_maker, "mix_a@example.com", "cus_mix_a")
    patron2 = await create_patron(test_session_maker, "mix_b@example.com", "cus_mix_b")
    task = await create_task(test_session_maker)
    n1 = await create_notification(
        test_session_maker, patron_id=patron1.id, task_id=task.id,
        subject="Good", email_sent=False,
    )
    n2 = await create_notification(
        test_session_maker, patron_id=patron2.id, task_id=task.id,
        subject="Bad", email_sent=False,
    )

    # First call succeeds, second fails
    mock_send.side_effect = [True, False]
    pending = [
        PendingEmail(n1.id, patron1.email, n1.subject, n1.body),
        PendingEmail(n2.id, patron2.email, n2.subject, n2.body),
    ]
    await send_pending_emails(pending, test_session_maker)

    async with test_session_maker() as session:
        r1 = await session.get(Notification, n1.id)
        r2 = await session.get(Notification, n2.id)
        assert r1.email_sent is True
        assert r2.email_sent is False

    assert mock_send.call_count == 2


@patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
async def test_notification_persisted_before_email_sent(mock_send, admin_client, test_session_maker):
    """The notification row is committed to the DB before send_email runs."""
    patron = await create_patron(test_session_maker, "order@example.com", "cus_order")
    task = await create_task(test_session_maker, status=TaskStatus.proposed)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    notification_exists_at_send_time = []

    async def spy_send_email(to, subject, body):
        # Check the DB from a fresh session while send_email is running
        async with test_session_maker() as session:
            result = await session.execute(
                select(Notification).where(Notification.task_id == task.id)
            )
            notification_exists_at_send_time.append(len(result.scalars().all()))
        return True

    mock_send.side_effect = spy_send_email

    resp = await admin_client.patch(
        f"/api/tasks/{task.id}", json={"status": "underway"}
    )
    assert resp.status_code == 200

    # The notification row existed in the DB when send_email was called
    assert notification_exists_at_send_time == [1]


# --- send_email() direct tests ---


async def test_send_email_dev_noop():
    """When smtp_host is empty, send_email logs and returns True."""
    from app.email import send_email
    result = await send_email("test@example.com", "Test subject", "Test body")
    assert result is True


@patch("app.email.aiosmtplib.send", new_callable=AsyncMock)
async def test_send_email_smtp_path(mock_smtp_send):
    """When smtp_host is set, send_email calls aiosmtplib.send."""
    from app.email import send_email

    with patch.object(settings, "smtp_host", "smtp.example.com"):
        result = await send_email("to@example.com", "Subject", "Body")
        assert result is True
        mock_smtp_send.assert_called_once()
        msg = mock_smtp_send.call_args[0][0]
        assert msg["To"] == "to@example.com"
        assert msg["Subject"] == "Subject"


@patch("app.email.aiosmtplib.send", new_callable=AsyncMock, side_effect=ConnectionError("refused"))
async def test_send_email_exception_returns_false(mock_smtp_send):
    """When SMTP raises, send_email catches and returns False."""
    from app.email import send_email

    with patch.object(settings, "smtp_host", "smtp.example.com"):
        result = await send_email("to@example.com", "Subject", "Body")
        assert result is False


# --- Magic link email ---


@patch("app.auth.send_email", new_callable=AsyncMock, return_value=True)
async def test_magic_link_sends_email_with_link(mock_send, client, test_session_maker):
    resp = await client.post("/api/auth/login", json={"email": "magic@example.com"})
    assert resp.status_code == 200

    mock_send.assert_called_once()
    call_args = mock_send.call_args
    to = call_args[0][0]
    subject = call_args[0][1]
    body = call_args[0][2]
    assert to == "magic@example.com"
    assert "sign" in subject.lower()
    assert "/api/auth/verify?token=" in body
