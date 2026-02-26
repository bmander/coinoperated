import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import Layout from "./Layout";
import { renderWithRouter } from "../test/render";
import { mockAuth } from "../test/auth";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

const mockLogout = vi.fn();

describe("Layout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders Sign In link when not authenticated", () => {
    mockUseAuth.mockReturnValue(mockAuth());
    renderWithRouter(<Layout />);

    expect(screen.getByText("CoinOperatedBrandon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/signin");
  });

  it("renders user info and Sign Out when authenticated", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "test@example.com", display_name: null, is_admin: false },
    }));
    renderWithRouter(<Layout />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
  });

  it("shows display_name when available", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "test@example.com", display_name: "Test User", is_admin: false },
    }));
    renderWithRouter(<Layout />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
  });

  it("calls logout when Sign Out is clicked", async () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "test@example.com", display_name: null, is_admin: false },
      logout: mockLogout,
    }));
    renderWithRouter(<Layout />);

    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("renders child route content via Outlet", () => {
    mockUseAuth.mockReturnValue(mockAuth());
    renderWithRouter(<Layout />, ["/"]);

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("shows Admin link for admin users", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "admin@example.com", display_name: null, is_admin: true },
    }));
    renderWithRouter(<Layout />);

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("does not show Admin link for non-admin users", () => {
    mockUseAuth.mockReturnValue(mockAuth({
      patron: { id: "1", email: "user@example.com", display_name: null, is_admin: false },
    }));
    renderWithRouter(<Layout />);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });
});
