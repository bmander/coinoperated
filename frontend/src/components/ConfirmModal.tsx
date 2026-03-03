import { useState } from "react";
import Spinner from "./Spinner";

export default function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmingLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmingLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{title}</h3>
        <p className="modal-description">{description}</p>
        {error && <p className="pledge-error">{error}</p>}
        <div className="modal-actions">
          <button
            className="btn btn-decline"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? <><Spinner /> {confirmingLabel}</> : confirmLabel}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
