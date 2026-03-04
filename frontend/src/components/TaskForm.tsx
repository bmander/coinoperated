import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import MarkdownField from "./MarkdownField";
import Spinner from "./Spinner";

export function TaskFormFields({
  title,
  setTitle,
  description,
  setDescription,
  criteria,
  setCriteria,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  criteria: string;
  setCriteria: (v: string) => void;
}) {
  return (
    <>
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

      <MarkdownField
        id="description"
        label="Description *"
        value={description}
        onChange={setDescription}
        placeholder="Full description of the task (Markdown supported)"
        required
        rows={8}
      />

      <MarkdownField
        id="criteria"
        label="Delivery Criteria"
        value={criteria}
        onChange={setCriteria}
        placeholder='What does "done" look like? (Markdown supported)'
        rows={4}
      />
    </>
  );
}

export default function TaskForm({
  initialTitle = "",
  initialDescription = "",
  initialCriteria = "",
  onSubmit,
  submitLabel = "Submit Task",
  submittingLabel = "Submitting...",
}: {
  initialTitle?: string;
  initialDescription?: string;
  initialCriteria?: string;
  onSubmit: (data: { title: string; description: string; criteria: string | undefined }) => Promise<string>;
  submitLabel?: string;
  submittingLabel?: string;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [criteria, setCriteria] = useState(initialCriteria);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const redirectTo = await onSubmit({
        title: title.trim(),
        description: description.trim(),
        criteria: criteria.trim() || undefined,
      });
      navigate(redirectTo);
    } catch {
      setError("Failed to submit task. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="submit-task-form">
      <TaskFormFields
        title={title} setTitle={setTitle}
        description={description} setDescription={setDescription}
        criteria={criteria} setCriteria={setCriteria}
      />

      {error && <p className="form-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting}
      >
        {submitting ? <><Spinner /> {submittingLabel}</> : submitLabel}
      </button>
    </form>
  );
}
