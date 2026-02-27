import type { PledgeCreateResponse, PledgeMyResponse } from "./types";

export async function createPledge(
  taskId: string,
  amount: number,
  opts?: { paymentMethodId?: string; saveCard?: boolean },
): Promise<PledgeCreateResponse> {
  const body: Record<string, unknown> = { amount };
  if (opts?.paymentMethodId) body.payment_method_id = opts.paymentMethodId;
  if (opts?.saveCard !== undefined) body.save_card = opts.saveCard;

  const res = await fetch(`/api/tasks/${taskId}/pledges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `Failed to create pledge: ${res.status}`);
  }
  return res.json();
}

export async function getMyPledge(taskId: string): Promise<PledgeMyResponse | null> {
  const res = await fetch(`/api/tasks/${taskId}/pledges/me`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch pledge: ${res.status}`);
  return res.json();
}

export async function updatePledge(taskId: string, amount: number): Promise<PledgeCreateResponse> {
  const res = await fetch(`/api/tasks/${taskId}/pledges/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to update pledge: ${res.status}`);
  }
  return res.json();
}

export async function deletePledge(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/pledges/me`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to cancel pledge: ${res.status}`);
  }
}
