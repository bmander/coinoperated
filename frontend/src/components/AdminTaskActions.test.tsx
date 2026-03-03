import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTaskActions from "./AdminTaskActions";
import { patchTask, postUpdate } from "../api/admin";
import { makeTaskDetail } from "../test/factories";

vi.mock("../api/admin");

const mockPatchTask = vi.mocked(patchTask);
const mockPostUpdate = vi.mocked(postUpdate);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminTaskActions", () => {
  it("shows Accept and Decline buttons for proposed tasks", () => {
    render(<AdminTaskActions task={makeTaskDetail({ status: "proposed" })} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("calls patchTask with underway on Accept click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTaskDetail({ status: "underway" }));
    render(<AdminTaskActions task={makeTaskDetail({ status: "proposed", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "underway" });
    expect(onAction).toHaveBeenCalled();
  });

  it("calls patchTask with declined on Decline click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTaskDetail({ status: "declined" }));
    render(<AdminTaskActions task={makeTaskDetail({ status: "proposed", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "declined" });
  });

  it("shows post update and mark complete forms for underway tasks", () => {
    render(<AdminTaskActions task={makeTaskDetail({ status: "underway" })} onAction={vi.fn()} />);
    expect(screen.getByPlaceholderText(/progress update/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Update" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abandon" })).toBeInTheDocument();
  });

  it("posts an update when form is submitted", async () => {
    const onAction = vi.fn();
    mockPostUpdate.mockResolvedValue({ id: "u1", task_id: "t1", body: "progress", created_at: "" });
    render(<AdminTaskActions task={makeTaskDetail({ status: "underway", id: "t1" })} onAction={onAction} />);
    await userEvent.type(screen.getByPlaceholderText(/progress update/i), "progress");
    await userEvent.click(screen.getByRole("button", { name: "Post Update" }));
    expect(mockPostUpdate).toHaveBeenCalledWith("t1", "progress");
    expect(onAction).toHaveBeenCalled();
  });

  it("disables Post Update button when textarea is empty", () => {
    render(<AdminTaskActions task={makeTaskDetail({ status: "underway" })} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Post Update" })).toBeDisabled();
  });

  it("shows review info for review status", () => {
    render(<AdminTaskActions task={makeTaskDetail({ status: "review", review_at: "2025-06-01T00:00:00Z" })} onAction={vi.fn()} />);
    expect(screen.getByText(/Review started/)).toBeInTheDocument();
  });

  it("shows nothing actionable for completed tasks", () => {
    render(<AdminTaskActions task={makeTaskDetail({ status: "completed" })} onAction={vi.fn()} />);
    expect(screen.getByText("Admin Actions")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("displays error on API failure", async () => {
    mockPatchTask.mockRejectedValue(new Error("Server error"));
    render(<AdminTaskActions task={makeTaskDetail({ status: "proposed" })} onAction={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });
});
