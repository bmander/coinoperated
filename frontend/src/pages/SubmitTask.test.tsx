import { fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import SubmitTask from "./SubmitTask";
import { renderWithRouter } from "../test/render";
import { createTask } from "../api/tasks";
import { fetchPaymentMethods } from "../api/patron";
import { makeTask } from "../test/factories";

vi.mock("../api/tasks");
vi.mock("../api/patron");
const mockCreateTask = vi.mocked(createTask);
const mockFetchPaymentMethods = vi.mocked(fetchPaymentMethods);

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockConfirmCardSetup = vi.fn();
const mockGetElement = vi.fn();

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardSetup: mockConfirmCardSetup }),
  useElements: () => ({ getElement: mockGetElement }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () => Promise.resolve({}),
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

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: () => Promise.resolve({ publishable_key: "pk_test_123" }),
    } as Response);

    mockFetchPaymentMethods.mockResolvedValue([]);
  });

  it("shows loading state while Stripe loads", () => {
    // Override fetch to return a never-resolving promise so stripePromise stays null
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}) as Promise<Response>);

    renderWithRouter(<SubmitTask />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title *")).not.toBeInTheDocument();
  });

  it("shows pledge and card fields for non-admin", async () => {
    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByText("Your Pledge *")).toBeInTheDocument();
    });
    expect(screen.getByText("Card details")).toBeInTheDocument();
    expect(screen.getByTestId("card-element")).toBeInTheDocument();
  });

  it("shows preset pledge amount buttons", async () => {
    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "$1" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "$5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$25" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("submits task with pledge and confirms card", async () => {
    const cardElement = {};
    mockGetElement.mockReturnValue(cardElement);
    mockConfirmCardSetup.mockResolvedValue({ error: null });

    // Mock createTask - need to override the global fetch mock for this call
    mockCreateTask.mockResolvedValue(
      taskCreateResponse({
        id: "pledged-task-id",
        pledge_id: "pledge-123",
        client_secret: "seti_secret_456",
        publishable_key: "pk_test_123",
      }),
    );

    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("Title *"), "My task");
    await userEvent.type(screen.getByLabelText("Description *"), "Needs doing");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: "My task",
        description: "Needs doing",
        criteria: undefined,
        pledge_amount: 100, // default MIN_PLEDGE_CENTS
        save_card: true,
      });
    });

    expect(mockConfirmCardSetup).toHaveBeenCalledWith("seti_secret_456", {
      payment_method: { card: cardElement },
    });
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/pledged-task-id");
  });

  it("shows error when createTask fails", async () => {
    mockGetElement.mockReturnValue({});
    mockCreateTask.mockRejectedValue(new Error("A pledge is required when submitting a task"));

    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByText("A pledge is required when submitting a task")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("validates minimum pledge amount on client side", async () => {
    mockGetElement.mockReturnValue({});

    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    });

    // Switch to custom amount and enter below-minimum value
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "0.50");

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");

    // Use fireEvent.submit to bypass HTML5 constraint validation on the
    // number input (min=1), so we can test the JS-level validation in handleSubmit
    fireEvent.submit(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByText("Minimum pledge is $1.00")).toBeInTheDocument();
    });
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("shows stripe error message on card failure", async () => {
    mockGetElement.mockReturnValue({});
    mockConfirmCardSetup.mockResolvedValue({
      error: { message: "Your card was declined" },
    });

    mockCreateTask.mockResolvedValue(
      taskCreateResponse({
        id: "task-id",
        pledge_id: "pledge-id",
        client_secret: "seti_secret",
        publishable_key: "pk_test",
      }),
    );

    renderWithRouter(<SubmitTask />);

    await waitFor(() => {
      expect(screen.getByLabelText("Title *")).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText("Title *"), "Task");
    await userEvent.type(screen.getByLabelText("Description *"), "Desc");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(screen.getByText("Your card was declined")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows saved PM selector when methods exist", async () => {
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_saved", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);

    renderWithRouter(<SubmitTask />);

    expect(await screen.findByText("…4242")).toBeInTheDocument();
    expect(screen.getByText("New card")).toBeInTheDocument();
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
  });

  it("submits with saved PM and passes payment_method_id", async () => {
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_saved", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);
    mockCreateTask.mockResolvedValue(
      taskCreateResponse({ id: "task-with-saved-pm", client_secret: null }),
    );

    renderWithRouter(<SubmitTask />);

    await screen.findByText("…4242");

    await userEvent.type(screen.getByLabelText("Title *"), "My task");
    await userEvent.type(screen.getByLabelText("Description *"), "Needs doing");
    await userEvent.click(screen.getByRole("button", { name: "Submit Task" }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: "My task",
        description: "Needs doing",
        criteria: undefined,
        pledge_amount: 100,
        payment_method_id: "pm_saved",
      });
    });
    expect(mockConfirmCardSetup).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-with-saved-pm");
  });
});
