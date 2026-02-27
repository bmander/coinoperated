import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import PledgePage from "./PledgePage";
import { getTask } from "../api/tasks";
import { getMyPledge, createPledge } from "../api/pledges";
import { fetchPaymentMethods } from "../api/patron";
import { makeTaskDetail } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/tasks");
vi.mock("../api/pledges");
vi.mock("../api/patron");

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
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

const mockGetTask = vi.mocked(getTask);
const mockGetMyPledge = vi.mocked(getMyPledge);
const mockCreatePledge = vi.mocked(createPledge);
const mockFetchPaymentMethods = vi.mocked(fetchPaymentMethods);

function renderPledgePage(taskId = "abc-123") {
  // Mock fetch for /api/config/stripe
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    json: () => Promise.resolve({ publishable_key: "pk_test_123" }),
  } as Response);

  return renderWithRouter(
    <Routes>
      <Route path="/tasks/:taskId/pledge" element={<PledgePage />} />
    </Routes>,
    [`/tasks/${taskId}/pledge`],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    patron: { id: "p1", email: "a@b.com", display_name: null, is_admin: false },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  mockGetMyPledge.mockResolvedValue(null);
  mockFetchPaymentMethods.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PledgePage", () => {
  it("renders preset amount buttons including $1", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    renderPledgePage();

    expect(await screen.findByRole("button", { name: "$1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$25" })).toBeInTheDocument();
  });

  it("defaults to $1 preset selected", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    renderPledgePage();

    const btn = await screen.findByRole("button", { name: "$1" });
    expect(btn.className).toContain("active");
  });

  it("shows minimum pledge error for custom amount below $1.00", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    renderPledgePage();

    await screen.findByText("Make a Pledge");

    // Click Custom then submit without entering an amount to trigger validation
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));

    expect(await screen.findByText("Minimum pledge is $1.00")).toBeInTheDocument();
  });

  it("accepts custom amount of exactly $1.00", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    mockCreatePledge.mockResolvedValue({ pledge_id: "pl1", client_secret: "secret", publishable_key: "pk_test" });
    mockGetElement.mockReturnValue({});
    mockConfirmCardSetup.mockResolvedValue({ error: null });
    renderPledgePage();

    await screen.findByText("Make a Pledge");

    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "1.00");
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));

    await waitFor(() => {
      expect(mockCreatePledge).toHaveBeenCalledWith("abc-123", 100, { saveCard: true });
    });
  });

  it("shows custom amount input with $1.00 minimum and placeholder", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    renderPledgePage();

    await screen.findByText("Make a Pledge");
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));

    const input = screen.getByLabelText("Amount (USD)");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("placeholder", "1.00");
  });

  it("shows saved payment methods as radio options", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
      { id: "pm_2", brand: "mastercard", last4: "5555", exp_month: 6, exp_year: 2027 },
    ]);
    renderPledgePage();

    expect(await screen.findByText(/Visa \.\.\.\.4242/)).toBeInTheDocument();
    expect(screen.getByText(/Mastercard \.\.\.\.5555/)).toBeInTheDocument();
    expect(screen.getByText("New card")).toBeInTheDocument();
  });

  it("hides card element when saved PM is selected", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);
    renderPledgePage();

    // With saved PM selected (default), card element should not be visible
    await screen.findByText(/Visa \.\.\.\.4242/);
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
  });

  it("shows card element when 'New card' is selected", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);
    renderPledgePage();

    await screen.findByText("New card");
    await userEvent.click(screen.getByLabelText("New card"));

    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.getByLabelText("Save this card for future pledges")).toBeInTheDocument();
  });

  it("submits with saved PM, no Stripe confirmation needed", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "open" }));
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_saved", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);
    mockCreatePledge.mockResolvedValue({ pledge_id: "pl1", client_secret: null, publishable_key: "pk_test" });
    renderPledgePage();

    await screen.findByText(/Visa \.\.\.\.4242/);
    await userEvent.click(screen.getByRole("button", { name: "Pledge" }));

    await waitFor(() => {
      expect(mockCreatePledge).toHaveBeenCalledWith("abc-123", 100, { paymentMethodId: "pm_saved" });
    });
    expect(mockConfirmCardSetup).not.toHaveBeenCalled();
    expect(await screen.findByText("Pledge confirmed!")).toBeInTheDocument();
  });
});
