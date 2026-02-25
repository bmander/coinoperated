import type { TaskRead, TaskListResponse } from "../api/types";

export function makeTask(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: "abc-123",
    title: "Fix the bridge",
    description: "The bridge is broken",
    criteria: null,
    submitted_by: null,
    status: "open",
    evidence: null,
    pledge_count: 5,
    pledge_total: 15000,
    collected_total: 0,
    created_at: "2025-01-01T00:00:00Z",
    accepted_at: null,
    completed_at: null,
    declined_at: null,
    ...overrides,
  };
}

export function makeResponse(items: TaskRead[] = []): TaskListResponse {
  return { items, total: items.length, offset: 0, limit: 20 };
}
