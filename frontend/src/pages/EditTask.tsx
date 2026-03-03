import { useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getTask } from "../api/tasks";
import { patchTask } from "../api/admin";
import { TaskFormFields } from "./SubmitTask";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";

export default function EditTask() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { data: task, loading, error: fetchError } = useFetch(
    () => getTask(taskId!),
    [taskId],
  );

  if (loading) return <p className="page-message">Loading task...</p>;
  if (fetchError) return <p className="page-message page-error">Error: {fetchError}</p>;
  if (!task) return null;

  return (
    <div className="submit-task-page">
      <Link to={`/tasks/${task.id}`} className="back-link">&larr; Back to task</Link>
      <h1>Edit Task</h1>
      <EditTaskForm
        taskId={task.id}
        initialTitle={task.title}
        initialDescription={task.description}
        initialCriteria={task.criteria ?? ""}
      />
    </div>
  );
}

function EditTaskForm({
  taskId,
  initialTitle,
  initialDescription,
  initialCriteria,
}: {
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  initialCriteria: string;
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
      await patchTask(taskId, {
        title: title.trim(),
        description: description.trim(),
        criteria: criteria.trim() || null,
      });
      navigate(`/tasks/${taskId}`);
    } catch {
      setError("Failed to save changes. Please try again.");
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
        {submitting ? <><Spinner /> Saving...</> : "Save Changes"}
      </button>
    </form>
  );
}
