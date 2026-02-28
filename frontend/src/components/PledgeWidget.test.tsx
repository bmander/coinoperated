import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import PledgeWidget from "./PledgeWidget";
import { createPledge, deletePledge, getMyPledge, updatePledge } from "../api/pledges";
import { makeTask } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/pledges");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockConfirmCardSetup = vi.fn();
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: () =>
    Promise.resolve({ confirmCardSetup: mockConfirmCardSetup }),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardSetup: mockConfirmCardSetup }),
  useElements: () => ({ getElement: vi.fn().mockReturnValue({}) }),
}));

const mockCreatePledge = vi.mocked(createPledge);
const mockDeletePledge = vi.mocked(deletePledge);
const mockGetMyPledge = vi.mocked(getMyPledge);
const mockUpdatePledge = vi.mocked(updatePledge);

function renderWidget(
  overrides: Parameters<typeof makeTask>[0] = {},
  onPledge?: () => void,
) {
  return renderWithRouter(
    <PledgeWidget task={makeTask(overrides)} onPledge={onPledge} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMyPledge.mockResolvedValue(null);
  mockUseAuth.mockReturnValue({
    patron: {
      id: "p1",
      email: "a@b.com",
      display_name: null,
      is_admin: false,
      is_banned: false,
      has_payment_method: false,
      default_payment_method: null,
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PledgeWidget", () => {
  // --- Rendering ---

  it("shows Pledge button for open tasks", () => {
    renderWidget({ status: "open" });
    expect(screen.getByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("shows Pledge button for accepted tasks", () => {
    renderWidget({ status: "accepted" });
    expect(screen.getByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("renders nothing for completed tasks", () => {
    const { container } = renderWidget({ status: "completed" });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for collecting tasks", () => {
    const { container } = renderWidget({ status: "collecting" });
    expect(container.innerHTML).toBe("");
  });

  // --- Auth redirect ---

  it("redirects to /signin when not logged in", async () => {
    mockUseAuth.mockReturnValue({
      patron: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    expect(mockNavigate).toHaveBeenCalledWith("/signin");
  });

  // --- Expanding ---

  it("expands to show amount buttons on click", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));

    expect(screen.getByRole("button", { name: "$5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$20" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "..." })).toBeInTheDocument();
  });

  it("does not expand when not logged in", async () => {
    mockUseAuth.mockReturnValue({
      patron: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    expect(screen.queryByRole("button", { name: "$5" })).not.toBeInTheDocument();
  });

  // --- Amount selection ---

  it("highlights selected preset amount", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$10" }));

    expect(screen.getByRole("button", { name: "$10" }).className).toContain(
      "active",
    );
    expect(
      screen.getByRole("button", { name: "$5" }).className,
    ).not.toContain("active");
  });

  it("shows custom input when ... is clicked", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "..." }));

    expect(screen.getByPlaceholderText("$")).toBeInTheDocument();
  });

  // --- Validation ---

  it("shows error when submitting without selecting amount", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    // Submit button should be disabled when no amount selected
    const submitBtn = screen.getByRole("button", { name: "Submit pledge" });
    expect(submitBtn).toBeDisabled();
  });

  it("shows error for custom amount below $1.00", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "..." }));
    await userEvent.type(screen.getByPlaceholderText("$"), "0.50");

    // The submit Pledge button in expanded mode
    await userEvent.click(screen.getByRole("button", { name: "Submit pledge" }));

    expect(screen.getByText("Min $1.00")).toBeInTheDocument();
  });

  // --- Submission with payment modal ---

  it("shows payment modal when no saved payment method", async () => {
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$10" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    await waitFor(() => {
      expect(mockCreatePledge).toHaveBeenCalledWith("abc-123", 1000);
    });

    // Modal should appear
    expect(
      await screen.findByText("Payment Information"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("card-element")).toBeInTheDocument();
  });

  // --- Auto-confirm with saved payment method ---

  it("auto-confirms with saved PM and skips modal", async () => {
    mockUseAuth.mockReturnValue({
      patron: {
        id: "p1",
        email: "a@b.com",
        display_name: null,
        is_admin: false,
        is_banned: false,
        has_payment_method: true,
        default_payment_method: "pm_saved_123",
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });
    mockConfirmCardSetup.mockResolvedValue({ error: null });

    const onPledge = vi.fn();
    renderWidget({}, onPledge);
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$5" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    await waitFor(() => {
      expect(mockConfirmCardSetup).toHaveBeenCalledWith("seti_secret", {
        payment_method: "pm_saved_123",
      });
    });

    // No modal should appear, should show pledged state
    expect(screen.queryByText("Payment Information")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pledged $5" })).toBeInTheDocument();
    expect(onPledge).toHaveBeenCalled();
  });

  it("falls back to modal when saved PM fails", async () => {
    mockUseAuth.mockReturnValue({
      patron: {
        id: "p1",
        email: "a@b.com",
        display_name: null,
        is_admin: false,
        is_banned: false,
        has_payment_method: true,
        default_payment_method: "pm_expired_123",
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });
    mockConfirmCardSetup.mockResolvedValue({
      error: { message: "Card expired" },
    });

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$10" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    // Modal should appear as fallback
    expect(
      await screen.findByText("Payment Information"),
    ).toBeInTheDocument();
  });

  // --- Post-pledge state ---

  it("shows Pledged amount after successful modal confirmation", async () => {
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });
    mockConfirmCardSetup.mockResolvedValue({ error: null });

    const onPledge = vi.fn();
    renderWidget({}, onPledge);

    // Expand and select amount
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$20" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    // Wait for modal to appear
    await screen.findByText("Payment Information");

    // Click Confirm Pledge in the modal
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm Pledge" }),
    );

    // Should show pledged state
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Pledged $20" }),
      ).toBeInTheDocument();
    });
    expect(onPledge).toHaveBeenCalled();
  });

  // --- Modal cancel ---

  it("calls deletePledge when modal is cancelled", async () => {
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });
    mockDeletePledge.mockResolvedValue(undefined);

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$5" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    await screen.findByText("Payment Information");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockDeletePledge).toHaveBeenCalledWith("abc-123");
    expect(
      screen.queryByText("Payment Information"),
    ).not.toBeInTheDocument();
  });

  // --- API error handling ---

  it("shows error when createPledge fails", async () => {
    mockCreatePledge.mockRejectedValue(
      new Error("You already have a pledge on this task"),
    );

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "$5" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    expect(
      await screen.findByText("You already have a pledge on this task"),
    ).toBeInTheDocument();
  });

  // --- Existing pledge ---

  it("shows existing pledge amount and Change button", async () => {
    mockGetMyPledge.mockResolvedValue({
      id: "pledge-1",
      amount: 2500,
      status: "active",
      created_at: "2025-01-15T00:00:00Z",
    });

    renderWidget();

    expect(await screen.findByText("$25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("does not show Change button when no existing pledge", async () => {
    mockGetMyPledge.mockResolvedValue(null);

    renderWidget();

    // Wait for effect to settle
    await waitFor(() => {
      expect(mockGetMyPledge).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("expands when Change is clicked", async () => {
    mockGetMyPledge.mockResolvedValue({
      id: "pledge-1",
      amount: 1000,
      status: "active",
      created_at: "2025-01-15T00:00:00Z",
    });

    renderWidget();

    await userEvent.click(await screen.findByRole("button", { name: "Change" }));

    expect(screen.getByRole("button", { name: "$5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$10" })).toBeInTheDocument();
  });

  it("calls updatePledge instead of createPledge when editing existing pledge", async () => {
    mockGetMyPledge.mockResolvedValue({
      id: "pledge-1",
      amount: 1000,
      status: "active",
      created_at: "2025-01-15T00:00:00Z",
    });
    mockUpdatePledge.mockResolvedValue({
      pledge_id: "pledge-1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });

    renderWidget();

    await userEvent.click(await screen.findByRole("button", { name: "Change" }));
    await userEvent.click(screen.getByRole("button", { name: "$20" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit pledge" }));

    await waitFor(() => {
      expect(mockUpdatePledge).toHaveBeenCalledWith("abc-123", 2000);
    });
    expect(mockCreatePledge).not.toHaveBeenCalled();
  });

  // --- Outside click ---

  it("collapses on outside click", async () => {
    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    expect(screen.getByRole("button", { name: "$5" })).toBeInTheDocument();

    // Click outside
    await userEvent.click(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "$5" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Pledge" }),
    ).toBeInTheDocument();
  });

  // --- Custom amount submission ---

  it("submits custom amount correctly", async () => {
    mockCreatePledge.mockResolvedValue({
      pledge_id: "pl1",
      client_secret: "seti_secret",
      publishable_key: "pk_test",
    });

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));
    await userEvent.click(screen.getByRole("button", { name: "..." }));
    await userEvent.type(screen.getByPlaceholderText("$"), "15.50");
    await userEvent.click(
      screen.getByRole("button", { name: "Submit pledge" }),
    );

    await waitFor(() => {
      expect(mockCreatePledge).toHaveBeenCalledWith("abc-123", 1550);
    });
  });
});
