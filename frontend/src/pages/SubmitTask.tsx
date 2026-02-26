import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createTask } from "../api/tasks";
import MarkdownField from "../components/MarkdownField";

export default function SubmitTask() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
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

  return (
    <div className="submit-task-page">
      <h1>Submit a Task</h1>
      <p className="submit-task-intro">
        Propose a task for Brandon to work on. Describe what you'd like done and
        what "done" looks like.
      </p>

      {error && <p className="form-error">{error}</p>}

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
