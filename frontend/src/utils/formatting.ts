export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function statusLabel(status: string): string {
  return status.toUpperCase();
}

export function formatBackers(count: number): string {
  return `${count} ${count === 1 ? "backer" : "backers"}`;
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return err instanceof Error ? err.message : fallback;
}
