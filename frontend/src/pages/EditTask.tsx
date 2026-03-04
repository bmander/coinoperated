import { useParams, Link } from "react-router-dom";
import { getTask } from "../api/tasks";
import { patchTask } from "../api/admin";
import TaskForm from "../components/TaskForm";
import useFetch from "../hooks/useFetch";

export default function EditTask() {
  const { taskId } = useParams<{ taskId: string }>();
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
      <TaskForm
        initialTitle={task.title}
        initialDescription={task.description}
        initialCriteria={task.criteria ?? ""}
        submitLabel="Save Changes"
        submittingLabel="Saving..."
        onSubmit={async (data) => {
          await patchTask(task.id, {
            title: data.title,
            description: data.description,
            criteria: data.criteria ?? null,
          });
          return `/tasks/${task.id}`;
        }}
      />
    </div>
  );
}
