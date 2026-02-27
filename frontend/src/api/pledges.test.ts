import { createPledge, getMyPledge, updatePledge, deletePledge } from "./pledges";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

afterEach(() => {
  mockFetch.mockReset();
});

describe("createPledge", () => {
  it("posts amount to /api/tasks/{taskId}/pledges", async () => {
    const body = { pledge_id: "p1", client_secret: "cs_123", publishable_key: "pk_test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    });

    const result = await createPledge("task-1", 500);
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 500 }),
    });
    expect(result).toEqual(body);
  });

  it("includes payment_method_id when provided", async () => {
    const body = { pledge_id: "p1", client_secret: null, publishable_key: "pk_test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    });

    await createPledge("task-1", 500, { paymentMethodId: "pm_saved_123" });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 500, payment_method_id: "pm_saved_123" }),
    });
  });

  it("includes save_card when provided", async () => {
    const body = { pledge_id: "p1", client_secret: "cs_123", publishable_key: "pk_test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    });

    await createPledge("task-1", 500, { saveCard: false });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 500, save_card: false }),
    });
  });

  it("throws with detail from error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "You already have a pledge on this task" }),
    });

    await expect(createPledge("task-1", 500)).rejects.toThrow(
      "You already have a pledge on this task",
    );
  });

  it("throws with fallback message when response has no detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(createPledge("task-1", 500)).rejects.toThrow(
      "Failed to create pledge: 500",
    );
  });
});

describe("getMyPledge", () => {
  it("returns pledge data on success", async () => {
    const pledge = { id: "p1", amount: 1000, status: "active", created_at: "2025-01-01T00:00:00Z" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(pledge),
    });

    const result = await getMyPledge("task-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges/me");
    expect(result).toEqual(pledge);
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await getMyPledge("task-1");
    expect(result).toBeNull();
  });

  it("throws on other error status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(getMyPledge("task-1")).rejects.toThrow("Failed to fetch pledge: 500");
  });
});

describe("updatePledge", () => {
  it("patches amount to /api/tasks/{taskId}/pledges/me", async () => {
    const body = { pledge_id: "p1", client_secret: "cs_new", publishable_key: "pk_test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    });

    const result = await updatePledge("task-1", 2500);
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 2500 }),
    });
    expect(result).toEqual(body);
  });

  it("throws with detail from error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: "No pledge found" }),
    });

    await expect(updatePledge("task-1", 2500)).rejects.toThrow("No pledge found");
  });

  it("throws with fallback message when response has no detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(updatePledge("task-1", 2500)).rejects.toThrow(
      "Failed to update pledge: 500",
    );
  });
});

describe("deletePledge", () => {
  it("sends DELETE to /api/tasks/{taskId}/pledges/me", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 204 });

    await deletePledge("task-1");
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/task-1/pledges/me", {
      method: "DELETE",
    });
  });

  it("throws on non-204 error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(deletePledge("task-1")).rejects.toThrow("Failed to cancel pledge: 500");
  });
});
