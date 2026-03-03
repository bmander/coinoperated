export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');
export const API_BASE = `${BASE_PATH}/api`;

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init ? await fetch(url, init) : await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchVoid(url: string, init?: RequestInit): Promise<void> {
  const res = init ? await fetch(url, init) : await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `HTTP ${res.status}`);
  }
}
