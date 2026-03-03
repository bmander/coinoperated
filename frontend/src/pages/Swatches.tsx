import { Link } from "react-router-dom";

type Swatch = { color: string; label: string; usages: string[] };

const SWATCHES: { section: string; items: Swatch[] }[] = [
  {
    section: "Brand",
    items: [
      { color: "#2a5a8a", label: "Site title background", usages: [".site-title background", ".site-footer background"] },
      { color: "#646cff", label: "Primary / accent", usages: [".btn-primary", "links", ".tagline a", ".pledge-amt-btn:hover border", ".preview-toggle"] },
      { color: "#747bff", label: "Link hover", usages: ["a:hover"] },
    ],
  },
  {
    section: "Text",
    items: [
      { color: "#213547", label: "Body text", usages: [":root color"] },
      { color: "#444", label: "Prose text", usages: [".how-it-works-page p"] },
      { color: "#555", label: "Notification body", usages: [".notification-message"] },
      { color: "#888", label: "Secondary / muted", usages: [".tagline", ".task-card-stats", ".back-link", ".header-user-name", ".update-date", ".pledge-status"] },
    ],
  },
  {
    section: "Backgrounds",
    items: [
      { color: "#ffffff", label: "Layout / card background", usages: [".layout", ".modal-card", "inputs"] },
      { color: "#f4f4f4", label: "Page background", usages: [":root background-color", ".markdown-body pre"] },
      { color: "#f0f0f0", label: "Payment method chip", usages: [".pm-chip"] },
    ],
  },
  {
    section: "Borders",
    items: [
      { color: "#ddd", label: "Default border", usages: [".task-card", ".pledge-list-item", ".modal-card", "hr", "section h2 border-bottom"] },
      { color: "#ccc", label: "Input / secondary border", usages: ["inputs", "selects", ".btn-secondary", ".update-item border-left"] },
    ],
  },
  {
    section: "Status badges",
    items: [
      { color: "#e6f4e6", label: "Proposed background", usages: [".status-proposed background"] },
      { color: "#2a7a2a", label: "Proposed text / Accept button", usages: [".status-proposed color", ".btn-accept"] },
      { color: "#e6e6f4", label: "Underway background", usages: [".status-underway background"] },
      { color: "#4444cc", label: "Underway text", usages: [".status-underway color", ".notification-event-task_accepted"] },
      { color: "#f4f4e6", label: "Collecting background", usages: [".status-collecting background"] },
      { color: "#997700", label: "Collecting text", usages: [".status-collecting color", ".admin-collecting-indicator"] },
      { color: "#d4ead4", label: "Completed background", usages: [".status-completed background"] },
      { color: "#1a5a1a", label: "Completed text", usages: [".status-completed color", ".admin-collection-results", ".notification-event-task_completed"] },
      { color: "#f4e6e6", label: "Declined background", usages: [".status-declined background"] },
      { color: "#aa3333", label: "Declined text / Decline button", usages: [".status-declined color", ".btn-decline", ".notification-event-task_declined"] },
    ],
  },
  {
    section: "Actions",
    items: [
      { color: "#8fca8f", label: "Confirm / success", usages: [".pledge-confirm-btn"] },
      { color: "#ca8f8f", label: "Cancel / danger", usages: [".pledge-cancel-btn"] },
      { color: "#ee5555", label: "Error text", usages: [".page-error", ".form-error", ".pledge-error", ".admin-error"] },
    ],
  },
];

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#213547" : "#fff";
}

export default function Swatches() {
  return (
    <div className="swatches-page">
      <Link to="/" className="back-link">&larr; Back to tasks</Link>
      <h1>Color Swatches</h1>

      {SWATCHES.map((group) => (
        <div key={group.section} className="swatch-section">
          <h2>{group.section}</h2>
          <div className="swatch-grid">
            {group.items.map((s) => (
              <div key={s.color + s.label} className="swatch-card">
                <div
                  className="swatch-block"
                  style={{ background: s.color, color: contrastColor(s.color) }}
                >
                  {s.color}
                </div>
                <div className="swatch-info">
                  <strong>{s.label}</strong>
                  <span className="swatch-usages">{s.usages.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
