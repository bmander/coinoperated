import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getTask } from "../api/tasks";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "../components/StatusBadge";
import useFetch from "../hooks/useFetch";
import PledgeWidget from "../components/PledgeWidget";

function MarkdownSection({ title, children, className }: { title: string; children: string; className?: string }) {
  return (
    <section className="task-detail-section">
      <h2>{title}</h2>
      <div className={`markdown-body${className ? ` ${className}` : ""}`}>
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
          {task.submitted_by_patron && (
            <>
              Submitted by{" "}
              <Link to={`/patrons/${task.submitted_by_patron.id}`} className="task-detail-creator">
                {task.submitted_by_patron.display_name ?? "Anonymous"}
              </Link>
              {" "}&middot;{" "}
            </>
          )}
          {formatBackers(task.pledge_count)} &middot;{" "}
          {formatCents(task.pledge_total)} pledged
          {task.status === "completed" && task.collected_total > 0 && (
            <> &middot; Collected {formatCents(task.collected_total)} of {formatCents(task.pledge_total)} pledged</>
          )}
        </p>
      </div>

      <MarkdownSection title="Description" className="markdown-body--description">{task.description}</MarkdownSection>

      {task.criteria && (
        <MarkdownSection title="Delivery Criteria" className="markdown-body--criteria">{task.criteria}</MarkdownSection>
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

      {(task.status === "completed" || task.status === "review") && task.evidence && (
        <MarkdownSection title="Completion Evidence">{task.evidence}</MarkdownSection>
      )}

      <PledgeWidget task={task} />
    </div>
  );
}
