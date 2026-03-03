import { useState, useCallback } from "react";
import { banPatron, collectPayments, deleteTask, fetchAdminPatrons, fetchAdminTasks, patchTask, unbanPatron } from "../api/admin";
import type { AdminPatronRead, AdminTaskRead, CollectResponse } from "../api/types";
import { formatBackers, formatCents, getErrorMessage } from "../utils/formatting";
import StatusBadge from "../components/StatusBadge";
import AdminTaskActions from "../components/AdminTaskActions";
import useFetch from "../hooks/useFetch";
import Spinner from "../components/Spinner";

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
      setError(getErrorMessage(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  };

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
            <AdminTaskActions task={task} onAction={onAction} />

            {task.status === "review" && (
              <button
                className="btn btn-accept"
                disabled={busy}
                onClick={() =>
                  handleAction(() => patchTask(task.id, { status: "collecting" }))
                }
              >
                {busy ? <><Spinner /> Collecting...</> : "End Review & Collect"}
              </button>
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
                    {busy ? <><Spinner /> Collecting...</> : "Collect Payments"}
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
            {busy ? <><Spinner /> Deleting...</> : "Delete Task"}
          </button>
        </div>
      )}
    </div>
  );
}

function PatronRow({
  patron,
  onToggle,
}: {
  patron: AdminPatronRead;
  onToggle: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (patron.is_banned) {
        await unbanPatron(patron.id);
      } else {
        await banPatron(patron.id);
      }
      onToggle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>{patron.email}</td>
      <td>{patron.display_name ?? "\u2014"}</td>
      <td>{patron.is_banned ? "Banned" : "Active"}</td>
      <td>
        <button
          className={`btn ${patron.is_banned ? "btn-primary" : "btn-decline"}`}
          disabled={busy}
          onClick={handleToggle}
        >
          {busy ? <Spinner /> : patron.is_banned ? "Unban" : "Ban"}
        </button>
      </td>
    </tr>
  );
}

export default function Admin() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useFetch(fetchAdminTasks, [refreshKey]);
  const { data: patronData, loading: patronsLoading, error: patronsError } = useFetch(fetchAdminPatrons, [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (loading || patronsLoading) return <p className="page-message">Loading...</p>;
  if (error || patronsError) return <p className="page-message page-error">Error: {error || patronsError}</p>;
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

      <h2>Users</h2>
      {patronData && patronData.items.length > 0 ? (
        <table className="admin-pledge-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {patronData.items.map((p) => (
              <PatronRow key={p.id} patron={p} onToggle={refresh} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="page-message">No users yet.</p>
      )}
    </div>
  );
}
