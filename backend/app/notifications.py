import logging

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


def _task_accepted_email(task: Task) -> tuple[str, str]:
    subject = f"Task accepted: {task.title}"
    body = (
        f"Good news! The task \"{task.title}\" has been accepted.\n"
        f"The maintainer is now working on it. Your pledge is secured.\n"
        f"We'll notify you when it's completed and your payment is collected."
    )
    return subject, body


def _task_completed_email(task: Task, amount: int) -> tuple[str, str]:
    dollars = f"${amount / 100:.2f}"
    subject = f"Task completed: {task.title}"
    body = (
        f"The task \"{task.title}\" has been completed!\n"
        f"Your pledge of {dollars} will now be collected.\n"
        f"Thank you for supporting this work."
    )
    return subject, body


def _task_declined_email(task: Task) -> tuple[str, str]:
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


async def _send_and_record(
    patron_email: str, subject: str, body: str, notification: Notification
) -> None:
    ok = await send_email(patron_email, subject, body)
    notification.email_sent = ok


def _create_notification(
    db: AsyncSession,
    patron: Patron,
    task: Task,
    ntype: NotificationType,
    subject: str,
    body: str,
) -> Notification:
    notification = Notification(
        patron_id=patron.id,
        task_id=task.id,
        type=ntype,
        subject=subject,
        body=body,
    )
    db.add(notification)
    return notification


# --- Public API ---


async def notify_task_accepted(db: AsyncSession, task: Task) -> None:
    pledges = await _get_active_pledgers(db, task.id)
    for pledge in pledges:
        subject, body = _task_accepted_email(task)
        notification = _create_notification(
            db, pledge.patron, task, NotificationType.task_accepted, subject, body
        )
        await db.flush()
        await _send_and_record(pledge.patron.email, subject, body, notification)


async def notify_task_completed(db: AsyncSession, task: Task) -> None:
    pledges = await _get_active_pledgers(db, task.id)
    for pledge in pledges:
        subject, body = _task_completed_email(task, pledge.amount)
        notification = _create_notification(
            db, pledge.patron, task, NotificationType.task_completed, subject, body
        )
        await db.flush()
        await _send_and_record(pledge.patron.email, subject, body, notification)


async def notify_task_declined(db: AsyncSession, task: Task) -> None:
    pledges = await _get_active_pledgers(db, task.id)
    for pledge in pledges:
        subject, body = _task_declined_email(task)
        notification = _create_notification(
            db, pledge.patron, task, NotificationType.task_declined, subject, body
        )
        await db.flush()
        await _send_and_record(pledge.patron.email, subject, body, notification)


async def notify_charge_succeeded(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> None:
    subject, body = _charge_succeeded_email(task, amount)
    notification = _create_notification(
        db, patron, task, NotificationType.charge_succeeded, subject, body
    )
    await db.flush()
    await _send_and_record(patron.email, subject, body, notification)


async def notify_charge_failed(
    db: AsyncSession, patron: Patron, task: Task, amount: int
) -> None:
    subject, body = _charge_failed_email(task, amount)
    notification = _create_notification(
        db, patron, task, NotificationType.charge_failed, subject, body
    )
    await db.flush()
    await _send_and_record(patron.email, subject, body, notification)
