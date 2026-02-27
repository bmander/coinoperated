import { Link } from "react-router-dom";
import type { TaskRead } from "../api/types";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "./StatusBadge";

export default function TaskCard({ task }: { task: TaskRead }) {
  return (
    <div className="task-card">
      <div className="task-card-content">
        <div className="task-card-main">
          <div className="task-card-title-row">
            <StatusBadge status={task.status} />
            <h3 className="task-card-title">
              <Link to={`/tasks/${task.id}`}>{task.title}</Link>
            </h3>
          </div>
          <p className="task-card-stats">
            {formatBackers(task.pledge_count)} &middot;{" "}
            {formatCents(task.pledge_total)} pledged
          </p>
        </div>
        <div className="task-card-pledge">
          <Link to={`/tasks/${task.id}/pledge`} className="btn btn-primary btn-sm">
            Pledge
          </Link>
        </div>
      </div>
    </div>
  );
}
