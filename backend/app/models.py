import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

MIN_PLEDGE_CENTS = 100


class Base(DeclarativeBase):
    pass


# --- Enums ---


class TaskStatus(str, enum.Enum):
    open = "open"
    accepted = "accepted"
    collecting = "collecting"
    completed = "completed"
    declined = "declined"


class PledgeStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    collected = "collected"
    failed = "failed"
    released = "released"


LIVE_PLEDGE_STATUSES = [PledgeStatus.active, PledgeStatus.pending]


class NotificationType(str, enum.Enum):
    task_accepted = "task_accepted"
    task_completed = "task_completed"
    task_declined = "task_declined"
    charge_succeeded = "charge_succeeded"
    charge_failed = "charge_failed"


# --- Models ---


class MagicLinkToken(Base):
    __tablename__ = "magic_link_token"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(Text, nullable=False)
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Patron(Base):
    __tablename__ = "patron"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    stripe_customer: Mapped[str] = mapped_column(Text, nullable=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    pledges: Mapped[list["Pledge"]] = relationship(back_populates="patron")
    submitted_tasks: Mapped[list["Task"]] = relationship(back_populates="submitted_by_patron")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="patron")


class Task(Base):
    __tablename__ = "task"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    criteria: Mapped[str | None] = mapped_column(Text)
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patron.id")
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status", native_enum=True),
        nullable=False,
        default=TaskStatus.open,
        server_default="open",
    )
    evidence: Mapped[str | None] = mapped_column(Text)
    pledge_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    pledge_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    collected_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    submitted_by_patron: Mapped[Patron | None] = relationship(back_populates="submitted_tasks")
    pledges: Mapped[list["Pledge"]] = relationship(back_populates="task")
    updates: Mapped[list["Update"]] = relationship(back_populates="task")


class Pledge(Base):
    __tablename__ = "pledge"
    __table_args__ = (
        UniqueConstraint("patron_id", "task_id"),
        CheckConstraint(f"amount >= {MIN_PLEDGE_CENTS}", name="pledge_minimum_amount"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patron_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patron.id"), nullable=False
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("task.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    setup_intent: Mapped[str | None] = mapped_column(Text, nullable=True)
    save_card: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    status: Mapped[PledgeStatus] = mapped_column(
        Enum(PledgeStatus, name="pledge_status", native_enum=True),
        nullable=False,
        default=PledgeStatus.pending,
        server_default="pending",
    )
    payment_intent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patron: Mapped[Patron] = relationship(back_populates="pledges")
    task: Mapped[Task] = relationship(back_populates="pledges")


class Update(Base):
    __tablename__ = "update"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("task.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    task: Mapped[Task] = relationship(back_populates="updates")


class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patron_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patron.id"), nullable=False
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("task.id"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type", native_enum=True),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    patron: Mapped[Patron] = relationship(back_populates="notifications")
    task: Mapped[Task] = relationship()

    @property
    def task_title(self) -> str:
        return self.task.title
