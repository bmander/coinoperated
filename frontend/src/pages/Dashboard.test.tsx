import { screen } from "@testing-library/react";
import Dashboard from "./Dashboard";
import { fetchMyPledges, fetchMyNotifications } from "../api/patron";
import { makePatronPledge, makeNotification } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/patron");
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ patron: { id: "p1", email: "test@example.com", display_name: null, is_admin: false }, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const mockFetchPledges = vi.mocked(fetchMyPledges);
const mockFetchNotifications = vi.mocked(fetchMyNotifications);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dashboard", () => {
  it("shows loading state initially", () => {
    mockFetchPledges.mockReturnValue(new Promise(() => {}));
    mockFetchNotifications.mockReturnValue(new Promise(() => {}));
    renderWithRouter(<Dashboard />);
    expect(screen.getByText("Loading pledges...")).toBeInTheDocument();
    expect(screen.getByText("Loading notifications...")).toBeInTheDocument();
  });

  it("renders pledge list with task links and amounts", async () => {
    mockFetchPledges.mockResolvedValue([
      makePatronPledge({ id: "p1", amount: 5000, task: { id: "t1", title: "Fix road", status: "accepted" } }),
      makePatronPledge({ id: "p2", amount: 1000, task: { id: "t2", title: "Plant trees", status: "open" } }),
    ]);
    mockFetchNotifications.mockResolvedValue([]);

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("Fix road")).toBeInTheDocument();
    expect(screen.getByText("Plant trees")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("renders notification feed", async () => {
    mockFetchPledges.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([
      makeNotification({ id: "n1", event: "task_accepted", message: 'Task "Fix road" has been accepted' }),
      makeNotification({ id: "n2", event: "task_declined", message: 'Task "Old task" has been declined' }),
    ]);

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText('Task "Fix road" has been accepted')).toBeInTheDocument();
    expect(screen.getByText('Task "Old task" has been declined')).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows empty states when no data", async () => {
    mockFetchPledges.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("No pledges yet.")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    mockFetchPledges.mockRejectedValue(new Error("Failed to fetch pledges: 500"));
    mockFetchNotifications.mockRejectedValue(new Error("Failed to fetch notifications: 500"));

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("Error: Failed to fetch pledges: 500")).toBeInTheDocument();
    expect(screen.getByText("Error: Failed to fetch notifications: 500")).toBeInTheDocument();
  });
});
