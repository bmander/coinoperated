import { Link } from "react-router-dom";
import type { TaskRead } from "../api/types";

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusLabel(status: string): string {
  return status.toUpperCase();
}

export default function TaskCard({ task }: { task: TaskRead }) {
  return (
    <div className="task-card">
      <div className="task-card-header">
        <span className={`status-badge status-${task.status}`}>
          {task.status === "accepted" && "\u2605 "}
          {statusLabel(task.status)}
        </span>
      </div>
      <h3 className="task-card-title">{task.title}</h3>
      <p className="task-card-stats">
        {task.pledge_count} {task.pledge_count === 1 ? "backer" : "backers"} &middot;{" "}
        {formatCents(task.pledge_total)} pledged
      </p>
      <div className="task-card-actions">
        <Link to={`/tasks/${task.id}`} className="btn btn-secondary">
          View
        </Link>
        <Link to={`/tasks/${task.id}/pledge`} className="btn btn-primary">
          Pledge
        </Link>
      </div>
    </div>
  );
}
