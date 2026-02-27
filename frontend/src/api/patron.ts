import type { NotificationRead, PatronPledgeRead } from "./types";

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
