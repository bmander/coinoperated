import { useParams } from "react-router-dom";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  return (
    <div>
      <h2>Task Detail</h2>
      <p>Task ID: {taskId}</p>
      <p>Detail view coming soon.</p>
    </div>
  );
}
