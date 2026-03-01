export type TaskStatus = "proposed" | "underway" | "collecting" | "completed" | "declined";

export interface PatronPublicRead {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface TaskRead {
  id: string;
  title: string;
  description: string;
  criteria: string | null;
  submitted_by: string | null;
  submitted_by_patron: PatronPublicRead | null;
  status: TaskStatus;
  evidence: string | null;
  pledge_count: number;
  pledge_total: number;
  collected_total: number;
  created_at: string;
  underway_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
}

export interface UpdateRead {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
}

export interface TaskDetailRead extends TaskRead {
  updates: UpdateRead[];
}

export interface TaskListResponse {
  items: TaskRead[];
  total: number;
  offset: number;
  limit: number;
}

export type PledgeStatus = "pending" | "active" | "collected" | "failed" | "released";

export interface AdminPledgeRead {
  id: string;
  patron_email: string;
  amount: number;
  status: PledgeStatus;
  created_at: string;
}

export interface AdminTaskRead extends TaskRead {
  pledges: AdminPledgeRead[];
}

export interface AdminTaskListResponse {
  items: AdminTaskRead[];
  total: number;
}

export interface PledgeCollectResult {
  pledge_id: string;
  patron_email: string;
  amount: number;
  status: PledgeStatus;
}

export interface CollectResponse {
  collected_count: number;
  failed_count: number;
  collected_total: number;
  pledge_total: number;
  results: PledgeCollectResult[];
}

export interface PatronMe {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  is_banned: boolean;
  has_payment_method: boolean;
  default_payment_method: string | null;
}

export interface PatronProfileRead extends PatronPublicRead {
  submitted_tasks: TaskRead[];
}

export interface AdminPatronRead {
  id: string;
  email: string;
  display_name: string | null;
  is_banned: boolean;
}

export interface AdminPatronListResponse {
  items: AdminPatronRead[];
}

export interface PledgeCreateResponse {
  pledge_id: string;
  client_secret: string | null;
  publishable_key: string;
}

export interface TaskCreateResponse extends TaskRead {
  pledge_id: string | null;
  client_secret: string | null;
  publishable_key: string | null;
}

export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface PledgeMyResponse {
  id: string;
  amount: number;
  status: PledgeStatus;
  created_at: string;
}

export function isLivePledge(pledge: PledgeMyResponse | null): pledge is PledgeMyResponse {
  return pledge !== null && (pledge.status === "active" || pledge.status === "pending");
}

export type NotificationEvent = "task_accepted" | "task_completed" | "task_declined";

export interface PatronPledgeTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface PatronPledgeRead {
  id: string;
  amount: number;
  status: PledgeStatus;
  created_at: string;
  task: PatronPledgeTaskSummary;
}

export interface NotificationRead {
  id: string;
  task_id: string;
  task_title: string;
  event: NotificationEvent;
  message: string;
  created_at: string;
}
