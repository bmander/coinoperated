import { screen, waitFor, act } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import SignIn from "./SignIn";
import { renderWithRouter } from "../test/render";
import { mockAuth } from "../test/auth";

const mockLogin = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

describe("SignIn", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(mockAuth({ login: mockLogin }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders email form", () => {
    renderWithRouter(<SignIn />, ["/signin"]);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send sign-in link" })).toBeInTheDocument();
  });

  it("shows check-email message after successful submit", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderWithRouter(<SignIn />, ["/signin"]);

    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(mockLogin).toHaveBeenCalledWith("test@example.com");
  });

  it("disables re-send button during cooldown then re-enables", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLogin.mockResolvedValue(undefined);
    renderWithRouter(<SignIn />, ["/signin"]);

    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    // Button should be disabled right after submit
    expect(screen.getByRole("button", { name: "Email sent" })).toBeDisabled();

    // Advance past cooldown
    act(() => { vi.advanceTimersByTime(30_000); });

    // Button should now be enabled
    expect(screen.getByRole("button", { name: "Re-send email" })).toBeEnabled();

    mockLogin.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Re-send email" }));
    expect(mockLogin).toHaveBeenCalledWith("test@example.com");

    vi.useRealTimers();
  });

  it("shows error message on login failure", async () => {
    mockLogin.mockRejectedValue(new Error("fail"));
    renderWithRouter(<SignIn />, ["/signin"]);

    await userEvent.type(screen.getByLabelText("Email address"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    });
  });

  it("shows invalid_token error from URL", () => {
    renderWithRouter(<SignIn />, ["/signin?error=invalid_token"]);

    expect(screen.getByText("This sign-in link is invalid or has already been used.")).toBeInTheDocument();
  });

  it("shows expired_token error from URL", () => {
    renderWithRouter(<SignIn />, ["/signin?error=expired_token"]);

    expect(screen.getByText("This sign-in link has expired. Please request a new one.")).toBeInTheDocument();
  });

  it("redirects to / when already signed in", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "test@example.com", display_name: null, is_admin: false },
    }));
    renderWithRouter(<SignIn />, ["/signin"]);

    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });
});
