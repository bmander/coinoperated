import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import Dashboard from "./Dashboard";
import { fetchMyPledges, fetchMyNotifications, fetchPaymentMethods, deletePaymentMethod } from "../api/patron";
import { getMyPledge } from "../api/pledges";
import { makePatronPledge, makeNotification } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/patron");
vi.mock("../api/pledges");
vi.mock("@stripe/stripe-js");
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ patron: { id: "p1", email: "test@example.com", display_name: null, is_admin: false }, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

const mockFetchPledges = vi.mocked(fetchMyPledges);
const mockFetchNotifications = vi.mocked(fetchMyNotifications);
const mockFetchPaymentMethods = vi.mocked(fetchPaymentMethods);
const mockDeletePaymentMethod = vi.mocked(deletePaymentMethod);
const mockGetMyPledge = vi.mocked(getMyPledge);

beforeEach(() => {
  mockFetchPaymentMethods.mockResolvedValue([]);
  mockGetMyPledge.mockResolvedValue(null);
});

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

  it("renders pledge list with task links", async () => {
    mockFetchPledges.mockResolvedValue([
      makePatronPledge({ id: "p1", amount: 5000, task: { id: "t1", title: "Fix road", status: "underway" } }),
      makePatronPledge({ id: "p2", amount: 1000, task: { id: "t2", title: "Plant trees", status: "proposed" } }),
    ]);
    mockFetchNotifications.mockResolvedValue([]);

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("Fix road")).toBeInTheDocument();
    expect(screen.getByText("Plant trees")).toBeInTheDocument();
  });

  it("renders task title links pointing to task detail pages", async () => {
    mockFetchPledges.mockResolvedValue([
      makePatronPledge({ id: "p1", task: { id: "task-abc", title: "Fix road", status: "proposed" } }),
    ]);
    mockFetchNotifications.mockResolvedValue([]);

    renderWithRouter(<Dashboard />);
    const link = await screen.findByRole("link", { name: "Fix road" });
    expect(link).toHaveAttribute("href", "/tasks/task-abc");
  });

  it("renders PledgeWidget for each pledge row", async () => {
    mockFetchPledges.mockResolvedValue([
      makePatronPledge({ id: "p1", task: { id: "t1", title: "Fix road", status: "proposed" } }),
      makePatronPledge({ id: "p2", task: { id: "t2", title: "Plant trees", status: "underway" } }),
    ]);
    mockFetchNotifications.mockResolvedValue([]);

    renderWithRouter(<Dashboard />);
    const buttons = await screen.findAllByRole("button", { name: "Pledge" });
    expect(buttons).toHaveLength(2);
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
    expect(screen.getByText("No saved payment methods.")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    mockFetchPledges.mockRejectedValue(new Error("Failed to fetch pledges: 500"));
    mockFetchNotifications.mockRejectedValue(new Error("Failed to fetch notifications: 500"));

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("Error: Failed to fetch pledges: 500")).toBeInTheDocument();
    expect(screen.getByText("Error: Failed to fetch notifications: 500")).toBeInTheDocument();
  });

  it("renders saved payment methods", async () => {
    mockFetchPledges.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
      { id: "pm_2", brand: "mastercard", last4: "5555", exp_month: 3, exp_year: 2027 },
    ]);

    renderWithRouter(<Dashboard />);
    expect(await screen.findByText("…4242")).toBeInTheDocument();
    expect(screen.getByText("…5555")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("deletes a payment method on confirm", async () => {
    mockFetchPledges.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_del", brand: "visa", last4: "9999", exp_month: 1, exp_year: 2030 },
    ]);
    mockDeletePaymentMethod.mockResolvedValue(undefined);
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    renderWithRouter(<Dashboard />);
    await screen.findByText("…9999");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mockDeletePaymentMethod).toHaveBeenCalledWith("pm_del");
  });

  it("shows error when deleting a PM that is in use", async () => {
    mockFetchPledges.mockResolvedValue([]);
    mockFetchNotifications.mockResolvedValue([]);
    mockFetchPaymentMethods.mockResolvedValue([
      { id: "pm_used", brand: "visa", last4: "1111", exp_month: 6, exp_year: 2029 },
    ]);
    mockDeletePaymentMethod.mockRejectedValue(new Error("Payment method is in use by an active pledge"));
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);

    renderWithRouter(<Dashboard />);
    await screen.findByText("…1111");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Payment method is in use by an active pledge")).toBeInTheDocument();
  });
});
