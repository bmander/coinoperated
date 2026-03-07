import uuid

import pytest

from tests.conftest import auth_cookies
from tests.conftest import create_patron, create_task


# --- GET /api/tasks/{task_id}/comments ---


async def test_list_comments_empty(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.get(f"/api/tasks/{task.id}/comments")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_comments_returns_items(client, test_session_maker):
    patron = await create_patron(test_session_maker, "commenter@example.com", "cus_c1")
    task = await create_task(test_session_maker)

    # Create a comment via API
    resp = await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "Great idea!"},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 201

    resp = await client.get(f"/api/tasks/{task.id}/comments")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["body"] == "Great idea!"
    assert data[0]["author"]["id"] == str(patron.id)


async def test_list_comments_task_not_found(client):
    resp = await client.get(f"/api/tasks/{uuid.uuid4()}/comments")
    assert resp.status_code == 404


# --- POST /api/tasks/{task_id}/comments ---


async def test_create_comment_requires_auth(client, test_session_maker):
    task = await create_task(test_session_maker)
    resp = await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "Hello"},
    )
    assert resp.status_code == 401


async def test_create_comment(client, test_session_maker):
    patron = await create_patron(test_session_maker, "commenter2@example.com", "cus_c2")
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "I support this!"},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["body"] == "I support this!"
    assert data["task_id"] == str(task.id)
    assert data["author_id"] == str(patron.id)
    assert "author" in data
    assert data["author"]["id"] == str(patron.id)


async def test_create_comment_empty_body(client, test_session_maker):
    patron = await create_patron(test_session_maker, "commenter3@example.com", "cus_c3")
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": ""},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 422


async def test_create_comment_task_not_found(client, test_session_maker):
    patron = await create_patron(test_session_maker, "commenter4@example.com", "cus_c4")
    resp = await client.post(
        f"/api/tasks/{uuid.uuid4()}/comments",
        json={"body": "Hello"},
        cookies=auth_cookies(patron),
    )
    assert resp.status_code == 404


async def test_comments_included_in_task_detail(client, test_session_maker):
    patron = await create_patron(test_session_maker, "commenter5@example.com", "cus_c5")
    task = await create_task(test_session_maker)

    await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "Comment one"},
        cookies=auth_cookies(patron),
    )
    await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "Comment two"},
        cookies=auth_cookies(patron),
    )

    resp = await client.get(f"/api/tasks/{task.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["comments"]) == 2
    assert data["comments"][0]["body"] == "Comment one"
    assert data["comments"][1]["body"] == "Comment two"


async def test_banned_user_cannot_comment(client, test_session_maker):
    banned = await create_patron(
        test_session_maker, "banned@example.com", "cus_banned", is_banned=True
    )
    task = await create_task(test_session_maker)

    resp = await client.post(
        f"/api/tasks/{task.id}/comments",
        json={"body": "Sneaky comment"},
        cookies=auth_cookies(banned),
    )
    assert resp.status_code == 403
