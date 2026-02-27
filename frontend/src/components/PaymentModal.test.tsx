import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { render } from "@testing-library/react";
import PaymentModal from "./PaymentModal";

const mockConfirmCardSetup = vi.fn();
const mockGetElement = vi.fn();

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => ({ confirmCardSetup: mockConfirmCardSetup }),
  useElements: () => ({ getElement: mockGetElement }),
}));

const stripePromise = Promise.resolve({}) as Promise<any>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetElement.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PaymentModal", () => {
  it("renders modal with title and card element", () => {
    render(
      <PaymentModal
        stripePromise={stripePromise}
        clientSecret="seti_secret"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Payment Information")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your card will only be charged if the task is completed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm Pledge" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("calls onSuccess after successful card setup", async () => {
    mockConfirmCardSetup.mockResolvedValue({ error: null });
    const onSuccess = vi.fn();

    render(
      <PaymentModal
        stripePromise={stripePromise}
        clientSecret="seti_secret"
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm Pledge" }),
    );

    await waitFor(() => {
      expect(mockConfirmCardSetup).toHaveBeenCalledWith("seti_secret", {
        payment_method: { card: {} },
      });
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows error message on Stripe failure", async () => {
    mockConfirmCardSetup.mockResolvedValue({
      error: { message: "Your card was declined." },
    });

    render(
      <PaymentModal
        stripePromise={stripePromise}
        clientSecret="seti_secret"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm Pledge" }),
    );

    expect(
      await screen.findByText("Your card was declined."),
    ).toBeInTheDocument();
  });

  it("shows Processing... while submitting", async () => {
    mockConfirmCardSetup.mockReturnValue(new Promise(() => {})); // never resolves

    render(
      <PaymentModal
        stripePromise={stripePromise}
        clientSecret="seti_secret"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Confirm Pledge" }),
    );

    expect(
      await screen.findByRole("button", { name: "Processing..." }),
    ).toBeDisabled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();

    render(
      <PaymentModal
        stripePromise={stripePromise}
        clientSecret="seti_secret"
        onSuccess={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
