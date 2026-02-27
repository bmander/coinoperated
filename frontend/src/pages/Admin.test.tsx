import { screen, waitFor, fireEvent } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Admin from "./Admin";
import type { AdminTaskListResponse } from "../api/types";

vi.mock("../api/admin", () => ({
  fetchAdminTasks: vi.fn(),
  patchTask: vi.fn(),
  postUpdate: vi.fn(),
}));

import { fetchAdminTasks, patchTask, postUpdate } from "../api/admin";
const mockFetchAdminTasks = vi.mocked(fetchAdminTasks);
const mockPatchTask = vi.mocked(patchTask);
const mockPostUpdate = vi.mocked(postUpdate);

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

function makeTask(overrides: Partial<AdminTaskListResponse["items"][0]> = {}) {
  return {
    id: "task-1",
    title: "Test Task",
    description: "A test task",
    criteria: null,
    submitted_by: null,
    status: "open" as const,
    evidence: null,
    pledge_count: 1,
    pledge_total: 5000,
    collected_total: 0,
    created_at: "2025-01-01T00:00:00Z",
    accepted_at: null,
    completed_at: null,
    declined_at: null,
    pledges: [
      {
        id: "pledge-1",
        patron_email: "backer@test.com",
        amount: 5000,
        status: "active" as const,
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("Admin", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockFetchAdminTasks.mockReturnValue(new Promise(() => {}));
    renderAdmin();
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockFetchAdminTasks.mockRejectedValue(new Error("Network error"));
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state", async () => {
    mockFetchAdminTasks.mockResolvedValue({ items: [], total: 0 });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
    });
  });

  it("renders task list with stats", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask()],
      total: 1,
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });
  });

  it("shows accept/decline for open tasks", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask({ status: "open" })],
      total: 1,
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Task"));

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("shows update form and complete for accepted tasks", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask({ status: "accepted" })],
      total: 1,
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Task"));

    expect(screen.getByPlaceholderText(/progress update/i)).toBeInTheDocument();
    expect(screen.getByText("Post Update")).toBeInTheDocument();
    expect(screen.getByText("Mark Complete")).toBeInTheDocument();
    expect(screen.getByText("Abandon")).toBeInTheDocument();
  });

  it("shows collecting indicator", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask({ status: "collecting" })],
      total: 1,
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Task"));

    expect(screen.getByText("Collect Payments")).toBeInTheDocument();
  });

  it("posts an update on accepted task", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask({ status: "accepted" })],
      total: 1,
    });
    mockPostUpdate.mockResolvedValue({
      id: "u1",
      task_id: "task-1",
      body: "Progress!",
      created_at: "2025-01-02T00:00:00Z",
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Task"));

    const textarea = screen.getByPlaceholderText(/progress update/i);
    fireEvent.change(textarea, { target: { value: "Progress!" } });
    fireEvent.click(screen.getByText("Post Update"));

    await waitFor(() => {
      expect(mockPostUpdate).toHaveBeenCalledWith("task-1", "Progress!");
    });
  });

  it("shows pledge breakdown table when expanded", async () => {
    mockFetchAdminTasks.mockResolvedValue({
      items: [makeTask()],
      total: 1,
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText("Test Task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Task"));

    expect(screen.getByText("backer@test.com")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
  });
});
