import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTaskActions from "./AdminTaskActions";
import { patchTask, postUpdate } from "../api/admin";
import { makeTask } from "../test/factories";

vi.mock("../api/admin");

const mockPatchTask = vi.mocked(patchTask);
const mockPostUpdate = vi.mocked(postUpdate);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AdminTaskActions", () => {
  it("shows Accept and Decline buttons for proposed tasks", () => {
    render(<AdminTaskActions task={makeTask({ status: "proposed" })} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("calls patchTask with underway on Accept click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "underway" }));
    render(<AdminTaskActions task={makeTask({ status: "proposed", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "underway" });
    expect(onAction).toHaveBeenCalled();
  });

  it("calls patchTask with declined on Decline click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "declined" }));
    render(<AdminTaskActions task={makeTask({ status: "proposed", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "declined" });
  });

  it("shows post update and mark complete forms for underway tasks", () => {
    render(<AdminTaskActions task={makeTask({ status: "underway" })} onAction={vi.fn()} />);
    expect(screen.getByPlaceholderText(/progress update/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Update" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/evidence/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abandon" })).toBeInTheDocument();
  });

  it("posts an update and clears textarea", async () => {
    const onAction = vi.fn();
    mockPostUpdate.mockResolvedValue({ id: "u1", task_id: "t1", body: "progress", created_at: "" });
    render(<AdminTaskActions task={makeTask({ status: "underway", id: "t1" })} onAction={onAction} />);
    const textarea = screen.getByPlaceholderText(/progress update/i);
    await userEvent.type(textarea, "progress");
    await userEvent.click(screen.getByRole("button", { name: "Post Update" }));
    expect(mockPostUpdate).toHaveBeenCalledWith("t1", "progress");
    expect(onAction).toHaveBeenCalled();
    expect(textarea).toHaveValue("");
  });

  it("disables Post Update button when textarea is empty", () => {
    render(<AdminTaskActions task={makeTask({ status: "underway" })} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Post Update" })).toBeDisabled();
  });

  it("marks complete without evidence", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "review" }));
    render(<AdminTaskActions task={makeTask({ status: "underway", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "review" });
    expect(onAction).toHaveBeenCalled();
  });

  it("marks complete with evidence and clears textarea", async () => {
    mockPatchTask.mockResolvedValue(makeTask({ status: "review" }));
    render(<AdminTaskActions task={makeTask({ status: "underway", id: "t1" })} onAction={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/evidence/i);
    await userEvent.type(textarea, "PR merged");
    await userEvent.click(screen.getByRole("button", { name: "Mark Complete" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { evidence: "PR merged", status: "review" });
    expect(textarea).toHaveValue("");
  });

  it("calls patchTask with proposed on Abandon click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "proposed" }));
    render(<AdminTaskActions task={makeTask({ status: "underway", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Abandon" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "proposed" });
    expect(onAction).toHaveBeenCalled();
  });

  it("shows review info for review status", () => {
    render(<AdminTaskActions task={makeTask({ status: "review", review_at: "2025-06-01T00:00:00Z" })} onAction={vi.fn()} />);
    expect(screen.getByText(/Review started/)).toBeInTheDocument();
  });

  it("renders nothing for completed tasks", () => {
    const { container } = render(<AdminTaskActions task={makeTask({ status: "completed" })} onAction={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("displays error on API failure", async () => {
    mockPatchTask.mockRejectedValue(new Error("Server error"));
    render(<AdminTaskActions task={makeTask({ status: "proposed" })} onAction={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Server error")).toBeInTheDocument();
  });

  it("shows Move to Proposed and Decline buttons for ideation tasks", () => {
    render(<AdminTaskActions task={makeTask({ status: "ideation" })} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Move to Proposed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("calls patchTask with proposed on Move to Proposed click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "proposed" }));
    render(<AdminTaskActions task={makeTask({ status: "ideation", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Move to Proposed" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "proposed" });
    expect(onAction).toHaveBeenCalled();
  });

  it("calls patchTask with declined on ideation Decline click", async () => {
    const onAction = vi.fn();
    mockPatchTask.mockResolvedValue(makeTask({ status: "declined" }));
    render(<AdminTaskActions task={makeTask({ status: "ideation", id: "t1" })} onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mockPatchTask).toHaveBeenCalledWith("t1", { status: "declined" });
    expect(onAction).toHaveBeenCalled();
  });
});
