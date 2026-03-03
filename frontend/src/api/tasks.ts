import { API_BASE, fetchJson } from "./client";
import type { TaskCreateResponse, TaskDetailRead, TaskListResponse, TaskStatus } from "./types";

export interface ListTasksParams {
  status?: TaskStatus;
  sort_by?: "pledge_total" | "created_at";
  sort_order?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export async function listTasks(params: ListTasksParams = {}): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  const url = `${API_BASE}/tasks${query ? `?${query}` : ""}`;
  return fetchJson(url);
}

export async function getTask(taskId: string): Promise<TaskDetailRead> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`);
  if (res.status === 404) throw new Error("Task not found");
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.status}`);
  return res.json();
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  criteria?: string;
  pledge_amount?: number;
  payment_method_id?: string;
  save_card?: boolean;
}

export async function createTask(payload: CreateTaskPayload): Promise<TaskCreateResponse> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (res.status === 403) throw new Error("Your account has been suspended");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create task: ${res.status}`);
  }
  return res.json();
}
