import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import PatronProfile from "./PatronProfile";
import { getPatron } from "../api/patron";
import { makePatronProfile, makeTask } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/patron");
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ patron: null, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const mockGetPatron = vi.mocked(getPatron);

function renderProfile(patronId = "patron-1") {
  return renderWithRouter(
    <Routes>
      <Route path="/patrons/:patronId" element={<PatronProfile />} />
    </Routes>,
    [`/patrons/${patronId}`],
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PatronProfile", () => {
  it("shows loading state initially", () => {
    mockGetPatron.mockReturnValue(new Promise(() => {}));
    renderProfile();
    expect(screen.getByText("Loading patron...")).toBeInTheDocument();
  });

  it("renders patron display name", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({ display_name: "Alice" }));
    renderProfile();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("renders Anonymous when display_name is null", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({ display_name: null }));
    renderProfile();
    expect(await screen.findByText("Anonymous")).toBeInTheDocument();
  });

  it("renders member since date", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({ created_at: "2025-06-15T00:00:00Z" }));
    renderProfile();
    expect(await screen.findByText(/Member since/)).toBeInTheDocument();
  });

  it("renders submitted tasks", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({
      submitted_tasks: [
        makeTask({ id: "t1", title: "Fix the road" }),
        makeTask({ id: "t2", title: "Build the park" }),
      ],
    }));
    renderProfile();
    expect(await screen.findByText("Submitted Tasks")).toBeInTheDocument();
    expect(screen.getByText("Fix the road")).toBeInTheDocument();
    expect(screen.getByText("Build the park")).toBeInTheDocument();
  });

  it("renders task links pointing to task detail pages", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({
      submitted_tasks: [makeTask({ id: "t1", title: "Fix the road" })],
    }));
    renderProfile();
    const link = await screen.findByRole("link", { name: "Fix the road" });
    expect(link).toHaveAttribute("href", "/tasks/t1");
  });

  it("shows message when no submitted tasks", async () => {
    mockGetPatron.mockResolvedValue(makePatronProfile({ submitted_tasks: [] }));
    renderProfile();
    expect(await screen.findByText("No submitted tasks yet.")).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    mockGetPatron.mockRejectedValue(new Error("Failed to fetch patron: 500"));
    renderProfile();
    expect(await screen.findByText("Error: Failed to fetch patron: 500")).toBeInTheDocument();
  });

  it("shows error for 404", async () => {
    mockGetPatron.mockRejectedValue(new Error("Patron not found"));
    renderProfile();
    expect(await screen.findByText("Error: Patron not found")).toBeInTheDocument();
  });
});
