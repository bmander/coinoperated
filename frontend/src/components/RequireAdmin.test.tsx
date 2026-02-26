import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import RequireAdmin from "./RequireAdmin";
import { mockAuth } from "../test/auth";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

function renderWithRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<div>Admin Content</div>} />
        </Route>
        <Route path="/signin" element={<div>Sign In Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders outlet when user is admin", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "admin@test.com", display_name: null, is_admin: true },
    }));
    renderWithRoutes("/admin");

    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("redirects to / when user is not admin", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "user@test.com", display_name: null, is_admin: false },
    }));
    renderWithRoutes("/admin");

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("redirects to /signin when not authenticated", () => {
    mockUseAuth.mockReturnValue(mockAuth());
    renderWithRoutes("/admin");

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue(mockAuth({ loading: true }));
    renderWithRoutes("/admin");

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign In Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });
});
