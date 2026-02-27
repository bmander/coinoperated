import { Link } from "react-router-dom";
import { fetchMyPledges, fetchMyNotifications } from "../api/patron";
import type { PatronPledgeRead, NotificationRead } from "../api/types";
import useFetch from "../hooks/useFetch";
import StatusBadge from "../components/StatusBadge";
import { formatCents } from "../utils/formatting";

function eventLabel(event: string): string {
  switch (event) {
    case "task_accepted": return "Accepted";
    case "task_completed": return "Completed";
    case "task_declined": return "Declined";
    default: return event;
  }
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
                  <Link to={`/tasks/${pledge.task.id}/pledge`} className="btn btn-secondary btn-sm">
                    Update
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
