import type { AdminPatronListResponse, AdminPatronRead, AdminTaskListResponse, CollectResponse, TaskRead, UpdateRead } from "./types";

export async function fetchAdminTasks(): Promise<AdminTaskListResponse> {
  const res = await fetch("/api/admin/tasks");
  if (!res.ok) throw new Error(`Failed to fetch admin tasks: ${res.status}`);
  return res.json();
}

export async function patchTask(
  taskId: string,
  payload: { status?: string; evidence?: string },
): Promise<TaskRead> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
  return res.json();
}

export async function postUpdate(
  taskId: string,
  body: string,
): Promise<UpdateRead> {
  const res = await fetch(`/api/tasks/${taskId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`Failed to post update: ${res.status}`);
  return res.json();
}

export async function collectPayments(
  taskId: string,
): Promise<CollectResponse> {
  const res = await fetch(`/api/tasks/${taskId}/collect`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to collect payments: ${res.status}`);
  return res.json();
}

export async function fetchAdminPatrons(): Promise<AdminPatronListResponse> {
  const res = await fetch("/api/admin/patrons");
  if (!res.ok) throw new Error(`Failed to fetch patrons: ${res.status}`);
  return res.json();
}

export async function banPatron(patronId: string): Promise<AdminPatronRead> {
  const res = await fetch(`/api/admin/patrons/${patronId}/ban`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to ban patron: ${res.status}`);
  return res.json();
}

export async function unbanPatron(patronId: string): Promise<AdminPatronRead> {
  const res = await fetch(`/api/admin/patrons/${patronId}/unban`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to unban patron: ${res.status}`);
  return res.json();
}
