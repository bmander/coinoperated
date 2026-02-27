import { fetchMyPledges, fetchMyNotifications } from "./patron";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchMyPledges", () => {
  it("fetches pledges from /api/patron/pledges", async () => {
    const mockData = [{ id: "p1", amount: 1000 }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchMyPledges();
    expect(fetch).toHaveBeenCalledWith("/api/patron/pledges");
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(fetchMyPledges()).rejects.toThrow("Failed to fetch pledges: 401");
  });
});

describe("fetchMyNotifications", () => {
  it("fetches notifications from /api/patron/notifications", async () => {
    const mockData = [{ id: "n1", event: "task_accepted" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchMyNotifications();
    expect(fetch).toHaveBeenCalledWith("/api/patron/notifications");
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchMyNotifications()).rejects.toThrow("Failed to fetch notifications: 500");
  });
});
