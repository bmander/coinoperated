export type TaskStatus = "open" | "accepted" | "collecting" | "completed" | "declined";

export interface TaskRead {
  id: string;
  title: string;
  description: string;
  criteria: string | null;
  submitted_by: string | null;
  status: TaskStatus;
  evidence: string | null;
  pledge_count: number;
  pledge_total: number;
  collected_total: number;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
}

export interface TaskListResponse {
  items: TaskRead[];
  total: number;
  offset: number;
  limit: number;
}
