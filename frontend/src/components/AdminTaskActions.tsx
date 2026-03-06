import { useState } from "react";
import { patchTask, postUpdate } from "../api/admin";
import type { TaskRead } from "../api/types";
import { getErrorMessage } from "../utils/formatting";
import Spinner from "./Spinner";

export default function AdminTaskActions({
  task,
  onAction,
}: {
  task: TaskRead;
  onAction: () => void;
}) {
  const [updateBody, setUpdateBody] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handlePostUpdate = () =>
    handleAction(async () => {
      await postUpdate(task.id, updateBody);
      setUpdateBody("");
    });

  const handleMarkComplete = () =>
    handleAction(async () => {
      await patchTask(task.id, { ...(evidence ? { evidence } : {}), status: "review" });
      setEvidence("");
    });

  return (
    <>
      {error && <p className="admin-error">{error}</p>}

      {task.status === "ideation" && (
        <>
          <button
            className="btn btn-accept"
            disabled={busy}
            onClick={() => handleAction(() => patchTask(task.id, { status: "proposed" }))}
          >
            {busy ? <Spinner /> : "Move to Proposed"}
          </button>
          <button
            className="btn btn-decline"
            disabled={busy}
            onClick={() => handleAction(() => patchTask(task.id, { status: "declined" }))}
          >
            {busy ? <Spinner /> : "Decline"}
          </button>
        </>
      )}

      {task.status === "proposed" && (
        <>
          <button
            className="btn btn-accept"
            disabled={busy}
            onClick={() => handleAction(() => patchTask(task.id, { status: "underway" }))}
          >
            {busy ? <Spinner /> : "Accept"}
          </button>
          <button
            className="btn btn-decline"
            disabled={busy}
            onClick={() => handleAction(() => patchTask(task.id, { status: "declined" }))}
          >
            {busy ? <Spinner /> : "Decline"}
          </button>
        </>
      )}

      {task.status === "underway" && (
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
              {busy ? <><Spinner /> Posting...</> : "Post Update"}
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
              {busy ? <><Spinner /> Completing...</> : "Mark Complete"}
            </button>
          </div>

          <button
            className="btn btn-decline"
            disabled={busy}
            onClick={() => handleAction(() => patchTask(task.id, { status: "proposed" }))}
          >
            {busy ? <Spinner /> : "Abandon"}
          </button>
        </>
      )}

      {task.status === "review" && (
        <p>
          Review started{" "}
          {task.review_at
            ? new Date(task.review_at).toLocaleDateString()
            : "—"}
        </p>
      )}
    </>
  );
}
