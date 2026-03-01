from dataclasses import dataclass

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Patron, Pledge, PledgeStatus, Task


class PaymentMethodOwnershipError(ValueError):
    """The payment method does not belong to the expected customer."""


def verify_pm_ownership(payment_method_id: str, stripe_customer: str) -> None:
    """Raise if the payment method doesn't belong to the customer."""
    pm = stripe.PaymentMethod.retrieve(payment_method_id)
    if pm.customer != stripe_customer:
        raise PaymentMethodOwnershipError("Payment method does not belong to you")


@dataclass
class PledgeResult:
    pledge: Pledge
    client_secret: str | None


async def create_pledge_for_task(
    db: AsyncSession,
    *,
    patron: Patron,
    task: Task,
    amount: int,
    payment_method_id: str | None,
    save_card: bool,
) -> PledgeResult:
    """Create a pledge for a task, reusing a released row if one exists.

    Handles payment-method verification (saved card) or SetupIntent creation
    (new card), and updates task counters for saved-card pledges.

    Does NOT commit — the caller controls the transaction boundary.
    """
    # Reuse released pledge row if one exists (unique constraint on patron_id+task_id)
    pledge = (
        await db.execute(
            select(Pledge).where(
                Pledge.patron_id == patron.id,
                Pledge.task_id == task.id,
                Pledge.status == PledgeStatus.released,
            )
        )
    ).scalar_one_or_none()
    if pledge is None:
        pledge = Pledge(patron_id=patron.id, task_id=task.id)
        db.add(pledge)

    pledge.amount = amount

    if payment_method_id:
        verify_pm_ownership(payment_method_id, patron.stripe_customer)
        pledge.setup_intent = None
        pledge.status = PledgeStatus.active
        pledge.payment_method = payment_method_id
        pledge.save_card = True

        task.pledge_count += 1
        task.pledge_total += amount

        await db.flush()
        return PledgeResult(pledge=pledge, client_secret=None)

    si = stripe.SetupIntent.create(
        customer=patron.stripe_customer,
        metadata={
            "pledge_task_id": str(task.id),
            "pledge_patron_id": str(patron.id),
        },
    )
    pledge.setup_intent = si.id
    pledge.status = PledgeStatus.pending
    pledge.payment_method = None
    pledge.save_card = save_card

    await db.flush()
    return PledgeResult(pledge=pledge, client_secret=si.client_secret)
