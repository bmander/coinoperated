import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getTask } from "../api/tasks";
import type { TaskDetailRead } from "../api/types";
import { formatCents, statusLabel } from "../utils/formatting";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<TaskDetailRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchId = useRef(0);

  useEffect(() => {
    if (!taskId) return;
    const id = ++fetchId.current;
    let cancelled = false;

    getTask(taskId)
      .then((data) => {
        if (!cancelled && fetchId.current === id) {
          setTask(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && fetchId.current === id) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) return <p className="board-message">Loading task...</p>;
  if (error) return <p className="board-message board-error">Error: {error}</p>;
  if (!task) return null;

  const canPledge = task.status === "open" || task.status === "accepted";

  return (
    <div className="task-detail">
      <Link to="/" className="back-link">&larr; All Tasks</Link>

      <div className="task-detail-header">
        <span className={`status-badge status-${task.status}`}>
          {statusLabel(task.status)}
        </span>
        <h1 className="task-detail-title">{task.title}</h1>
        <p className="task-detail-stats">
          {task.pledge_count} {task.pledge_count === 1 ? "backer" : "backers"} &middot;{" "}
          {formatCents(task.pledge_total)} pledged
          {task.status === "completed" && task.collected_total > 0 && (
            <> &middot; Collected {formatCents(task.collected_total)} of {formatCents(task.pledge_total)} pledged</>
          )}
        </p>
      </div>

      <section className="task-detail-section">
        <h2>Description</h2>
        <div className="markdown-body">
          <Markdown>{task.description}</Markdown>
        </div>
      </section>

      {task.criteria && (
        <section className="task-detail-section">
          <h2>Delivery Criteria</h2>
          <div className="markdown-body">
            <Markdown>{task.criteria}</Markdown>
          </div>
        </section>
      )}

      {task.updates.length > 0 && (
        <section className="task-detail-section">
          <h2>Progress Updates</h2>
          <ul className="updates-list">
            {task.updates.map((update) => (
              <li key={update.id} className="update-item">
                <time className="update-date">
                  {new Date(update.created_at).toLocaleDateString()}
                </time>
                <div className="markdown-body">
                  <Markdown>{update.body}</Markdown>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {task.status === "completed" && task.evidence && (
        <section className="task-detail-section">
          <h2>Completion Evidence</h2>
          <div className="markdown-body">
            <Markdown>{task.evidence}</Markdown>
          </div>
        </section>
      )}

      {canPledge && (
        <div className="task-detail-cta">
          <Link to={`/tasks/${task.id}/pledge`} className="btn btn-primary">
            Pledge
          </Link>
        </div>
      )}
    </div>
  );
}
