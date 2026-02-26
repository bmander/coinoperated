import { screen } from "@testing-library/react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import RequireAuth from "./RequireAuth";
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
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders outlet when authenticated", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "a@b.com", display_name: null, is_admin: false },
    }));
    renderWithRoutes("/protected");

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to /signin when not authenticated", () => {
    mockUseAuth.mockReturnValue(mockAuth());
    renderWithRoutes("/protected");

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue(mockAuth({ loading: true }));
    renderWithRoutes("/protected");

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign In Page")).not.toBeInTheDocument();
  });
});
