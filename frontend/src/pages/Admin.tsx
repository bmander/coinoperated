import { useState, useCallback } from "react";
import { collectPayments, deleteTask, fetchAdminTasks, patchTask, postUpdate } from "../api/admin";
import type { AdminTaskRead, CollectResponse } from "../api/types";
import { formatBackers, formatCents } from "../utils/formatting";
import StatusBadge from "../components/StatusBadge";
import useFetch from "../hooks/useFetch";

function PledgeTable({ pledges }: { pledges: AdminTaskRead["pledges"] }) {
  if (pledges.length === 0) return <p className="admin-no-pledges">No pledges yet.</p>;

  return (
    <table className="admin-pledge-table">
      <thead>
        <tr>
          <th>Backer</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {pledges.map((p) => (
          <tr key={p.id}>
            <td>{p.patron_email}</td>
            <td>{formatCents(p.amount)}</td>
            <td>{p.status}</td>
            <td>{new Date(p.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AdminTaskCard({
  task,
  onAction,
}: {
  task: AdminTaskRead;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updateBody, setUpdateBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectResult, setCollectResult] = useState<CollectResponse | null>(null);

  const handleAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onAction();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePostUpdate = () =>
    handleAction(async () => {
      await postUpdate(task.id, updateBody);
      setUpdateBody("");
    });

  const handleMarkComplete = () =>
    handleAction(async () => {
      if (evidence) {
        await patchTask(task.id, { evidence });
      }
      await patchTask(task.id, { status: "collecting" });
    });

  return (
    <div className="admin-task-card">
      <div
        className="admin-task-card-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      >
        <StatusBadge status={task.status} />
        <span className="admin-task-title">{task.title}</span>
        <span className="admin-task-stats">
          {formatCents(task.pledge_total)} &middot; {formatBackers(task.pledge_count)} &middot;{" "}
          {new Date(task.created_at).toLocaleDateString()}
        </span>
        <span className="admin-expand-icon">{expanded ? "\u25BC" : "\u25B6"}</span>
      </div>

      {expanded && (
        <div className="admin-task-detail">
          <PledgeTable pledges={task.pledges} />

          {error && <p className="admin-error">{error}</p>}

          <div className="admin-actions">
            {task.status === "open" && (
              <>
                <button
                  className="btn btn-accept"
                  disabled={busy}
                  onClick={() => handleAction(() => patchTask(task.id, { status: "accepted" }))}
                >
                  Accept
                </button>
                <button
                  className="btn btn-decline"
                  disabled={busy}
                  onClick={() => handleAction(() => patchTask(task.id, { status: "declined" }))}
                >
                  Decline
                </button>
              </>
            )}

            {task.status === "accepted" && (
              <>
                <div className="admin-update-form form-field">
                  <textarea
                    className="admin-textarea"
                    placeholder="Post a progress update (Markdown)..."
                    value={updateBody}
                    onChange={(e) => setUpdateBody(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={busy || !updateBody.trim()}
                    onClick={handlePostUpdate}
                  >
                    Post Update
                  </button>
                </div>

                <div className="admin-complete-form form-field">
                  <textarea
                    className="admin-textarea"
                    placeholder="Evidence of completion (Markdown)..."
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    rows={3}
                  />
                  <button
                    className="btn btn-accept"
                    disabled={busy}
                    onClick={handleMarkComplete}
                  >
                    Mark Complete
                  </button>
                </div>

                <button
                  className="btn btn-decline"
                  disabled={busy}
                  onClick={() => handleAction(() => patchTask(task.id, { status: "open" }))}
                >
                  Abandon
                </button>
              </>
            )}

            {task.status === "collecting" && (
              <>
                {collectResult ? (
                  <div className="admin-collection-results">
                    <p>
                      Collected {formatCents(collectResult.collected_total)} of{" "}
                      {formatCents(collectResult.pledge_total)} pledged
                      ({collectResult.collected_count} of{" "}
                      {collectResult.collected_count + collectResult.failed_count} pledges)
                    </p>
                  </div>
                ) : (
                  <button
                    className="btn btn-accept"
                    disabled={busy}
                    onClick={() =>
                      handleAction(async () => {
                        const result = await collectPayments(task.id);
                        setCollectResult(result);
                      })
                    }
                  >
                    Collect Payments
                  </button>
                )}
              </>
            )}

            {task.status === "completed" && (
              <p className="admin-collection-results">
                Collected {formatCents(task.collected_total)} of{" "}
                {formatCents(task.pledge_total)} pledged
              </p>
            )}
          </div>

          <hr />
          <button
            className="btn btn-decline"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                handleAction(() => deleteTask(task.id));
              }
            }}
          >
            Delete Task
          </button>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useFetch(fetchAdminTasks, [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading) return <p className="page-message">Loading tasks...</p>;
  if (error) return <p className="page-message page-error">Error: {error}</p>;
  if (!data) return null;

  return (
    <div className="admin-page">
      <h1>Admin Dashboard</h1>
      {data.items.length === 0 ? (
        <p className="page-message">No tasks yet.</p>
      ) : (
        <div className="admin-task-list">
          {data.items.map((task) => (
            <AdminTaskCard key={task.id} task={task} onAction={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
