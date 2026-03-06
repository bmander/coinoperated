import { createTask } from "../api/tasks";
import TaskForm from "../components/TaskForm";
import { useAuth } from "../contexts/AuthContext";

export default function SubmitTask() {
  const { patron } = useAuth();
  const isBanned = patron?.is_banned ?? false;

  if (isBanned) {
    return (
      <div className="submit-task-page">
        <h1>Submit a Task</h1>
        <p className="form-error">
          Your account has been suspended and you cannot submit new tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="submit-task-page">
      <h1>Submit a Task</h1>
      <p className="submit-task-intro">
        Propose an idea for Brandon to work on. Describe what you'd like done and
        what "done" looks like. Your task will start in ideation where you can
        refine it with community feedback before it opens for pledges.
      </p>
      <TaskForm
        onSubmit={async (data) => {
          const task = await createTask(data);
          return `/tasks/${task.id}`;
        }}
      />
    </div>
  );
}
