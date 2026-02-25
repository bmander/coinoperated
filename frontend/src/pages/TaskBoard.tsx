import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listTasks } from "../api/tasks";
import type { TaskRead, TaskStatus } from "../api/types";
import TaskCard from "../components/TaskCard";

type SortOption = "most_pledged" | "newest" | "oldest";

const SORT_MAP: Record<SortOption, { sort_by: "pledge_total" | "created_at"; sort_order: "asc" | "desc" }> = {
  most_pledged: { sort_by: "pledge_total", sort_order: "desc" },
  newest: { sort_by: "created_at", sort_order: "desc" },
  oldest: { sort_by: "created_at", sort_order: "asc" },
};

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "collecting", label: "Collecting" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("most_pledged");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const fetchId = useRef(0);

  useEffect(() => {
    const id = ++fetchId.current;
    let cancelled = false;

    const { sort_by, sort_order } = SORT_MAP[sort];
    listTasks({
      sort_by,
      sort_order,
      status: statusFilter || undefined,
    })
      .then((data) => {
        if (!cancelled && fetchId.current === id) {
          setTasks(data.items);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && fetchId.current === id) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [sort, statusFilter]);

  return (
    <div className="task-board">
      <p className="tagline">Infrastructure tasks, funded by people who care.</p>
      <hr />

      <div className="controls">
        <label>
          Sort:{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
            <option value="most_pledged">Most Pledged</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
        <label>
          Filter:{" "}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="board-message">Loading tasks...</p>}
      {error && <p className="board-message board-error">Error: {error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="board-message">No tasks found.</p>
      )}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <div className="board-footer">
        <Link to="/submit" className="btn btn-primary">Submit a Task</Link>
      </div>
    </div>
  );
}
