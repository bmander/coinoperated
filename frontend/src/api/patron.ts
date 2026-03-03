import { API_BASE } from "./client";
import type { EmailPreference, NotificationRead, NotificationType, PatronPledgeRead, PatronProfileRead, SavedPaymentMethod } from "./types";

export async function fetchMyPledges(): Promise<PatronPledgeRead[]> {
  const res = await fetch(`${API_BASE}/patron/pledges`);
  if (!res.ok) throw new Error(`Failed to fetch pledges: ${res.status}`);
  return res.json();
}

export async function fetchMyNotifications(): Promise<NotificationRead[]> {
  const res = await fetch(`${API_BASE}/patron/notifications`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

export async function fetchPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const res = await fetch(`${API_BASE}/patron/payment-methods`);
  if (!res.ok) throw new Error(`Failed to fetch payment methods: ${res.status}`);
  return res.json();
}

export async function getPatron(patronId: string): Promise<PatronProfileRead> {
  const res = await fetch(`${API_BASE}/patrons/${patronId}`);
  if (res.status === 404) throw new Error("Patron not found");
  if (!res.ok) throw new Error(`Failed to fetch patron: ${res.status}`);
  return res.json();
}

export async function deletePaymentMethod(pmId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/patron/payment-methods/${pmId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `Failed to delete payment method: ${res.status}`);
  }
}

export async function fetchEmailPreferences(): Promise<EmailPreference[]> {
  const res = await fetch(`${API_BASE}/patron/email-preferences`);
  if (!res.ok) throw new Error(`Failed to fetch email preferences: ${res.status}`);
  return res.json();
}

export async function updateEmailPreferences(
  preferences: Partial<Record<NotificationType, boolean>>
): Promise<EmailPreference[]> {
  const res = await fetch(`${API_BASE}/patron/email-preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
  });
  if (!res.ok) throw new Error(`Failed to update email preferences: ${res.status}`);
  return res.json();
}
