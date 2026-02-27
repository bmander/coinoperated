import { banPatron, deleteTask, fetchAdminPatrons, fetchAdminTasks, patchTask, postUpdate, unbanPatron } from "./admin";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("fetchAdminTasks", () => {
  it("calls GET /api/admin/tasks", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });

    const result = await fetchAdminTasks();
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/tasks");
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(fetchAdminTasks()).rejects.toThrow("Failed to fetch admin tasks: 403");
  });
});

describe("patchTask", () => {
  it("sends PATCH with JSON body", async () => {
    const task = { id: "t1", status: "accepted" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(task),
    });

    const result = await patchTask("t1", { status: "accepted" });

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/t1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    expect(result).toEqual(task);
  });

  it("sends evidence in payload", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await patchTask("t1", { evidence: "Done!" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.evidence).toBe("Done!");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(patchTask("t1", { status: "completed" })).rejects.toThrow("Failed to update task: 400");
  });
});

describe("postUpdate", () => {
  it("sends POST with body", async () => {
    const update = { id: "u1", task_id: "t1", body: "Progress", created_at: "2025-01-01" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(update),
    });

    const result = await postUpdate("t1", "Progress");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/t1/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Progress" }),
    });
    expect(result).toEqual(update);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(postUpdate("t1", "hi")).rejects.toThrow("Failed to post update: 403");
  });
});

describe("fetchAdminPatrons", () => {
  it("calls GET /api/admin/patrons", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    });

    const result = await fetchAdminPatrons();
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/patrons");
    expect(result).toEqual({ items: [] });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(fetchAdminPatrons()).rejects.toThrow("Failed to fetch patrons: 403");
  });
});

describe("banPatron", () => {
  it("sends POST to ban endpoint", async () => {
    const patron = { id: "p1", email: "test@test.com", display_name: null, is_banned: true };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(patron),
    });

    const result = await banPatron("p1");
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/patrons/p1/ban", { method: "POST" });
    expect(result).toEqual(patron);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(banPatron("p1")).rejects.toThrow("Failed to ban patron: 404");
  });
});

describe("unbanPatron", () => {
  it("sends POST to unban endpoint", async () => {
    const patron = { id: "p1", email: "test@test.com", display_name: null, is_banned: false };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(patron),
    });

    const result = await unbanPatron("p1");
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/patrons/p1/unban", { method: "POST" });
    expect(result).toEqual(patron);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(unbanPatron("p1")).rejects.toThrow("Failed to unban patron: 404");
  });
});

describe("deleteTask", () => {
  it("sends DELETE to /api/tasks/:id", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await deleteTask("t1");

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/t1", {
      method: "DELETE",
    });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(deleteTask("t1")).rejects.toThrow("Failed to delete task: 404");
  });
});
