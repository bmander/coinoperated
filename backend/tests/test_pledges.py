import uuid
from unittest.mock import MagicMock, patch

import stripe as stripe_module

from app.auth import create_jwt
from app.config import settings
from app.models import Pledge, PledgeStatus, Task, TaskStatus
from tests.conftest import create_patron, create_pledge, create_task, mock_setup_intent

# --- Helpers ---


def auth_cookies(patron_id: uuid.UUID) -> dict:
    token = create_jwt(patron_id, settings.secret_key, settings.session_expiry_days)
    return {"session": token}


# --- POST /api/tasks/{task_id}/pledges ---


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_pledge(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron(test_session_maker, "alice@example.com", "cus_alice")
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "pledge_id" in data
    assert data["client_secret"] == "seti_test_secret"
    assert data["publishable_key"] == settings.stripe_publishable_key
    mock_si_create.assert_called_once()


async def test_create_pledge_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.post(f"/api/tasks/{task.id}/pledges", json={"amount": 500})
    assert resp.status_code == 401


async def test_create_pledge_banned_user_gets_403(client, test_session_maker):
    banned = await create_patron(
        test_session_maker, "banned@example.com", "cus_banned", is_banned=True
    )
    task = await create_task(test_session_maker)
    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(banned.id),
    )
    assert resp.status_code == 403


async def test_create_pledge_task_not_found(client, test_session_maker):
    patron = await create_patron(test_session_maker, "bob@example.com", "cus_bob")
    fake_id = uuid.uuid4()
    resp = await client.post(
        f"/api/tasks/{fake_id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_pledge_duplicate_rejected(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron(test_session_maker, "carol@example.com", "cus_carol")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker, patron_id=patron.id, task_id=task.id, status=PledgeStatus.pending
    )

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 400
    assert "already" in resp.json()["detail"].lower()


async def test_create_pledge_minimum_amount(client, test_session_maker):
    patron = await create_patron(test_session_maker, "dan@example.com", "cus_dan")
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 99},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 422


async def test_create_pledge_task_not_pledgeable(client, test_session_maker):
    patron = await create_patron(test_session_maker, "eve@example.com", "cus_eve")
    task = await create_task(test_session_maker, status=TaskStatus.completed)

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 400


# --- GET /api/tasks/{task_id}/pledges/me ---


async def test_get_my_pledge(client, test_session_maker):
    patron = await create_patron(test_session_maker, "fiona@example.com", "cus_fiona")
    task = await create_task(test_session_maker)
    await create_pledge(test_session_maker, patron_id=patron.id, task_id=task.id)

    resp = await client.get(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 1000
    assert data["status"] == "active"


async def test_get_my_pledge_not_found(client, test_session_maker):
    patron = await create_patron(test_session_maker, "george@example.com", "cus_george")
    task = await create_task(test_session_maker)

    resp = await client.get(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


async def test_get_my_pledge_excludes_released(client, test_session_maker):
    patron = await create_patron(test_session_maker, "harry@example.com", "cus_harry")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker, patron_id=patron.id, task_id=task.id, status=PledgeStatus.released
    )

    resp = await client.get(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


# --- PATCH /api/tasks/{task_id}/pledges/me ---


@patch("app.routers.pledges.stripe.SetupIntent.cancel")
@patch("app.routers.pledges.stripe.SetupIntent.create")
async def test_update_pledge(mock_si_create, mock_si_cancel, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent("si_updated", "seti_updated_secret")
    patron = await create_patron(test_session_maker, "iris@example.com", "cus_iris")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_old",
    )

    resp = await client.patch(
        f"/api/tasks/{task.id}/pledges/me",
        json={"amount": 2500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["client_secret"] == "seti_updated_secret"
    mock_si_cancel.assert_called_once_with("si_old")


@patch("app.routers.pledges.stripe.SetupIntent.create")
async def test_update_active_pledge_adjusts_task_total(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent("si_upd2", "seti_upd2_secret")
    patron = await create_patron(test_session_maker, "jack@example.com", "cus_jack")
    task = await create_task(test_session_maker)

    # Manually set task counts as if pledge was active
    async with test_session_maker() as session:
        t = (await session.get(Task, task.id))
        t.pledge_count = 1
        t.pledge_total = 1000
        await session.commit()

    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.active,
    )

    resp = await client.patch(
        f"/api/tasks/{task.id}/pledges/me",
        json={"amount": 2000},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 200

    # Count stays, total adjusts by delta (2000 - 1000 = +1000)
    from app.models import Task as TaskModel
    async with test_session_maker() as session:
        t = await session.get(TaskModel, task.id)
        assert t.pledge_count == 1
        assert t.pledge_total == 2000


# --- DELETE /api/tasks/{task_id}/pledges/me ---


@patch("app.routers.pledges.stripe.SetupIntent.cancel")
async def test_delete_pending_pledge(mock_si_cancel, client, test_session_maker):
    patron = await create_patron(test_session_maker, "kate@example.com", "cus_kate")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_to_cancel",
    )

    resp = await client.delete(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 204
    mock_si_cancel.assert_called_once_with("si_to_cancel")


async def test_delete_active_pledge_decrements_task(client, test_session_maker):
    patron = await create_patron(test_session_maker, "leo@example.com", "cus_leo")
    task = await create_task(test_session_maker)

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        t.pledge_count = 1
        t.pledge_total = 1500
        await session.commit()

    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.active,
        amount=1500,
    )

    resp = await client.delete(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 204

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.pledge_count == 0
        assert t.pledge_total == 0


async def test_delete_pledge_not_found(client, test_session_maker):
    patron = await create_patron(test_session_maker, "mike@example.com", "cus_mike")
    task = await create_task(test_session_maker)

    resp = await client.delete(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


# --- POST /api/webhooks/stripe (setup_intent.succeeded) ---


@patch("app.routers.webhooks.stripe.PaymentMethod.attach")
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_activates_pledge(mock_construct, mock_pm_attach, client, test_session_maker):
    patron = await create_patron(test_session_maker, "nora@example.com", "cus_nora")
    task = await create_task(test_session_maker)
    pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_webhook_test",
    )

    mock_construct.return_value = {
        "type": "setup_intent.succeeded",
        "data": {
            "object": {
                "id": "si_webhook_test",
                "payment_method": "pm_webhook_123",
                "customer": "cus_nora",
            }
        },
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    # Verify pledge is now active with payment method
    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.active
        assert p.payment_method == "pm_webhook_123"

    # Verify task counts incremented
    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.pledge_count == 1
        assert t.pledge_total == pledge.amount

    mock_pm_attach.assert_called_once_with("pm_webhook_123", customer="cus_nora")


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_ignores_unknown_setup_intent(mock_construct, client, test_session_maker):
    mock_construct.return_value = {
        "type": "setup_intent.succeeded",
        "data": {
            "object": {
                "id": "si_unknown",
                "payment_method": "pm_unknown",
                "customer": "cus_unknown",
            }
        },
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_ignores_other_event_types(mock_construct, client, test_session_maker):
    mock_construct.return_value = {
        "type": "charge.refunded",
        "data": {"object": {}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# --- Webhook validation errors ---


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_rejects_invalid_payload(mock_construct, client):
    mock_construct.side_effect = ValueError("Invalid payload")

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"bad_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid payload"


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_rejects_invalid_signature(mock_construct, client):
    mock_construct.side_effect = stripe_module.error.SignatureVerificationError(
        "bad sig", "sig_header"
    )

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "bad_sig"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid signature"


# --- SetupIntent.cancel InvalidRequestError ---


@patch("app.routers.pledges.stripe.SetupIntent.cancel")
@patch("app.routers.pledges.stripe.SetupIntent.create")
async def test_update_pledge_cancel_invalid_request_error_ignored(
    mock_si_create, mock_si_cancel, client, test_session_maker
):
    """SetupIntent.cancel raising InvalidRequestError should be silently ignored."""
    mock_si_create.return_value = mock_setup_intent("si_new", "seti_new_secret")
    mock_si_cancel.side_effect = stripe_module.error.InvalidRequestError(
        "No such setup intent", param=None
    )
    patron = await create_patron(test_session_maker, "pat_cancel@example.com", "cus_cancel")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_already_gone",
    )

    resp = await client.patch(
        f"/api/tasks/{task.id}/pledges/me",
        json={"amount": 2000},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 200
    mock_si_cancel.assert_called_once_with("si_already_gone")


@patch("app.routers.pledges.stripe.SetupIntent.cancel")
async def test_delete_pending_cancel_invalid_request_error_ignored(
    mock_si_cancel, client, test_session_maker
):
    """SetupIntent.cancel raising InvalidRequestError on delete should be silently ignored."""
    mock_si_cancel.side_effect = stripe_module.error.InvalidRequestError(
        "No such setup intent", param=None
    )
    patron = await create_patron(test_session_maker, "pat_del_cancel@example.com", "cus_del_cancel")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_gone",
    )

    resp = await client.delete(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 204
    mock_si_cancel.assert_called_once_with("si_gone")


# --- PATCH/DELETE on released pledge ---


@patch("app.routers.pledges.stripe.SetupIntent.create")
async def test_update_released_pledge_returns_404(mock_si_create, client, test_session_maker):
    patron = await create_patron(test_session_maker, "pat_rel@example.com", "cus_rel")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.released,
    )

    resp = await client.patch(
        f"/api/tasks/{task.id}/pledges/me",
        json={"amount": 2000},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


async def test_delete_released_pledge_returns_404(client, test_session_maker):
    patron = await create_patron(test_session_maker, "pat_rel2@example.com", "cus_rel2")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.released,
    )

    resp = await client.delete(
        f"/api/tasks/{task.id}/pledges/me",
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 404


# --- GET /api/config/stripe ---


async def test_stripe_config_returns_publishable_key(client):
    resp = await client.get("/api/config/stripe")
    assert resp.status_code == 200
    data = resp.json()
    assert "publishable_key" in data
    assert data["publishable_key"] == settings.stripe_publishable_key


# --- Auth required on GET/PATCH/DELETE ---


async def test_get_my_pledge_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.get(f"/api/tasks/{task.id}/pledges/me")
    assert resp.status_code == 401


async def test_update_pledge_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.patch(f"/api/tasks/{task.id}/pledges/me", json={"amount": 1000})
    assert resp.status_code == 401


async def test_delete_pledge_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.delete(f"/api/tasks/{task.id}/pledges/me")
    assert resp.status_code == 401


# --- Pledges allowed on accepted tasks ---


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_pledge_on_accepted_task(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron(test_session_maker, "accepted@example.com", "cus_accepted")
    task = await create_task(test_session_maker, status=TaskStatus.accepted)

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 201


# --- POST /api/webhooks/stripe (payment_intent.succeeded) ---


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_intent_succeeded(mock_construct, client, test_session_maker):
    patron = await create_patron(test_session_maker, "pi_ok@example.com", "cus_pi_ok")
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.active,
        payment_intent="pi_webhook_ok",
    )

    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_webhook_ok"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.collected
        assert p.collected_at is not None


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_intent_succeeded_already_collected(
    mock_construct, client, test_session_maker
):
    """If pledge is already collected, webhook should be a no-op."""
    patron = await create_patron(test_session_maker, "pi_dup@example.com", "cus_pi_dup")
    task = await create_task(test_session_maker, status=TaskStatus.completed)
    pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.collected,
        payment_intent="pi_already_done",
    )

    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_already_done"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.collected


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_intent_succeeded_unknown(mock_construct, client):
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


# --- POST /api/webhooks/stripe (payment_intent.payment_failed) ---


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_intent_failed(mock_construct, client, test_session_maker):
    patron = await create_patron(test_session_maker, "pi_fail@example.com", "cus_pi_fail")
    task = await create_task(
        test_session_maker, status=TaskStatus.completed, collected_total=1000
    )
    pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.active,
        payment_intent="pi_webhook_fail",
        amount=1000,
    )

    mock_construct.return_value = {
        "type": "payment_intent.payment_failed",
        "data": {"object": {"id": "pi_webhook_fail"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.failed

    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.collected_total == 0


@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_payment_intent_failed_unknown(mock_construct, client):
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


# --- Webhook saves default_payment_method on patron ---


@patch("app.routers.webhooks.stripe.PaymentMethod.attach")
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_saves_default_payment_method_on_patron(
    mock_construct, mock_pm_attach, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "save_dpm@example.com", "cus_save_dpm")
    task = await create_task(test_session_maker)
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_save_dpm",
    )

    mock_construct.return_value = {
        "type": "setup_intent.succeeded",
        "data": {
            "object": {
                "id": "si_save_dpm",
                "payment_method": "pm_saved_on_patron",
                "customer": "cus_save_dpm",
            }
        },
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    from app.models import Patron as PatronModel
    async with test_session_maker() as session:
        p = await session.get(PatronModel, patron.id)
        assert p.default_payment_method == "pm_saved_on_patron"


@patch("app.routers.webhooks.stripe.PaymentMethod.attach")
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_handles_already_attached_pm(
    mock_construct, mock_pm_attach, client, test_session_maker
):
    """PaymentMethod.attach raising InvalidRequestError should be silently ignored."""
    mock_pm_attach.side_effect = stripe_module.error.InvalidRequestError(
        "The payment method you provided has already been attached", param=None
    )
    patron = await create_patron(test_session_maker, "already_att@example.com", "cus_already")
    task = await create_task(test_session_maker)
    pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.pending,
        payment_method=None,
        setup_intent="si_already_att",
    )

    mock_construct.return_value = {
        "type": "setup_intent.succeeded",
        "data": {
            "object": {
                "id": "si_already_att",
                "payment_method": "pm_already_att",
                "customer": "cus_already",
            }
        },
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200

    # Pledge should still be activated despite the attach error
    async with test_session_maker() as session:
        p = await session.get(Pledge, pledge.id)
        assert p.status == PledgeStatus.active
        assert p.payment_method == "pm_already_att"

    # Patron should still get default_payment_method set
    from app.models import Patron as PatronModel
    async with test_session_maker() as session:
        pat = await session.get(PatronModel, patron.id)
        assert pat.default_payment_method == "pm_already_att"


# --- Saved payment method pledge creation ---


@patch("app.services.pledges.stripe.PaymentMethod.retrieve")
async def test_create_pledge_with_saved_pm(mock_pm_retrieve, client, test_session_maker):
    patron = await create_patron(test_session_maker, "saved_pm@example.com", "cus_saved")
    task = await create_task(test_session_maker)

    mock_pm = MagicMock()
    mock_pm.customer = "cus_saved"
    mock_pm_retrieve.return_value = mock_pm

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500, "payment_method_id": "pm_existing_123"},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["client_secret"] is None
    assert "pledge_id" in data

    # Verify pledge is active immediately
    async with test_session_maker() as session:
        p = await session.get(Pledge, uuid.UUID(data["pledge_id"]))
        assert p.status == PledgeStatus.active
        assert p.payment_method == "pm_existing_123"
        assert p.setup_intent is None
        assert p.save_card is True

    # Verify task counters incremented
    async with test_session_maker() as session:
        t = await session.get(Task, task.id)
        assert t.pledge_count == 1
        assert t.pledge_total == 500


@patch("app.services.pledges.stripe.PaymentMethod.retrieve")
async def test_create_pledge_with_saved_pm_wrong_customer(mock_pm_retrieve, client, test_session_maker):
    patron = await create_patron(test_session_maker, "wrong_pm@example.com", "cus_wrong")
    task = await create_task(test_session_maker)

    mock_pm = MagicMock()
    mock_pm.customer = "cus_someone_else"
    mock_pm_retrieve.return_value = mock_pm

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500, "payment_method_id": "pm_stolen_123"},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"].lower()


@patch("app.services.pledges.stripe.SetupIntent.create")
async def test_create_pledge_save_card_false(mock_si_create, client, test_session_maker):
    mock_si_create.return_value = mock_setup_intent()
    patron = await create_patron(test_session_maker, "nosave@example.com", "cus_nosave")
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/pledges",
        json={"amount": 500, "save_card": False},
        cookies=auth_cookies(patron.id),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["client_secret"] == "seti_test_secret"

    async with test_session_maker() as session:
        p = await session.get(Pledge, uuid.UUID(data["pledge_id"]))
        assert p.save_card is False


# --- Webhook PM detach for unsaved cards ---


@patch("app.routers.pledges.stripe.PaymentMethod.detach")
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_detaches_unsaved_pm_on_success(
    mock_construct, mock_pm_detach, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "unsaved_ok@example.com", "cus_unsaved_ok")
    task = await create_task(test_session_maker, status=TaskStatus.collecting)
    _pledge = await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task.id,
        status=PledgeStatus.active,
        payment_intent="pi_unsaved_ok",
        payment_method="pm_unsaved_123",
        save_card=False,
    )

    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_unsaved_ok"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    mock_pm_detach.assert_called_once_with("pm_unsaved_123")


@patch("app.routers.pledges.stripe.PaymentMethod.detach")
@patch("app.routers.webhooks.stripe.Webhook.construct_event")
async def test_webhook_skips_detach_when_pm_in_use(
    mock_construct, mock_pm_detach, client, test_session_maker
):
    patron = await create_patron(test_session_maker, "shared_pm@example.com", "cus_shared_pm")
    task1 = await create_task(test_session_maker, title="Task A")
    task2 = await create_task(test_session_maker, title="Task B")

    # First pledge: unsaved, will be collected
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task1.id,
        status=PledgeStatus.active,
        payment_intent="pi_shared_1",
        payment_method="pm_shared_456",
        save_card=False,
        setup_intent="si_shared_1",
    )

    # Second pledge: same PM, still active
    await create_pledge(
        test_session_maker,
        patron_id=patron.id,
        task_id=task2.id,
        status=PledgeStatus.active,
        payment_method="pm_shared_456",
        save_card=False,
        setup_intent="si_shared_2",
    )

    mock_construct.return_value = {
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": "pi_shared_1"}},
    }

    resp = await client.post(
        "/api/webhooks/stripe",
        content=b"raw_body",
        headers={"stripe-signature": "sig_test"},
    )
    assert resp.status_code == 200
    mock_pm_detach.assert_not_called()
