import { Link } from "react-router-dom";
import { listTasks } from "../api/tasks";
import type { TaskStatus } from "../api/types";
import TaskCard from "../components/TaskCard";
import useFetch from "../hooks/useFetch";
import { useState, useCallback } from "react";

type SortOption = "most_pledged" | "newest" | "oldest";

const SORT_MAP: Record<SortOption, { sort_by: "pledge_total" | "created_at"; sort_order: "asc" | "desc" }> = {
  most_pledged: { sort_by: "pledge_total", sort_order: "desc" },
  newest: { sort_by: "created_at", sort_order: "desc" },
  oldest: { sort_by: "created_at", sort_order: "asc" },
};

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "proposed", label: "Proposed" },
  { value: "underway", label: "Underway" },
  { value: "collecting", label: "Collecting" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

export default function TaskBoard() {
  const [sort, setSort] = useState<SortOption>("most_pledged");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { sort_by, sort_order } = SORT_MAP[sort];
  const { data, loading, error } = useFetch(
    () => listTasks({ sort_by, sort_order, status: statusFilter || undefined }),
    [sort, statusFilter, refreshKey],
  );

  const handlePledge = useCallback(() => setRefreshKey((k) => k + 1), []);

  const tasks = data?.items ?? [];

  return (
    <div className="task-board">
      <p className="tagline">Group fund a universal fix-it man. <Link to="/how-it-works">How this works</Link></p>
      <hr />

      <div className="controls">
        <Link to="/tasks/new" className="btn btn-primary">Submit a Task</Link>
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

      {loading && <p className="page-message">Loading tasks...</p>}
      {error && <p className="page-message page-error">Error: {error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p className="page-message">No tasks found.</p>
      )}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onPledge={handlePledge} />
        ))}
      </div>

    </div>
  );
}
