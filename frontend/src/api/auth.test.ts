import { login, fetchMe, logout } from "./auth";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("login", () => {
  it("posts email to /api/auth/login", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Check your email" }),
    });

    const result = await login("test@example.com");
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
    expect(result).toEqual({ message: "Check your email" });
  });

  it("returns magic_token when staging", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: "Check your email",
        magic_token: "abc123",
      }),
    });

    const result = await login("test@example.com");
    expect(result.magic_token).toBe("abc123");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject() });

    await expect(login("test@example.com")).rejects.toThrow("HTTP 500");
  });
});

describe("fetchMe", () => {
  it("returns patron data on success", async () => {
    const patron = { id: "1", email: "a@b.com", display_name: null, is_admin: false };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(patron),
    });

    const result = await fetchMe();
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result).toEqual(patron);
  });

  it("returns null on 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const result = await fetchMe();
    expect(result).toBeNull();
  });

  it("throws on other error status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(fetchMe()).rejects.toThrow("Failed to fetch profile: 500");
  });
});

describe("logout", () => {
  it("posts to /api/auth/logout", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await logout();
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject() });

    await expect(logout()).rejects.toThrow("HTTP 500");
  });
});
