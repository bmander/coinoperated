from unittest.mock import AsyncMock, patch

import pytest

from app.models import NotificationType, PledgeStatus
from tests.conftest import (
    auth_cookies,
    create_email_preference,
    create_patron,
    create_pledge,
    create_task,
)

ALL_TYPES = [nt.value for nt in NotificationType]


@pytest.mark.asyncio
class TestEmailPreferencesEndpoints:
    async def test_get_defaults_all_enabled(self, client, test_session_maker, test_patron):
        resp = await client.get(
            "/api/patron/email-preferences", cookies=auth_cookies(test_patron)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == len(ALL_TYPES)
        for pref in data:
            assert pref["enabled"] is True
            assert pref["notification_type"] in ALL_TYPES

    async def test_requires_auth(self, client):
        resp = await client.get("/api/patron/email-preferences")
        assert resp.status_code == 401

    async def test_update_single_preference(self, client, test_session_maker, test_patron):
        resp = await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": False}},
            cookies=auth_cookies(test_patron),
        )
        assert resp.status_code == 200
        data = resp.json()
        by_type = {p["notification_type"]: p["enabled"] for p in data}
        assert by_type["task_accepted"] is False
        # Others remain enabled
        assert by_type["task_completed"] is True

    async def test_update_multiple_preferences(self, client, test_session_maker, test_patron):
        resp = await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": False, "charge_succeeded": False}},
            cookies=auth_cookies(test_patron),
        )
        assert resp.status_code == 200
        by_type = {p["notification_type"]: p["enabled"] for p in resp.json()}
        assert by_type["task_accepted"] is False
        assert by_type["charge_succeeded"] is False
        assert by_type["task_completed"] is True

    async def test_update_is_idempotent(self, client, test_session_maker, test_patron):
        payload = {"preferences": {"task_declined": False}}
        cookies = auth_cookies(test_patron)
        await client.put("/api/patron/email-preferences", json=payload, cookies=cookies)
        resp = await client.put("/api/patron/email-preferences", json=payload, cookies=cookies)
        assert resp.status_code == 200
        by_type = {p["notification_type"]: p["enabled"] for p in resp.json()}
        assert by_type["task_declined"] is False

    async def test_re_enable_preference(self, client, test_session_maker, test_patron):
        cookies = auth_cookies(test_patron)
        await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": False}},
            cookies=cookies,
        )
        resp = await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": True}},
            cookies=cookies,
        )
        assert resp.status_code == 200
        by_type = {p["notification_type"]: p["enabled"] for p in resp.json()}
        assert by_type["task_accepted"] is True

    async def test_get_reflects_saved_preferences(self, client, test_session_maker, test_patron):
        cookies = auth_cookies(test_patron)
        await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_completed": False}},
            cookies=cookies,
        )
        resp = await client.get("/api/patron/email-preferences", cookies=cookies)
        by_type = {p["notification_type"]: p["enabled"] for p in resp.json()}
        assert by_type["task_completed"] is False
        assert by_type["task_accepted"] is True

    async def test_preferences_are_per_patron(self, client, test_session_maker, test_patron):
        other = await create_patron(test_session_maker, "other_pref@example.com", "cus_other_pref")
        cookies_self = auth_cookies(test_patron)
        cookies_other = auth_cookies(other)

        await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": False}},
            cookies=cookies_self,
        )

        resp = await client.get("/api/patron/email-preferences", cookies=cookies_other)
        by_type = {p["notification_type"]: p["enabled"] for p in resp.json()}
        assert by_type["task_accepted"] is True

    async def test_update_requires_auth(self, client):
        resp = await client.put(
            "/api/patron/email-preferences",
            json={"preferences": {"task_accepted": False}},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestEmailPreferencesRespected:
    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_email_skipped_when_opted_out(
        self, mock_send, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )
        await create_email_preference(
            test_session_maker,
            patron_id=test_patron.id,
            notification_type=NotificationType.task_accepted,
            enabled=False,
        )

        resp = await client.patch(
            f"/api/tasks/{task.id}", json={"status": "underway"}
        )
        assert resp.status_code == 200

        # Notification record should still be created
        notif_resp = await client.get(
            "/api/patron/notifications", cookies=auth_cookies(test_patron)
        )
        data = notif_resp.json()
        assert len(data) == 1
        assert data[0]["event"] == "task_accepted"

        # But email should NOT have been sent
        mock_send.assert_not_called()

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_email_sent_when_opted_in(
        self, mock_send, client, test_session_maker, test_patron
    ):
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )
        await create_email_preference(
            test_session_maker,
            patron_id=test_patron.id,
            notification_type=NotificationType.task_accepted,
            enabled=True,
        )

        resp = await client.patch(
            f"/api/tasks/{task.id}", json={"status": "underway"}
        )
        assert resp.status_code == 200
        mock_send.assert_called_once()

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_email_sent_with_no_preference_row(
        self, mock_send, client, test_session_maker, test_patron
    ):
        """Default behavior: email sent when no preference exists."""
        task = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task.id
        )

        resp = await client.patch(
            f"/api/tasks/{task.id}", json={"status": "underway"}
        )
        assert resp.status_code == 200
        mock_send.assert_called_once()

    @patch("app.notifications.send_email", new_callable=AsyncMock, return_value=True)
    async def test_opt_out_one_type_doesnt_affect_others(
        self, mock_send, client, test_session_maker, test_patron
    ):
        # Opt out of task_accepted only
        await create_email_preference(
            test_session_maker,
            patron_id=test_patron.id,
            notification_type=NotificationType.task_accepted,
            enabled=False,
        )

        # Task 1: trigger task_accepted -> no email
        task1 = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task1.id
        )
        await client.patch(f"/api/tasks/{task1.id}", json={"status": "underway"})
        mock_send.assert_not_called()

        # Task 2: trigger task_declined -> should send email
        task2 = await create_task(test_session_maker)
        await create_pledge(
            test_session_maker, patron_id=test_patron.id, task_id=task2.id,
            setup_intent="si_test_2",
        )
        await client.patch(f"/api/tasks/{task2.id}", json={"status": "declined"})
        mock_send.assert_called_once()
