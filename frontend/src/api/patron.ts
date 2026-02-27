import type { NotificationRead, PatronPledgeRead, SavedPaymentMethod } from "./types";

export async function fetchMyPledges(): Promise<PatronPledgeRead[]> {
  const res = await fetch("/api/patron/pledges");
  if (!res.ok) throw new Error(`Failed to fetch pledges: ${res.status}`);
  return res.json();
}

export async function fetchMyNotifications(): Promise<NotificationRead[]> {
  const res = await fetch("/api/patron/notifications");
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

export async function fetchPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const res = await fetch("/api/patron/payment-methods");
  if (!res.ok) throw new Error(`Failed to fetch payment methods: ${res.status}`);
  return res.json();
}

export async function deletePaymentMethod(pmId: string): Promise<void> {
  const res = await fetch(`/api/patron/payment-methods/${pmId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `Failed to delete payment method: ${res.status}`);
  }
}
