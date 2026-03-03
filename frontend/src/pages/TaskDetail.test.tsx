import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import TaskDetail from "./TaskDetail";
import { getTask } from "../api/tasks";
import { getMyPledge } from "../api/pledges";
import { fetchPaymentMethods } from "../api/patron";
import { makeTaskDetail, makeUpdate } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/tasks");
vi.mock("../api/pledges");
vi.mock("../api/patron");
vi.mock("../api/admin");
vi.mock("@stripe/stripe-js");

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockGetTask = vi.mocked(getTask);
const mockGetMyPledge = vi.mocked(getMyPledge);
const mockFetchPaymentMethods = vi.mocked(fetchPaymentMethods);

function renderDetail(taskId = "abc-123") {
  return renderWithRouter(
    <Routes>
      <Route path="/tasks/:taskId" element={<TaskDetail />} />
    </Routes>,
    [`/tasks/${taskId}`],
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ patron: null, loading: false, login: vi.fn(), logout: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TaskDetail", () => {
  it("shows loading state initially", () => {
    mockGetTask.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByText("Loading task...")).toBeInTheDocument();
  });

  it("renders task title and status", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ title: "Fix the bridge", status: "underway" }));
    renderDetail();
    expect(await screen.findByText("Fix the bridge")).toBeInTheDocument();
    expect(screen.getByText(/UNDERWAY/)).toBeInTheDocument();
  });

  it("renders description as markdown", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ description: "# Hello\n\nSome **bold** text" }));
    renderDetail();
    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(/bold/)).toBeInTheDocument();
  });

  it("renders pledge stats", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ pledge_count: 3, pledge_total: 25000 }));
    renderDetail();
    expect(await screen.findByText(/3 backers/)).toBeInTheDocument();
    expect(screen.getByText(/\$250 pledged/)).toBeInTheDocument();
  });

  it("uses singular 'backer' for count of 1", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ pledge_count: 1 }));
    renderDetail();
    expect(await screen.findByText(/1 backer/)).toBeInTheDocument();
  });

  it("renders delivery criteria when present", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ criteria: "Must pass all tests" }));
    renderDetail();
    expect(await screen.findByText("Delivery Criteria")).toBeInTheDocument();
    expect(screen.getByText("Must pass all tests")).toBeInTheDocument();
  });

  it("hides delivery criteria when null", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ criteria: null }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByText("Delivery Criteria")).not.toBeInTheDocument();
  });

  it("renders progress updates", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({
      updates: [
        makeUpdate({ id: "u1", body: "Started work" }),
        makeUpdate({ id: "u2", body: "Halfway done" }),
      ],
    }));
    renderDetail();
    expect(await screen.findByText("Progress Updates")).toBeInTheDocument();
    expect(screen.getByText("Started work")).toBeInTheDocument();
    expect(screen.getByText("Halfway done")).toBeInTheDocument();
  });

  it("hides progress updates when empty", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ updates: [] }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByText("Progress Updates")).not.toBeInTheDocument();
  });

  it("shows completion evidence for completed tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({
      status: "completed",
      evidence: "See the deployed fix at example.com",
    }));
    renderDetail();
    expect(await screen.findByText("Completion Evidence")).toBeInTheDocument();
    expect(screen.getByText("See the deployed fix at example.com")).toBeInTheDocument();
  });

  it("hides evidence for non-completed tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({
      status: "proposed",
      evidence: "Some evidence",
    }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByText("Completion Evidence")).not.toBeInTheDocument();
  });

  it("shows evidence during review", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({
      status: "review",
      evidence: "PR merged and deployed",
    }));
    renderDetail();
    expect(await screen.findByText("Completion Evidence")).toBeInTheDocument();
    expect(screen.getByText("PR merged and deployed")).toBeInTheDocument();
  });

  it("shows Pledge button for proposed tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "proposed" }));
    renderDetail();
    expect(await screen.findByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("shows Pledge button for underway tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "underway" }));
    renderDetail();
    expect(await screen.findByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("hides Pledge button for completed tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "completed" }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByRole("button", { name: "Pledge" })).not.toBeInTheDocument();
  });

  it("shows collected stats for completed tasks", async () => {
    mockGetTask.mockResolvedValue(makeTaskDetail({
      status: "completed",
      pledge_total: 50000,
      collected_total: 45000,
    }));
    renderDetail();
    expect(await screen.findByText(/Collected \$450 of \$500 pledged/)).toBeInTheDocument();
  });

  it("shows error state on API failure", async () => {
    mockGetTask.mockRejectedValue(new Error("Failed to fetch task: 500"));
    renderDetail();
    expect(await screen.findByText("Error: Failed to fetch task: 500")).toBeInTheDocument();
  });

  it("shows error state for 404", async () => {
    mockGetTask.mockRejectedValue(new Error("Task not found"));
    renderDetail();
    expect(await screen.findByText("Error: Task not found")).toBeInTheDocument();
  });

  it("shows admin actions when user is admin", async () => {
    mockUseAuth.mockReturnValue({ patron: { is_admin: true }, loading: false, login: vi.fn(), logout: vi.fn() });
    mockGetMyPledge.mockResolvedValue(null);
    mockFetchPaymentMethods.mockResolvedValue([]);
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "proposed" }));
    renderDetail();
    expect(await screen.findByText("Admin Actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("hides admin actions for non-admin users", async () => {
    mockUseAuth.mockReturnValue({ patron: { is_admin: false }, loading: false, login: vi.fn(), logout: vi.fn() });
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "proposed" }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByText("Admin Actions")).not.toBeInTheDocument();
  });

  it("hides admin actions when not logged in", async () => {
    mockUseAuth.mockReturnValue({ patron: null, loading: false, login: vi.fn(), logout: vi.fn() });
    mockGetTask.mockResolvedValue(makeTaskDetail({ status: "proposed" }));
    renderDetail();
    await screen.findByText("Description");
    expect(screen.queryByText("Admin Actions")).not.toBeInTheDocument();
  });
});
