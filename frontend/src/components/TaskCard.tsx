import { Link } from "react-router-dom";
import type { TaskRead } from "../api/types";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "./StatusBadge";
import PledgeWidget from "./PledgeWidget";

export default function TaskCard({
  task,
  onPledge,
}: {
  task: TaskRead;
  onPledge?: () => void;
}) {
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
            {task.submitted_by_patron && (
              <>
                <Link to={`/patrons/${task.submitted_by_patron.id}`} className="task-card-creator">
                  {task.submitted_by_patron.display_name ?? "Anonymous"}
                </Link>
                {" "}&middot;{" "}
              </>
            )}
            {formatBackers(task.pledge_count)} &middot;{" "}
            {formatCents(task.pledge_total)} pledged
          </p>
        </div>
        <div className="task-card-pledge">
          <PledgeWidget task={task} onPledge={onPledge} />
        </div>
      </div>
    </div>
  );
}
