import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { createTask } from "../api/tasks";

type PreviewField = "description" | "criteria" | null;

export default function SubmitTask() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [preview, setPreview] = useState<PreviewField>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim(),
        criteria: criteria.trim() || undefined,
      });
      navigate(`/tasks/${task.id}`);
    } catch {
      setError("Failed to submit task. Please try again.");
      setSubmitting(false);
    }
  }

  function togglePreview(field: PreviewField) {
    setPreview((prev) => (prev === field ? null : field));
  }

  return (
    <div className="submit-task-page">
      <h1>Submit a Task</h1>
      <p className="submit-task-intro">
        Propose a task for Brandon to work on. Describe what you'd like done and
        what "done" looks like.
      </p>

      {error && <p className="submit-task-error">{error}</p>}

      <form onSubmit={handleSubmit} className="submit-task-form">
        <div className="form-field">
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short, descriptive title"
            required
            maxLength={500}
          />
        </div>

        <div className="form-field">
          <div className="form-field-header">
            <label htmlFor="description">Description *</label>
            <button
              type="button"
              className="preview-toggle"
              onClick={() => togglePreview("description")}
            >
              {preview === "description" ? "Edit" : "Preview"}
            </button>
          </div>
          {preview === "description" ? (
            <div className="markdown-preview markdown-body">
              {description ? (
                <ReactMarkdown>{description}</ReactMarkdown>
              ) : (
                <p className="preview-empty">Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full description of the task (Markdown supported)"
              required
              rows={8}
            />
          )}
        </div>

        <div className="form-field">
          <div className="form-field-header">
            <label htmlFor="criteria">Delivery Criteria</label>
            <button
              type="button"
              className="preview-toggle"
              onClick={() => togglePreview("criteria")}
            >
              {preview === "criteria" ? "Edit" : "Preview"}
            </button>
          </div>
          {preview === "criteria" ? (
            <div className="markdown-preview markdown-body">
              {criteria ? (
                <ReactMarkdown>{criteria}</ReactMarkdown>
              ) : (
                <p className="preview-empty">Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              id="criteria"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="What does &quot;done&quot; look like? (Markdown supported)"
              rows={4}
            />
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Task"}
        </button>
      </form>
    </div>
  );
}
