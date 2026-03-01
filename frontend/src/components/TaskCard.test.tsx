import { screen } from "@testing-library/react";
import TaskCard from "./TaskCard";
import type { TaskRead } from "../api/types";
import { makeTask } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ patron: null, loading: false, login: vi.fn(), logout: vi.fn() }),
}));

function renderCard(task: TaskRead) {
  return renderWithRouter(<TaskCard task={task} />);
}

describe("TaskCard", () => {
  it("renders title and status badge", () => {
    renderCard(makeTask());
    expect(screen.getByText("Fix the bridge")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
  });

  it("formats currency from cents to dollars", () => {
    renderCard(makeTask({ pledge_total: 15000 }));
    expect(screen.getByText(/\$150 pledged/)).toBeInTheDocument();
  });

  it("shows singular 'backer' for count of 1", () => {
    renderCard(makeTask({ pledge_count: 1 }));
    expect(screen.getByText(/1 backer/)).toBeInTheDocument();
    expect(screen.queryByText(/1 backers/)).not.toBeInTheDocument();
  });

  it("shows plural 'backers' for count > 1", () => {
    renderCard(makeTask({ pledge_count: 5 }));
    expect(screen.getByText(/5 backers/)).toBeInTheDocument();
  });

  it("shows star icon for accepted status", () => {
    renderCard(makeTask({ status: "accepted" }));
    expect(screen.getByText(/★/)).toBeInTheDocument();
  });

  it("renders title link and Pledge button for pledgeable tasks", () => {
    const task = makeTask({ id: "task-42", title: "My Task" });
    renderCard(task);
    expect(screen.getByRole("link", { name: "My Task" })).toHaveAttribute("href", "/tasks/task-42");
    expect(screen.getByRole("button", { name: "Pledge" })).toBeInTheDocument();
  });

  it("hides Pledge widget for non-pledgeable tasks", () => {
    const task = makeTask({ status: "completed" });
    renderCard(task);
    expect(screen.queryByRole("button", { name: "Pledge" })).not.toBeInTheDocument();
  });

  it("shows creator name linking to patron page", () => {
    const task = makeTask({
      submitted_by: "patron-1",
      submitted_by_patron: { id: "patron-1", display_name: "Alice", created_at: "2025-01-01T00:00:00Z" },
    });
    renderCard(task);
    const link = screen.getByRole("link", { name: "Alice" });
    expect(link).toHaveAttribute("href", "/patrons/patron-1");
  });

  it("shows Anonymous when creator has no display name", () => {
    const task = makeTask({
      submitted_by: "patron-1",
      submitted_by_patron: { id: "patron-1", display_name: null, created_at: "2025-01-01T00:00:00Z" },
    });
    renderCard(task);
    expect(screen.getByRole("link", { name: "Anonymous" })).toBeInTheDocument();
  });

  it("hides creator when submitted_by_patron is null", () => {
    const task = makeTask({ submitted_by_patron: null });
    renderCard(task);
    expect(screen.queryByText("Anonymous")).not.toBeInTheDocument();
  });
});
