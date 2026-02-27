import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import SubmitTask from "./SubmitTask";
import { renderWithRouter } from "../test/render";
import { createTask } from "../api/tasks";
import { makeTask } from "../test/factories";

vi.mock("../api/tasks");
const mockCreateTask = vi.mocked(createTask);

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    patron: { id: "p1", email: "test@example.com", display_name: null, is_admin: false, is_banned: false },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SubmitTask", () => {
  it("renders form fields", () => {
    renderWithRouter(<SubmitTask />);

    expect(screen.getByText("Submit a Task")).toBeInTheDocument();
    expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description *")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery Criteria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Task" })).toBeInTheDocument();
  });

  it("submits form and redirects to task detail", async () => {
    const task = makeTask({ id: "new-task-id" });
    mockCreateTask.mockResolvedValue(task);

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "Fix the bridge");
    await userEvent.type(screen.getByLabelText("Description *"), "It needs fixing");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: "Fix the bridge",
        description: "It needs fixing",
        criteria: undefined,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/new-task-id");
  });

  it("sends criteria when provided", async () => {
    mockCreateTask.mockResolvedValue(makeTask());

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.type(screen.getByLabelText("Delivery Criteria"), "Ship it");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ criteria: "Ship it" }),
      );
    });
  });

  it("shows error on submission failure", async () => {
    mockCreateTask.mockRejectedValue(new Error("Not authenticated"));

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to submit task. Please try again.")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("toggles markdown preview for description", async () => {
    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Description *"), "**bold text**");

    // Click the first "Preview" button (description field)
    const previewButtons = screen.getAllByRole("button", { name: "Preview" });
    await userEvent.click(previewButtons[0]);

    expect(screen.getByText("bold text")).toBeInTheDocument();
    expect(screen.queryByLabelText("Description *")).not.toBeInTheDocument();

    // Toggle back to edit
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Description *")).toBeInTheDocument();
  });

  it("shows suspension message when user is banned", () => {
    mockUseAuth.mockReturnValue({
      patron: { id: "p1", email: "banned@example.com", display_name: null, is_admin: false, is_banned: true },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderWithRouter(<SubmitTask />);

    expect(screen.getByText(/account has been suspended/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Title *")).not.toBeInTheDocument();
  });

  it("shows button as disabled while submitting", async () => {
    mockCreateTask.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
    });
  });
});
