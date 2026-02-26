import { Link } from "react-router-dom";
import type { TaskRead } from "../api/types";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "./StatusBadge";

export default function TaskCard({ task }: { task: TaskRead }) {
  return (
    <div className="task-card">
      <div className="task-card-header">
        <StatusBadge status={task.status} />
      </div>
      <h3 className="task-card-title">{task.title}</h3>
      <p className="task-card-stats">
        {formatBackers(task.pledge_count)} &middot;{" "}
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
