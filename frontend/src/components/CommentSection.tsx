import { useState } from "react";
import Markdown from "react-markdown";
import { createComment } from "../api/comments";
import type { CommentRead } from "../api/types";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../utils/formatting";
import { Link } from "react-router-dom";

export default function CommentSection({
  taskId,
  comments,
  onComment,
}: {
  taskId: string;
  comments: CommentRead[];
  onComment: () => void;
}) {
  const { patron } = useAuth();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      await createComment(taskId, body.trim());
      setBody("");
      onComment();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="task-detail-section">
      <h2>Comments</h2>

      {comments.length === 0 && <p className="page-message">No comments yet.</p>}

      <ul className="comments-list">
        {comments.map((comment) => (
          <li key={comment.id} className="comment-item">
            <div className="comment-meta">
              <Link to={`/patrons/${comment.author.id}`} className="comment-author">
                {comment.author.display_name ?? "Anonymous"}
              </Link>
              <time className="comment-date">
                {new Date(comment.created_at).toLocaleDateString()}
              </time>
            </div>
            <div className="markdown-body">
              <Markdown>{comment.body}</Markdown>
            </div>
          </li>
        ))}
      </ul>

      {patron && (
        <form onSubmit={handleSubmit} className="comment-form">
          <textarea
            className="comment-textarea"
            placeholder="Add a comment (Markdown supported)..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          {error && <p className="form-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </form>
      )}
    </section>
  );
}
