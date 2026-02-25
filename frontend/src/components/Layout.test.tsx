import { screen } from "@testing-library/react";
import Layout from "./Layout";
import { renderWithRouter } from "../test/render";

describe("Layout", () => {
  it("renders header with site title and Sign In link", () => {
    renderWithRouter(<Layout />);

    expect(screen.getByText("CoinOperatedBrandon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/signin");
  });

  it("renders child route content via Outlet", () => {
    renderWithRouter(<Layout />, ["/"]);

    // Outlet renders without crashing (no matched child route = empty)
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
