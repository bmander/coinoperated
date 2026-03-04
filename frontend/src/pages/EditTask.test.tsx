import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import EditTask from "./EditTask";
import { getTask } from "../api/tasks";
import { patchTask } from "../api/admin";
import { makeTaskDetail } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/tasks");
vi.mock("../api/admin");

const mockGetTask = vi.mocked(getTask);
const mockPatchTask = vi.mocked(patchTask);

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderEditTask(taskId = "abc-123") {
  return renderWithRouter(
    <Routes>
      <Route path="/tasks/:taskId/edit" element={<EditTask />} />
    </Routes>,
    [`/tasks/${taskId}/edit`],
  );
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("EditTask", () => {
  it("shows loading state initially", () => {
    mockGetTask.mockReturnValue(new Promise(() => {}));
    renderEditTask();
    expect(screen.getByText("Loading task...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockGetTask.mockRejectedValue(new Error("Failed to fetch task: 500"));
    renderEditTask();
    expect(await screen.findByText("Error: Failed to fetch task: 500")).toBeInTheDocument();
  });

  it("pre-populates form with task data", async () => {
    mockGetTask.mockResolvedValue(
      makeTaskDetail({ title: "Original title", description: "Original desc", criteria: "Must pass" }),
    );
    renderEditTask();

    expect(await screen.findByDisplayValue("Original title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original desc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Must pass")).toBeInTheDocument();
  });

  it("shows Save Changes button", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail());
    renderEditTask();
    expect(await screen.findByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("shows back link to task detail", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ id: "task-xyz" }));
    renderEditTask("task-xyz");
    const backLink = await screen.findByText(/Back to task/);
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/tasks/task-xyz");
  });

  it("calls patchTask and navigates on submit", async () => {
    mockGetTask.mockResolvedValue(
      makeTaskDetail({ id: "task-456", title: "Old title", description: "Old desc", criteria: null }),
    );
    mockPatchTask.mockResolvedValue({} as any);

    renderEditTask("task-456");

    const titleInput = await screen.findByDisplayValue("Old title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "New title");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockPatchTask).toHaveBeenCalledWith("task-456", {
        title: "New title",
        description: "Old desc",
        criteria: null,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-456");
  });

  it("shows error on submission failure", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail());
    mockPatchTask.mockRejectedValue(new Error("Server error"));

    renderEditTask();

    await screen.findByDisplayValue("Fix the bridge");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to submit task. Please try again.")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows Saving... while submitting", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail());
    mockPatchTask.mockReturnValue(new Promise(() => {})); // never resolves

    renderEditTask();

    await screen.findByDisplayValue("Fix the bridge");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });
  });
});
