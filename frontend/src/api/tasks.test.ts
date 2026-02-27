import { listTasks, createTask } from "./tasks";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("listTasks", () => {
  it("calls /api/tasks with no params by default", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0, offset: 0, limit: 20 }),
    });

    await listTasks();
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks");
  });

  it("builds query string from params", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0, offset: 0, limit: 20 }),
    });

    await listTasks({ status: "open", sort_by: "pledge_total", sort_order: "desc", offset: 10, limit: 5 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/tasks?");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("status")).toBe("open");
    expect(params.get("sort_by")).toBe("pledge_total");
    expect(params.get("sort_order")).toBe("desc");
    expect(params.get("offset")).toBe("10");
    expect(params.get("limit")).toBe("5");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(listTasks()).rejects.toThrow("Failed to fetch tasks: 500");
  });
});

describe("createTask", () => {
  it("sends POST with JSON body", async () => {
    const task = { id: "new-1", title: "New task", status: "open" };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(task),
    });

    const result = await createTask({ title: "New task", description: "Details" });

    expect(mockFetch).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New task", description: "Details" }),
    });
    expect(result).toEqual(task);
  });

  it("includes criteria when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({}),
    });

    await createTask({ title: "Task", description: "Desc", criteria: "Ship it" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.criteria).toBe("Ship it");
  });

  it("throws on 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(createTask({ title: "T", description: "D" })).rejects.toThrow("Not authenticated");
  });

  it("throws on 403 with suspension message", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(createTask({ title: "T", description: "D" })).rejects.toThrow("Your account has been suspended");
  });

  it("throws on other errors", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(createTask({ title: "T", description: "D" })).rejects.toThrow("Failed to create task: 500");
  });
});
