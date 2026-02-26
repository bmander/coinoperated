import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/auth", () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from "../api/auth";
const mockFetchMe = vi.mocked(authApi.fetchMe);
const mockLogin = vi.mocked(authApi.login);
const mockLogout = vi.mocked(authApi.logout);

function TestConsumer() {
  const { patron, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="patron">{patron ? patron.email : "none"}</span>
      <button onClick={() => login("test@example.com")}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state then resolves with patron", async () => {
    mockFetchMe.mockResolvedValue({
      id: "1",
      email: "user@example.com",
      display_name: null,
      is_admin: false,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Initially loading
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("patron").textContent).toBe("user@example.com");
  });

  it("resolves with no patron when not authenticated", async () => {
    mockFetchMe.mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("patron").textContent).toBe("none");
  });

  it("calls login API", async () => {
    mockFetchMe.mockResolvedValue(null);
    mockLogin.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(mockLogin).toHaveBeenCalledWith("test@example.com");
  });

  it("calls logout API and clears patron", async () => {
    mockFetchMe.mockResolvedValue({
      id: "1",
      email: "user@example.com",
      display_name: null,
      is_admin: false,
    });
    mockLogout.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("patron").textContent).toBe("user@example.com");
    });

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(mockLogout).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTestId("patron").textContent).toBe("none");
    });
  });
});
