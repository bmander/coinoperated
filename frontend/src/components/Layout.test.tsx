import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi } from "vitest";
import Layout from "./Layout";
import { renderWithRouter } from "../test/render";

const mockLogout = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    patron: null,
    loading: false,
    login: vi.fn(),
    logout: mockLogout,
  })),
}));

import { useAuth } from "../contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

describe("Layout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders Sign In link when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      patron: null,
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderWithRouter(<Layout />);

    expect(screen.getByText("CoinOperatedBrandon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/signin");
  });

  it("renders user info and Sign Out when authenticated", () => {
    mockUseAuth.mockReturnValue({
      patron: { id: "1", email: "test@example.com", display_name: null, is_admin: false },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderWithRouter(<Layout />);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
  });

  it("shows display_name when available", () => {
    mockUseAuth.mockReturnValue({
      patron: { id: "1", email: "test@example.com", display_name: "Test User", is_admin: false },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderWithRouter(<Layout />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.queryByText("test@example.com")).not.toBeInTheDocument();
  });

  it("calls logout when Sign Out is clicked", async () => {
    mockUseAuth.mockReturnValue({
      patron: { id: "1", email: "test@example.com", display_name: null, is_admin: false },
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderWithRouter(<Layout />);

    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("renders child route content via Outlet", () => {
    mockUseAuth.mockReturnValue({
      patron: null,
      loading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    renderWithRouter(<Layout />, ["/"]);

    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
