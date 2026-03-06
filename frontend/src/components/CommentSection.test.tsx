import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentSection from "./CommentSection";
import { createComment } from "../api/comments";
import { makeComment } from "../test/factories";
import { renderWithRouter } from "../test/render";

vi.mock("../api/comments");
const mockCreateComment = vi.mocked(createComment);

const mockUseAuth = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CommentSection", () => {
  it("shows empty state when no comments", () => {
    mockUseAuth.mockReturnValue({ patron: null, loading: false });
    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });

  it("renders comments with author and body", () => {
    mockUseAuth.mockReturnValue({ patron: null, loading: false });
    const comments = [
      makeComment({ id: "c1", body: "First comment", author: { id: "p1", display_name: "Alice", created_at: "2025-01-01T00:00:00Z" } }),
      makeComment({ id: "c2", body: "Second comment", author: { id: "p2", display_name: null, created_at: "2025-01-01T00:00:00Z" } }),
    ];
    renderWithRouter(
      <CommentSection taskId="t1" comments={comments} onComment={vi.fn()} />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("hides comment form when not logged in", () => {
    mockUseAuth.mockReturnValue({ patron: null, loading: false });
    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );
    expect(screen.queryByPlaceholderText(/add a comment/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post Comment" })).not.toBeInTheDocument();
  });

  it("shows comment form when logged in", () => {
    mockUseAuth.mockReturnValue({ patron: { id: "p1" }, loading: false });
    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Comment" })).toBeInTheDocument();
  });

  it("disables submit button when textarea is empty", () => {
    mockUseAuth.mockReturnValue({ patron: { id: "p1" }, loading: false });
    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Post Comment" })).toBeDisabled();
  });

  it("submits a comment and calls onComment", async () => {
    const onComment = vi.fn();
    mockUseAuth.mockReturnValue({ patron: { id: "p1" }, loading: false });
    mockCreateComment.mockResolvedValue(makeComment({ body: "New comment" }));

    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={onComment} />,
    );

    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), "New comment");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalledWith("t1", "New comment");
    });
    expect(onComment).toHaveBeenCalled();
    // Textarea should be cleared
    expect(screen.getByPlaceholderText(/add a comment/i)).toHaveValue("");
  });

  it("shows error when comment submission fails", async () => {
    mockUseAuth.mockReturnValue({ patron: { id: "p1" }, loading: false });
    mockCreateComment.mockRejectedValue(new Error("Failed to post"));

    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), "Bad comment");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to post")).toBeInTheDocument();
    });
  });

  it("shows Posting... while submitting", async () => {
    mockUseAuth.mockReturnValue({ patron: { id: "p1" }, loading: false });
    mockCreateComment.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRouter(
      <CommentSection taskId="t1" comments={[]} onComment={vi.fn()} />,
    );

    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), "A comment");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Posting..." })).toBeDisabled();
    });
  });

  it("links author name to patron profile", () => {
    mockUseAuth.mockReturnValue({ patron: null, loading: false });
    const comments = [
      makeComment({ author: { id: "patron-42", display_name: "Bob", created_at: "2025-01-01T00:00:00Z" } }),
    ];
    renderWithRouter(
      <CommentSection taskId="t1" comments={comments} onComment={vi.fn()} />,
    );
    const link = screen.getByRole("link", { name: "Bob" });
    expect(link).toHaveAttribute("href", "/patrons/patron-42");
  });
});
