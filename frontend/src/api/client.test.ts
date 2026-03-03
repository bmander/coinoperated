import { fetchJson, fetchVoid } from "./client";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("fetchJson", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    const result = await fetchJson("/api/test");
    expect(mockFetch).toHaveBeenCalledWith("/api/test");
    expect(result).toEqual({ id: 1 });
  });

  it("passes RequestInit to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await fetchJson("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });
  });

  it("throws with detail from error response body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Bad request data" }),
    });

    await expect(fetchJson("/api/test")).rejects.toThrow("Bad request data");
  });

  it("throws with HTTP status when error body has no detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(fetchJson("/api/test")).rejects.toThrow("HTTP 500");
  });
});

describe("fetchVoid", () => {
  it("resolves on success", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await expect(fetchVoid("/api/test", { method: "DELETE" })).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith("/api/test", { method: "DELETE" });
  });

  it("throws with detail from error response body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: "Conflict" }),
    });

    await expect(fetchVoid("/api/test")).rejects.toThrow("Conflict");
  });

  it("throws with HTTP status when error body has no detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.reject(),
    });

    await expect(fetchVoid("/api/test")).rejects.toThrow("HTTP 403");
  });
});
