import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchMyPledges, fetchMyNotifications, fetchPaymentMethods, deletePaymentMethod } from "../api/patron";
import type { PatronPledgeRead, NotificationRead, SavedPaymentMethod } from "../api/types";
import useFetch from "../hooks/useFetch";
import StatusBadge from "../components/StatusBadge";
import PledgeWidget from "../components/PledgeWidget";
import { capitalize, formatCents } from "../utils/formatting";

function eventLabel(event: string): string {
  switch (event) {
    case "task_accepted": return "Accepted";
    case "task_completed": return "Completed";
    case "task_declined": return "Declined";
    default: return event;
  }
}

function SavedPaymentMethods() {
  const { data: methods, loading, error, refetch } = useFetch<SavedPaymentMethod[]>(fetchPaymentMethods, []);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete(pmId: string) {
    if (!confirm("Remove this payment method?")) return;
    setDeleting(pmId);
    setDeleteError("");
    try {
      await deletePaymentMethod(pmId);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to remove card");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="dashboard-section">
      <h2>Saved Payment Methods</h2>
      {loading && <p className="page-message">Loading payment methods...</p>}
      {error && <p className="page-message page-error">Error: {error}</p>}
      {deleteError && <p className="page-message page-error">{deleteError}</p>}
      {methods && methods.length === 0 && <p className="page-message">No saved payment methods.</p>}
      {methods && methods.length > 0 && (
        <div className="payment-method-list">
          {methods.map((pm) => (
            <div key={pm.id} className="payment-method-list-item">
              <div className="payment-method-info">
                <span className="pm-brand">{capitalize(pm.brand)}</span>
                <span className="pm-last4">…{pm.last4}</span>
                <span className="pm-expiry">Exp {String(pm.exp_month).padStart(2, "0")}/{pm.exp_year}</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleDelete(pm.id)}
                disabled={deleting === pm.id}
              >
                {deleting === pm.id ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { data: pledges, loading: pledgesLoading, error: pledgesError } = useFetch<PatronPledgeRead[]>(fetchMyPledges, []);
  const { data: notifications, loading: notificationsLoading, error: notificationsError } = useFetch<NotificationRead[]>(fetchMyNotifications, []);

  return (
    <div className="dashboard-page">
      <h1>My Dashboard</h1>

      <section className="dashboard-section">
        <h2>My Pledges</h2>
        {pledgesLoading && <p className="page-message">Loading pledges...</p>}
        {pledgesError && <p className="page-message page-error">Error: {pledgesError}</p>}
        {pledges && pledges.length === 0 && <p className="page-message">No pledges yet.</p>}
        {pledges && pledges.length > 0 && (
          <div className="pledge-list">
            {pledges.map((pledge) => (
              <div key={pledge.id} className="pledge-list-item">
                <div className="pledge-list-item-info">
                  <StatusBadge status={pledge.task.status} />
                  <Link to={`/tasks/${pledge.task.id}`} className="pledge-task-title">
                    {pledge.task.title}
                  </Link>
                </div>
                <div className="pledge-list-item-details">
                  <span className="pledge-amount">{formatCents(pledge.amount)}</span>
                  <span className={`pledge-status pledge-status-${pledge.status}`}>{pledge.status}</span>
                  <PledgeWidget task={pledge.task} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SavedPaymentMethods />

      <section className="dashboard-section">
        <h2>Notifications</h2>
        {notificationsLoading && <p className="page-message">Loading notifications...</p>}
        {notificationsError && <p className="page-message page-error">Error: {notificationsError}</p>}
        {notifications && notifications.length === 0 && <p className="page-message">No notifications yet.</p>}
        {notifications && notifications.length > 0 && (
          <div className="notification-feed">
            {notifications.map((notif) => (
              <div key={notif.id} className="notification-item">
                <div className="notification-item-header">
                  <span className={`notification-event notification-event-${notif.event}`}>
                    {eventLabel(notif.event)}
                  </span>
                  <span className="notification-time">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="notification-message">{notif.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
