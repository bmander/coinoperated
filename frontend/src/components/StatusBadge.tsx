import type { TaskStatus } from "../api/types";
import { statusLabel } from "../utils/formatting";

export default function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status === "accepted" && "\u2605 "}
      {statusLabel(status)}
    </span>
  );
}
