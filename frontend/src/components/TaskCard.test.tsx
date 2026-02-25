import { screen } from "@testing-library/react";
import TaskCard from "./TaskCard";
import type { TaskRead } from "../api/types";
import { makeTask } from "../test/factories";
import { renderWithRouter } from "../test/render";

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

  it("renders View and Pledge links with correct URLs", () => {
    renderCard(makeTask({ id: "task-42" }));
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/tasks/task-42");
    expect(screen.getByRole("link", { name: "Pledge" })).toHaveAttribute("href", "/tasks/task-42/pledge");
  });
});
