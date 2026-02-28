import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getTask } from "../api/tasks";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "../components/StatusBadge";
import useFetch from "../hooks/useFetch";
import PledgeWidget from "../components/PledgeWidget";

function MarkdownSection({ title, children }: { title: string; children: string }) {
  return (
    <section className="task-detail-section">
      <h2>{title}</h2>
      <div className="markdown-body">
        <Markdown>{children}</Markdown>
      </div>
    </section>
  );
}

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, loading, error } = useFetch(
    () => getTask(taskId!),
    [taskId],
  );

  if (loading) return <p className="page-message">Loading task...</p>;
  if (error) return <p className="page-message page-error">Error: {error}</p>;
  if (!task) return null;

  return (
    <div className="task-detail">
      <Link to="/" className="back-link">&larr; All Tasks</Link>

      <div className="task-detail-header">
        <StatusBadge status={task.status} />
        <h1 className="task-detail-title">{task.title}</h1>
        <p className="task-detail-stats">
          {formatBackers(task.pledge_count)} &middot;{" "}
          {formatCents(task.pledge_total)} pledged
          {task.status === "completed" && task.collected_total > 0 && (
            <> &middot; Collected {formatCents(task.collected_total)} of {formatCents(task.pledge_total)} pledged</>
          )}
        </p>
      </div>

      <MarkdownSection title="Description">{task.description}</MarkdownSection>

      {task.criteria && (
        <MarkdownSection title="Delivery Criteria">{task.criteria}</MarkdownSection>
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
        <MarkdownSection title="Completion Evidence">{task.evidence}</MarkdownSection>
      )}

      <PledgeWidget task={task} />
    </div>
  );
}
