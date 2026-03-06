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

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function taskCreateResponse(overrides = {}) {
  return { ...makeTask(), pledge_id: null, client_secret: null, publishable_key: null, ...overrides };
}

describe("SubmitTask (admin)", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      patron: { id: "p1", email: "admin@example.com", display_name: null, is_admin: true, is_banned: false },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it("renders form fields", () => {
    renderWithRouter(<SubmitTask />);

    expect(screen.getByText("Submit a Task")).toBeInTheDocument();
    expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description *")).toBeInTheDocument();
    expect(screen.getByLabelText("Delivery Criteria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Task" })).toBeInTheDocument();
  });

  it("does not show pledge or card fields for admin", () => {
    renderWithRouter(<SubmitTask />);

    expect(screen.queryByText("Your Pledge *")).not.toBeInTheDocument();
    expect(screen.queryByText("Card details")).not.toBeInTheDocument();
  });

  it("submits form and redirects to task detail", async () => {
    mockCreateTask.mockResolvedValue(taskCreateResponse({ id: "new-task-id" }));

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
    mockCreateTask.mockResolvedValue(taskCreateResponse());

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

    const previewButtons = screen.getAllByRole("button", { name: "Preview" });
    await userEvent.click(previewButtons[0]);

    expect(screen.getByText("bold text")).toBeInTheDocument();
    expect(screen.queryByLabelText("Description *")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Description *")).toBeInTheDocument();
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

describe("SubmitTask (banned user)", () => {
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
});

describe("SubmitTask (non-admin)", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      patron: { id: "p1", email: "test@example.com", display_name: null, is_admin: false, is_banned: false },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it("shows simple form without pledge fields for non-admin", () => {
    renderWithRouter(<SubmitTask />);

    expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    expect(screen.getByLabelText("Description *")).toBeInTheDocument();
    expect(screen.queryByText("Your Pledge *")).not.toBeInTheDocument();
    expect(screen.queryByText("Card details")).not.toBeInTheDocument();
  });

  it("shows ideation intro text", () => {
    renderWithRouter(<SubmitTask />);

    expect(screen.getByText(/ideation/i)).toBeInTheDocument();
  });

  it("submits task without pledge and redirects", async () => {
    mockCreateTask.mockResolvedValue(taskCreateResponse({ id: "ideation-task-id" }));

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "My idea");
    await userEvent.type(screen.getByLabelText("Description *"), "A great idea");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: "My idea",
        description: "A great idea",
        criteria: undefined,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/ideation-task-id");
  });

  it("shows error on submission failure", async () => {
    mockCreateTask.mockRejectedValue(new Error("Server error"));

    renderWithRouter(<SubmitTask />);

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to submit task. Please try again.")).toBeInTheDocument();
    });
  });
});
