import type { TaskRead, TaskDetailRead, TaskListResponse, UpdateRead, PatronPledgeRead, NotificationRead, PatronProfileRead } from "../api/types";

export function makeTask(overrides: Partial<TaskRead> = {}): TaskRead {
  return {
    id: "abc-123",
    title: "Fix the bridge",
    description: "The bridge is broken",
    criteria: null,
    submitted_by: null,
    submitted_by_patron: null,
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

export function makeTaskDetail(overrides: Partial<TaskDetailRead> = {}): TaskDetailRead {
  return {
    ...makeTask(overrides),
    updates: [],
    ...overrides,
  };
}

export function makeUpdate(overrides: Partial<UpdateRead> = {}): UpdateRead {
  return {
    id: "upd-1",
    task_id: "abc-123",
    body: "Made some progress",
    created_at: "2025-02-01T00:00:00Z",
    ...overrides,
  };
}

export function makeResponse(items: TaskRead[] = []): TaskListResponse {
  return { items, total: items.length, offset: 0, limit: 20 };
}

export function makePatronPledge(overrides: Partial<PatronPledgeRead> = {}): PatronPledgeRead {
  return {
    id: "pledge-1",
    amount: 2500,
    status: "active",
    created_at: "2025-01-15T00:00:00Z",
    task: {
      id: "abc-123",
      title: "Fix the bridge",
      status: "open",
    },
    ...overrides,
  };
}

export function makePatronProfile(overrides: Partial<PatronProfileRead> = {}): PatronProfileRead {
  return {
    id: "patron-1",
    display_name: "Jane Doe",
    created_at: "2025-01-01T00:00:00Z",
    submitted_tasks: [],
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<NotificationRead> = {}): NotificationRead {
  return {
    id: "notif-1",
    task_id: "abc-123",
    task_title: "Fix the bridge",
    event: "task_accepted",
    message: 'Task "Fix the bridge" has been accepted',
    created_at: "2025-02-01T00:00:00Z",
    ...overrides,
  };
}
