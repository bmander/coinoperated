import asyncio
import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.email import send_email
from app.models import (
    EmailPreference,
    Notification,
    NotificationType,
    Patron,
    Pledge,
    PledgeStatus,
    Task,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PendingEmail:
    notification_id: uuid.UUID
    to: str
    subject: str
    body: str


def _format_dollars(cents: int) -> str:
    return f"${cents / 100:.2f}"


# --- Templates ---

# Each returns (subject, body). Fan-out templates take (task, pledge) so the
# loop can pass per-pledger context; charge templates take (task, amount).


def _task_accepted_email(task: Task, pledge: Pledge) -> tuple[str, str]:
    subject = f"Task accepted: {task.title}"
    body = (
        f"Good news! The task \"{task.title}\" has been accepted.\n"
        f"The maintainer is now working on it. Your pledge is secured.\n"
        f"We'll notify you when it's completed and your payment is collected."
    )
    return subject, body


def _task_review_started_email(task: Task, pledge: Pledge) -> tuple[str, str]:
    dollars = _format_dollars(pledge.amount)
    subject = f"Review period started: {task.title}"
    body = (
        f"The task \"{task.title}\" has been marked as complete.\n"
        f"You have 1 week to review the work before your pledge of {dollars} is collected.\n"
        f"If you're not satisfied, you can revoke your pledge during this period."
    )
    return subject, body


def _task_completed_email(task: Task, pledge: Pledge) -> tuple[str, str]:
    dollars = _format_dollars(pledge.amount)
    subject = f"Task completed: {task.title}"
    body = (
        f"The task \"{task.title}\" has been completed!\n"
        f"Your pledge of {dollars} will now be collected.\n"
        f"Thank you for supporting this work."
    )
    return subject, body


def _task_declined_email(task: Task, pledge: Pledge) -> tuple[str, str]:
    subject = f"Task declined: {task.title}"
    body = (
        f"The task \"{task.title}\" has been declined.\n"
        f"Your pledge has been released and you will not be charged."
    )
    return subject, body


def _charge_succeeded_email(task: Task, amount: int) -> tuple[str, str]:
    dollars = _format_dollars(amount)
    subject = f"Payment collected: {dollars} for {task.title}"
    body = (
        f"Your payment of {dollars} for \"{task.title}\" was successfully collected.\n"
        f"Thank you for your support!"
    )
    return subject, body


def _charge_failed_email(task: Task, amount: int) -> tuple[str, str]:
    dollars = _format_dollars(amount)
    subject = f"Payment failed: {dollars} for {task.title}"
    body = (
        f"We were unable to collect your payment of {dollars} for \"{task.title}\".\n"
        f"Please update your payment method or contact support."
    )
    return subject, body


# --- Helpers ---


async def _get_active_pledgers(db: AsyncSession, task_id) -> list[Pledge]:
    result = await db.execute(
        select(Pledge)
        .where(Pledge.task_id == task_id, Pledge.status == PledgeStatus.active)
        .options(selectinload(Pledge.patron))
    )
    return list(result.scalars().all())


async def _load_disabled_patron_ids(
    db: AsyncSession, patron_ids: list, ntype: NotificationType
) -> set:
    """Batch-load patrons who have opted out of a notification type."""
    if not patron_ids:
        return set()
    result = await db.execute(
        select(EmailPreference.patron_id).where(
            EmailPreference.patron_id.in_(patron_ids),
            EmailPreference.notification_type == ntype,
            EmailPreference.enabled == False,  # noqa: E712
        )
    )
    return set(result.scalars().all())


async def _persist_notification(
    db: AsyncSession,
    patron: Patron,
    task: Task,
    ntype: NotificationType,
    subject: str,
    body: str,
    *,
    email_disabled: bool = False,
) -> PendingEmail | None:
    """Persist a notification record. Returns a PendingEmail if an email should be sent."""
    notification = Notification(
        patron_id=patron.id,
        task_id=task.id,
        type=ntype,
        subject=subject,
        body=body,
    )
    db.add(notification)
    await db.flush()
    if email_disabled:
        return None
    return PendingEmail(
        notification_id=notification.id,
        to=patron.email,
        subject=subject,
        body=body,
    )


async def _notify_pledgers(
    db: AsyncSession,
    task: Task,
    ntype: NotificationType,
    template_fn: Callable[[Task, Pledge], tuple[str, str]],
) -> list[PendingEmail]:
    pledges = await _get_active_pledgers(db, task.id)
    disabled = await _load_disabled_patron_ids(
        db, [p.patron.id for p in pledges], ntype
    )
    pending: list[PendingEmail] = []
    for pledge in pledges:
        subject, body = template_fn(task, pledge)
        email = await _persist_notification(
            db, pledge.patron, task, ntype, subject, body,
            email_disabled=pledge.patron.id in disabled,
        )
        if email is not None:
            pending.append(email)
    return pending


async def send_pending_emails(
    pending: list[PendingEmail], session_factory
) -> None:
    """Send queued emails concurrently and update notification records.

    Designed to run as a background task after the HTTP response is sent.
    """
    if not pending:
        return

    async def _send_one(item: PendingEmail) -> tuple[uuid.UUID, bool]:
        success = await send_email(item.to, item.subject, item.body)
        return item.notification_id, success

    results = await asyncio.gather(*(_send_one(item) for item in pending))

    async with session_factory() as db:
        for notification_id, success in results:
            notification = await db.get(Notification, notification_id)
            if notification is not None:
                notification.email_sent = success
        await db.commit()


# --- Public API ---


async def notify_task_accepted(db: AsyncSession, task: Task) -> list[PendingEmail]:
    return await _notify_pledgers(db, task, NotificationType.task_accepted, _task_accepted_email)


async def notify_task_review_started(db: AsyncSession, task: Task) -> list[PendingEmail]:
    return await _notify_pledgers(db, task, NotificationType.task_review_started, _task_review_started_email)


async def notify_task_completed(db: AsyncSession, task: Task) -> list[PendingEmail]:
    return await _notify_pledgers(db, task, NotificationType.task_completed, _task_completed_email)


async def notify_task_declined(db: AsyncSession, task: Task) -> list[PendingEmail]:
    return await _notify_pledgers(db, task, NotificationType.task_declined, _task_declined_email)


async def notify_charge_succeeded(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> list[PendingEmail]:
    ntype = NotificationType.charge_succeeded
    disabled = await _load_disabled_patron_ids(db, [patron.id], ntype)
    subject, body = _charge_succeeded_email(task, amount)
    email = await _persist_notification(
        db, patron, task, ntype, subject, body,
        email_disabled=patron.id in disabled,
    )
    return [email] if email is not None else []


async def notify_charge_failed(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> list[PendingEmail]:
    ntype = NotificationType.charge_failed
    disabled = await _load_disabled_patron_ids(db, [patron.id], ntype)
    subject, body = _charge_failed_email(task, amount)
    email = await _persist_notification(
        db, patron, task, ntype, subject, body,
        email_disabled=patron.id in disabled,
    )
    return [email] if email is not None else []
