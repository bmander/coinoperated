import { API_BASE } from "./client";
import type { PatronMe } from "./types";

export interface LoginResponse {
  message: string;
  magic_token?: string;
}

export async function login(email: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

export async function fetchMe(): Promise<PatronMe | null> {
  const res = await fetch(`${API_BASE}/auth/me`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
  if (!res.ok) throw new Error(`Logout failed: ${res.status}`);
}
