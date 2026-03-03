export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '');
export const API_BASE = `${BASE_PATH}/api`;

async function checkedFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = init ? await fetch(url, init) : await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `HTTP ${res.status}`);
  }
  return res;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await checkedFetch(url, init);
  return res.json();
}

export async function fetchVoid(url: string, init?: RequestInit): Promise<void> {
  await checkedFetch(url, init);
}
