import { API_BASE, fetchJson } from "./client";
import type { CommentRead } from "./types";

export async function createComment(taskId: string, body: string): Promise<CommentRead> {
  return fetchJson(`${API_BASE}/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}
