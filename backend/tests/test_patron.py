import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import stripe

from app.models import NotificationType, PledgeStatus, TaskStatus
from tests.conftest import auth_cookies, create_notification, create_patron, create_pledge, create_task


@pytest.mark.asyncio
class TestPatronPledges:
    async def test_returns_pledges_with_task_info(
        self, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker, title="Fix the road")
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id, amount=2500
        )

        resp = await client.get(
            "/api/patron/pledges", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["amount"] == 2500
        assert data[0]["task"]["title"] == "Fix the road"
        assert data[0]["task"]["id"] == str(task.id)

    async def test_requires_auth(self, client):
        resp = await client.get("/api/patron/pledges")
        assert resp.status_code == 401

    async def test_returns_only_own_pledges(
        self, client, test_session_maker, test_patron
    ):
        other_patron = await create_patron(
            test_session_maker, "other@example.com", "cus_other"
        )
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=other_patron.id, task_id=task.id
        )

        resp = await client.get(
            "/api/patron/pledges", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_pledges_ordered_by_created_at_desc(
        self, client, test_session_maker, test_patron
    ):
        task1 = await create_task(test_session_maker, title="First task")
        task2 = await create_task(test_session_maker, title="Second task")
        await create_pledge(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task1.id,
            setup_intent="si_1",
        )
        # Small delay to ensure different created_at timestamps
        await asyncio.sleep(0.05)
        await create_pledge(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task2.id,
            setup_intent="si_2",
        )

        resp = await client.get(
            "/api/patron/pledges", cookies=auth_cookies(test_patron)
        )
        data = resp.json()
        assert len(data) == 2
        # Most recent pledge first
        assert data[0]["task"]["title"] == "Second task"
        assert data[1]["task"]["title"] == "First task"


@pytest.mark.asyncio
class TestPatronNotifications:
    async def test_returns_notifications(
        self, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker, title="Build a park")
        await create_notification(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            type=NotificationType.task_accepted,
            body='Task "Build a park" has been accepted',
        )

        resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["event"] == "task_accepted"
        assert data[0]["task_title"] == "Build a park"
        assert data[0]["message"] == 'Task "Build a park" has been accepted'

    async def test_requires_auth(self, client):
        resp = await client.get("/api/patron/notifications")
        assert resp.status_code == 401

    async def test_notifications_ordered_by_created_at_desc(
        self, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker, title="Some task")
        await create_notification(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            type=NotificationType.task_accepted,
            body="First notification",
        )
        await asyncio.sleep(0.05)
        await create_notification(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            type=NotificationType.task_completed,
            body="Second notification",
        )

        resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        data = resp.json()
        assert len(data) == 2
        assert data[0]["message"] == "Second notification"
        assert data[1]["message"] == "First notification"


@pytest.mark.asyncio
class TestNotificationCreation:
    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_notification_created_on_task_accepted(
        self, mock_send, admin_client, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker, title="Paint mural", status=TaskStatus.proposed)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )

        resp = await admin_client.patch(
            f"/api/tasks/{task.id}",
            json={"status": "underway"},
        )
        assert resp.status_code == 200

        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        data = notif_resp.json()
        assert len(data) == 1
        assert data[0]["event"] == "task_accepted"

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_notification_created_on_task_declined(
        self, mock_send, admin_client, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker, title="Build bridge")
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )

        await admin_client.patch(f"/api/tasks/{task.id}", json={"status": "declined"})

        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        data = notif_resp.json()
        assert len(data) == 1
        assert data[0]["event"] == "task_declined"

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_notification_created_on_collecting(
        self, mock_send, admin_client, client, test_session_maker, test_patron
    ):
        task = await create_task(
            test_session_maker,
            title="Fix road",
            status=TaskStatus.review,
            review_at=datetime.now(UTC) - timedelta(days=8),
        )
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )

        # Notification fires on collecting transition
        await admin_client.patch(f"/api/tasks/{task.id}", json={"status": "collecting"})

        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        data = notif_resp.json()
        assert len(data) == 1
        assert data[0]["event"] == "task_completed"

    async def test_no_notification_for_released_pledge(
        self, admin_client, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            status=PledgeStatus.released,
        )

        await admin_client.patch(f"/api/tasks/{task.id}", json={"status": "underway"})

        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        assert len(notif_resp.json()) == 0

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_multiple_patrons_each_get_notification(
        self, mock_send, admin_client, client, test_session_maker, test_patron
    ):
        patron2 = await create_patron(
            test_session_maker, "patron2@example.com", "cus_p2"
        )
        task = await create_task(test_session_maker, title="Shared task", status=TaskStatus.proposed)
        await create_pledge(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            setup_intent="si_1",
        )
        await create_pledge(
            test_session_maker,
            patron_id=patron2.id,
            task_id=task.id,
            setup_intent="si_2",
        )

        await admin_client.patch(f"/api/tasks/{task.id}", json={"status": "underway"})

        resp1 = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        resp2 = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(patron2)
        )
        assert len(resp1.json()) == 1
        assert resp1.json()[0]["event"] == "task_accepted"
        assert len(resp2.json()) == 1
        assert resp2.json()[0]["event"] == "task_accepted"

    async def test_no_notification_for_non_status_update(
        self, admin_client, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )

        # Field-only update, no status change
        await admin_client.patch(f"/api/tasks/{task.id}", json={"title": "New title"})

        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        assert len(notif_resp.json()) == 0


@pytest.mark.asyncio
class TestPaymentMethods:
    @patch("app.routers.patron.stripe.PaymentMethod.list")
    async def test_list_payment_methods(
        self, mock_pm_list, client, test_session_maker, test_patron
    ):
        pm = MagicMock()
        pm.id = "pm_test_111"
        pm.card.brand = "visa"
        pm.card.last4 = "4242"
        pm.card.exp_month = 12
        pm.card.exp_year = 2028
        mock_pm_list.return_value = MagicMock(data=[pm])

        resp = await client.get(
            "/api/patron/payment-methods", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "pm_test_111"
        assert data[0]["brand"] == "visa"
        assert data[0]["last4"] == "4242"
        assert data[0]["exp_month"] == 12
        assert data[0]["exp_year"] == 2028
        mock_pm_list.assert_called_once_with(
            customer=test_patron.stripe_customer, type="card"
        )

    @patch("app.routers.patron.stripe.PaymentMethod.list")
    async def test_list_payment_methods_returns_empty_on_invalid_customer(
        self, mock_pm_list, client, test_session_maker, test_patron
    ):
        mock_pm_list.side_effect = stripe.InvalidRequestError(
            "No such customer: 'cus_test'", param="customer"
        )

        resp = await client.get(
            "/api/patron/payment-methods", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_payment_methods_requires_auth(self, client):
        resp = await client.get("/api/patron/payment-methods")
        assert resp.status_code == 401

    @patch("app.routers.patron.stripe.PaymentMethod.detach")
    @patch("app.routers.patron.stripe.PaymentMethod.retrieve")
    async def test_delete_payment_method(
        self, mock_pm_retrieve, mock_pm_detach, client, test_session_maker, test_patron
    ):
        mock_pm = MagicMock()
        mock_pm.customer = test_patron.stripe_customer
        mock_pm_retrieve.return_value = mock_pm

        resp = await client.delete(
            "/api/patron/payment-methods/pm_to_delete",
            cookies=auth_cookies(test_patron),
        )
        assert resp.status_code == 204
        mock_pm_detach.assert_called_once_with("pm_to_delete")

    @patch("app.routers.patron.stripe.PaymentMethod.retrieve")
    async def test_delete_payment_method_in_use(
        self, mock_pm_retrieve, client, test_session_maker, test_patron
    ):
        mock_pm = MagicMock()
        mock_pm.customer = test_patron.stripe_customer
        mock_pm_retrieve.return_value = mock_pm

        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker,
            patron_id=test_patron.id,
            task_id=task.id,
            payment_method="pm_in_use",
            status=PledgeStatus.active,
        )

        resp = await client.delete(
            "/api/patron/payment-methods/pm_in_use",
            cookies=auth_cookies(test_patron),
        )
        assert resp.status_code == 409
        assert "in use" in resp.json()["detail"].lower()
