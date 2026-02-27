import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskBoard from "./TaskBoard";
import { listTasks } from "../api/tasks";
import { makeTask, makeResponse } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/tasks");
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ patron: null, loading: false, login: vi.fn(), logout: vi.fn() }),
}));
const mockListTasks = vi.mocked(listTasks);

function renderBoard() {
  return renderWithRouter(<TaskBoard />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TaskBoard", () => {
  it("shows loading state initially", () => {
    mockListTasks.mockReturnValue(new Promise(() => {})); // never resolves
    renderBoard();
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("renders task cards after data loads", async () => {
    mockListTasks.mockResolvedValue(makeResponse([
      makeTask({ id: "1", title: "Fix potholes" }),
      makeTask({ id: "2", title: "Plant trees" }),
    ]));

    renderBoard();
    expect(await screen.findByText("Fix potholes")).toBeInTheDocument();
    expect(screen.getByText("Plant trees")).toBeInTheDocument();
  });

  it("shows empty state when no tasks returned", async () => {
    mockListTasks.mockResolvedValue(makeResponse([]));
    renderBoard();
    expect(await screen.findByText("No tasks found.")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    mockListTasks.mockRejectedValue(new Error("Failed to fetch tasks: 500"));
    renderBoard();
    expect(await screen.findByText("Error: Failed to fetch tasks: 500")).toBeInTheDocument();
  });

  it("sort dropdown triggers new API call", async () => {
    const user = userEvent.setup();
    mockListTasks.mockResolvedValue(makeResponse([]));
    renderBoard();

    // Wait for initial load to settle
    await screen.findByText("No tasks found.");
    const callCountAfterMount = mockListTasks.mock.calls.length;

    // Change sort to "newest"
    const sortSelect = screen.getByRole("combobox", { name: /sort/i });
    await user.selectOptions(sortSelect, "newest");

    await waitFor(() =>
      expect(mockListTasks.mock.calls.length).toBeGreaterThan(callCountAfterMount),
    );
    expect(mockListTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort_by: "created_at", sort_order: "desc" }),
    );
  });

  it("filter dropdown triggers new API call with status", async () => {
    const user = userEvent.setup();
    mockListTasks.mockResolvedValue(makeResponse([]));
    renderBoard();

    // Wait for initial load to settle
    await screen.findByText("No tasks found.");
    const callCountAfterMount = mockListTasks.mock.calls.length;

    const filterSelect = screen.getByRole("combobox", { name: /filter/i });
    await user.selectOptions(filterSelect, "accepted");

    await waitFor(() =>
      expect(mockListTasks.mock.calls.length).toBeGreaterThan(callCountAfterMount),
    );
    expect(mockListTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "accepted" }),
    );
  });
});
