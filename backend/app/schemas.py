import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models import MIN_PLEDGE_CENTS, NotificationType, PledgeStatus, TaskStatus


class BaseReadSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Patron ---


class PatronCreate(BaseModel):
    email: str
    display_name: str | None = None
    stripe_customer: str


class PatronRead(BaseReadSchema):
    id: uuid.UUID
    email: str
    display_name: str | None
    stripe_customer: str
    created_at: datetime


class PatronPublicRead(BaseReadSchema):
    id: uuid.UUID
    display_name: str | None
    created_at: datetime


# --- Task ---


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    criteria: str | None = None
    pledge_amount: int | None = Field(default=None, ge=MIN_PLEDGE_CENTS)
    payment_method_id: str | None = None
    save_card: bool = True


class TaskRead(BaseReadSchema):
    id: uuid.UUID
    title: str
    description: str
    criteria: str | None
    submitted_by: uuid.UUID | None
    submitted_by_patron: PatronPublicRead | None = None
    status: TaskStatus
    evidence: str | None
    pledge_count: int
    pledge_total: int
    collected_total: int
    created_at: datetime
    accepted_at: datetime | None
    completed_at: datetime | None
    declined_at: datetime | None


class TaskDetail(TaskRead):
    updates: list["UpdateRead"] = []


class TaskCreateResponse(TaskRead):
    pledge_id: uuid.UUID | None = None
    client_secret: str | None = None
    publishable_key: str | None = None


class TaskListResponse(BaseModel):
    items: list[TaskRead]
    total: int
    offset: int
    limit: int


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    criteria: str | None = None
    status: TaskStatus | None = None
    evidence: str | None = None


# --- Pledge ---


class PledgeCreate(BaseModel):
    patron_id: uuid.UUID
    task_id: uuid.UUID
    amount: int = Field(ge=MIN_PLEDGE_CENTS)
    payment_method: str
    setup_intent: str


class PledgeRead(BaseReadSchema):
    id: uuid.UUID
    patron_id: uuid.UUID
    task_id: uuid.UUID
    amount: int
    payment_method: str | None
    setup_intent: str | None
    status: PledgeStatus
    payment_intent: str | None
    created_at: datetime
    collected_at: datetime | None


class PledgeCreateRequest(BaseModel):
    amount: int = Field(ge=MIN_PLEDGE_CENTS)
    payment_method_id: str | None = None
    save_card: bool = True


class PledgeCreateResponse(BaseModel):
    pledge_id: uuid.UUID
    client_secret: str | None = None
    publishable_key: str


class SavedPaymentMethodRead(BaseModel):
    id: str
    brand: str
    last4: str
    exp_month: int
    exp_year: int


class PledgeMyResponse(BaseReadSchema):
    id: uuid.UUID
    amount: int
    status: PledgeStatus
    created_at: datetime


class PledgeUpdateRequest(BaseModel):
    amount: int = Field(ge=MIN_PLEDGE_CENTS)


# --- Patron Dashboard ---


class PatronPledgeTaskSummary(BaseReadSchema):
    id: uuid.UUID
    title: str
    status: TaskStatus


class PatronPledgeRead(BaseReadSchema):
    id: uuid.UUID
    amount: int
    status: PledgeStatus
    created_at: datetime
    task: PatronPledgeTaskSummary


class PatronNotificationRead(BaseReadSchema):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    event: NotificationType = Field(validation_alias="type")
    message: str = Field(validation_alias="body")
    created_at: datetime


class PledgeUpdateResponse(BaseModel):
    pledge_id: uuid.UUID
    client_secret: str | None = None
    publishable_key: str


# --- Update ---


class AdminPledgeRead(BaseReadSchema):
    id: uuid.UUID
    patron_email: str
    amount: int
    status: PledgeStatus
    created_at: datetime


class AdminTaskRead(TaskRead):
    pledges: list[AdminPledgeRead] = []


class AdminTaskListResponse(BaseModel):
    items: list[AdminTaskRead]
    total: int


class PledgeCollectResult(BaseModel):
    pledge_id: uuid.UUID
    patron_email: str
    amount: int
    status: PledgeStatus


class CollectResponse(BaseModel):
    collected_count: int
    failed_count: int
    collected_total: int
    pledge_total: int
    results: list[PledgeCollectResult]


class UpdateCreate(BaseModel):
    task_id: uuid.UUID
    body: str


class UpdateRead(BaseReadSchema):
    id: uuid.UUID
    task_id: uuid.UUID
    body: str
    created_at: datetime


# --- Auth ---


class LoginRequest(BaseModel):
    email: str


class PatronMe(BaseReadSchema):
    id: uuid.UUID
    email: str
    display_name: str | None
    is_admin: bool
    is_banned: bool
    default_payment_method: str | None

    @computed_field
    @property
    def has_payment_method(self) -> bool:
        return self.default_payment_method is not None


class PatronProfileRead(PatronPublicRead):
    submitted_tasks: list["TaskRead"] = []


class AdminPatronRead(BaseReadSchema):
    id: uuid.UUID
    email: str
    display_name: str | None
    is_banned: bool


class AdminPatronListResponse(BaseModel):
    items: list[AdminPatronRead]


# --- Notification ---


class NotificationRead(BaseReadSchema):
    id: uuid.UUID
    patron_id: uuid.UUID
    task_id: uuid.UUID
    type: NotificationType
    subject: str
    body: str
    email_sent: bool
    created_at: datetime
