import logging
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.email import send_email
from app.models import (
    Notification,
    NotificationType,
    Patron,
    Pledge,
    PledgeStatus,
    Task,
)

logger = logging.getLogger(__name__)


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
    dollars = f"${pledge.amount / 100:.2f}"
    subject = f"Review period started: {task.title}"
    body = (
        f"The task \"{task.title}\" has been marked as complete.\n"
        f"You have 1 week to review the work before your pledge of {dollars} is collected.\n"
        f"If you're not satisfied, you can revoke your pledge during this period."
    )
    return subject, body


def _task_completed_email(task: Task, pledge: Pledge) -> tuple[str, str]:
    dollars = f"${pledge.amount / 100:.2f}"
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
    dollars = f"${amount / 100:.2f}"
    subject = f"Payment collected: {dollars} for {task.title}"
    body = (
        f"Your payment of {dollars} for \"{task.title}\" was successfully collected.\n"
        f"Thank you for your support!"
    )
    return subject, body


def _charge_failed_email(task: Task, amount: int) -> tuple[str, str]:
    dollars = f"${amount / 100:.2f}"
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


async def _persist_and_send(
    db: AsyncSession,
    patron: Patron,
    task: Task,
    ntype: NotificationType,
    subject: str,
    body: str,
) -> None:
    notification = Notification(
        patron_id=patron.id,
        task_id=task.id,
        type=ntype,
        subject=subject,
        body=body,
    )
    db.add(notification)
    await db.flush()
    notification.email_sent = await send_email(patron.email, subject, body)


async def _notify_pledgers(
    db: AsyncSession,
    task: Task,
    ntype: NotificationType,
    template_fn: Callable[[Task, Pledge], tuple[str, str]],
) -> None:
    pledges = await _get_active_pledgers(db, task.id)
    for pledge in pledges:
        subject, body = template_fn(task, pledge)
        await _persist_and_send(db, pledge.patron, task, ntype, subject, body)


# --- Public API ---


async def notify_task_accepted(db: AsyncSession, task: Task) -> None:
    await _notify_pledgers(db, task, NotificationType.task_accepted, _task_accepted_email)


async def notify_task_review_started(db: AsyncSession, task: Task) -> None:
    await _notify_pledgers(db, task, NotificationType.task_review_started, _task_review_started_email)


async def notify_task_completed(db: AsyncSession, task: Task) -> None:
    await _notify_pledgers(db, task, NotificationType.task_completed, _task_completed_email)


async def notify_task_declined(db: AsyncSession, task: Task) -> None:
    await _notify_pledgers(db, task, NotificationType.task_declined, _task_declined_email)


async def notify_charge_succeeded(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> None:
    subject, body = _charge_succeeded_email(task, amount)
    await _persist_and_send(db, patron, task, NotificationType.charge_succeeded, subject, body)


async def notify_charge_failed(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> None:
    subject, body = _charge_failed_email(task, amount)
    await _persist_and_send(db, patron, task, NotificationType.charge_failed, subject, body)
