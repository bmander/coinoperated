import { API_BASE, fetchJson, fetchVoid } from "./client";
import type { AdminPatronListResponse, AdminPatronRead, AdminTaskListResponse, CollectResponse, TaskRead, TaskStatus, UpdateRead } from "./types";

export async function fetchAdminTasks(): Promise<AdminTaskListResponse> {
  return fetchJson(`${API_BASE}/admin/tasks`);
}

export async function patchTask(
  taskId: string,
  payload: { title?: string; description?: string; criteria?: string | null; status?: TaskStatus; evidence?: string },
): Promise<TaskRead> {
  return fetchJson(`${API_BASE}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function postUpdate(
  taskId: string,
  body: string,
): Promise<UpdateRead> {
  return fetchJson(`${API_BASE}/tasks/${taskId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function collectPayments(
  taskId: string,
): Promise<CollectResponse> {
  return fetchJson(`${API_BASE}/tasks/${taskId}/collect`, {
    method: "POST",
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  return fetchVoid(`${API_BASE}/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminPatrons(): Promise<AdminPatronListResponse> {
  return fetchJson(`${API_BASE}/admin/patrons`);
}

export async function banPatron(patronId: string): Promise<AdminPatronRead> {
  return fetchJson(`${API_BASE}/admin/patrons/${patronId}/ban`, {
    method: "POST",
  });
}

export async function unbanPatron(patronId: string): Promise<AdminPatronRead> {
  return fetchJson(`${API_BASE}/admin/patrons/${patronId}/unban`, {
    method: "POST",
  });
}
