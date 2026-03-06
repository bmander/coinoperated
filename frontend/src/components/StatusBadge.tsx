import { useState } from "react";
import type { TaskStatus } from "../api/types";
import { statusLabel } from "../utils/formatting";

const GLOSSARY: { status: TaskStatus; description: string }[] = [
  { status: "ideation", description: "Idea being shaped \u2014 not yet open for pledges" },
  { status: "proposed", description: "Proposed and waiting for review" },
  { status: "underway", description: "Work has begun" },
  { status: "review", description: "Complete \u2014 pledgers reviewing work" },
  { status: "collecting", description: "Review done \u2014 payments being collected" },
  { status: "completed", description: "Done and fully paid out" },
  { status: "declined", description: "Won\u2019t be worked on; pledges released" },
];

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className={`status-badge status-${status}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {status === "underway" && "\u2605 "}
      {statusLabel(status)}
      {show && (
        <div className="status-glossary">
          {GLOSSARY.map((entry) => (
            <div
              key={entry.status}
              className={`status-glossary-row${entry.status === status ? " status-glossary-active" : ""}`}
            >
              <span className={`status-badge status-${entry.status}`}>
                {statusLabel(entry.status)}
              </span>
              <span className="status-glossary-desc">{entry.description}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
