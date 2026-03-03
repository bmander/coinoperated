import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ConfirmModal from "./ConfirmModal";

const defaults = {
  title: "Delete item?",
  description: "This cannot be undone.",
  confirmLabel: "Yes, delete",
  confirmingLabel: "Deleting...",
};

describe("ConfirmModal", () => {
  it("renders title, description, and buttons", () => {
    render(
      <ConfirmModal
        {...defaults}
        onConfirm={async () => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        {...defaults}
        onConfirm={async () => {}}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmModal
        {...defaults}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it("shows confirming label while onConfirm is in progress", async () => {
    let resolve: () => void;
    const onConfirm = () => new Promise<void>((r) => { resolve = r; });

    render(
      <ConfirmModal
        {...defaults}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(screen.getByText("Deleting...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    resolve!();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Yes, delete" })).toBeEnabled();
    });
  });

  it("shows error message when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Network error"));
    render(
      <ConfirmModal
        {...defaults}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeEnabled();
  });

  it("shows generic error for non-Error rejections", async () => {
    const onConfirm = vi.fn().mockRejectedValue("unknown");
    render(
      <ConfirmModal
        {...defaults}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
