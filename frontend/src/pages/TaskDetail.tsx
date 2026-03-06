import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { getTask } from "../api/tasks";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "../components/StatusBadge";
import useFetch from "../hooks/useFetch";
import PledgeWidget from "../components/PledgeWidget";
import AdminTaskActions from "../components/AdminTaskActions";
import { useAuth } from "../contexts/AuthContext";

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
  const { patron } = useAuth();
  const isAdmin = patron?.is_admin ?? false;
  const { data: task, loading, error, refetch } = useFetch(
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
        <div className="task-detail-header-top">
          <StatusBadge status={task.status} />
          {isAdmin && <Link to={`/tasks/${task.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>}
        </div>
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
              <li key={update.id}>
                <time className="update-date">
                  {new Date(update.created_at).toLocaleDateString()}
                </time>
                <div className="markdown-body markdown-body--updates">
                  <Markdown>{update.body}</Markdown>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(task.status === "completed" || task.status === "review") && task.evidence && (
        <MarkdownSection title="Completion Evidence" className="markdown-body--evidence">{task.evidence}</MarkdownSection>
      )}

      {isAdmin && (
        <section className="task-detail-section">
          <h2>Admin Actions</h2>
          <div className="admin-actions">
            <AdminTaskActions task={task} onAction={refetch} />
          </div>
        </section>
      )}

      <PledgeWidget task={task} />
    </div>
  );
}
