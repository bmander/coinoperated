import { Link, useParams } from "react-router-dom";
import { getPatron } from "../api/patron";
import useFetch from "../hooks/useFetch";
import StatusBadge from "../components/StatusBadge";

export default function PatronProfile() {
  const { patronId } = useParams<{ patronId: string }>();
  const { data: patron, loading, error } = useFetch(
    () => getPatron(patronId!),
    [patronId],
  );

  if (loading) return <p className="page-message">Loading patron...</p>;
  if (error) return <p className="page-message page-error">Error: {error}</p>;
  if (!patron) return null;

  return (
    <div className="patron-profile">
      <Link to="/" className="back-link">&larr; All Tasks</Link>

      <div className="patron-profile-header">
        <h1>{patron.display_name ?? "Anonymous"}</h1>
        <p className="patron-profile-meta">
          Member since {new Date(patron.created_at).toLocaleDateString()}
        </p>
      </div>

      {patron.submitted_tasks.length > 0 && (
        <section className="patron-profile-section">
          <h2>Submitted Tasks</h2>
          <ul className="patron-task-list">
            {patron.submitted_tasks.map((task) => (
              <li key={task.id} className="patron-task-item">
                <StatusBadge status={task.status} />
                <Link to={`/tasks/${task.id}`} className="patron-task-title">
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {patron.submitted_tasks.length === 0 && (
        <p className="page-message">No submitted tasks yet.</p>
      )}
    </div>
  );
}
