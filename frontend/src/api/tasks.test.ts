import { listTasks } from "./tasks";

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
