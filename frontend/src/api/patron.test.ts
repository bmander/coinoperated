import { fetchMyPledges, fetchMyNotifications, fetchPaymentMethods, getPatron, deletePaymentMethod, fetchEmailPreferences, updateEmailPreferences } from "./patron";

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
      json: () => Promise.reject(),
    } as Response);

    await expect(fetchMyPledges()).rejects.toThrow("HTTP 401");
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
      json: () => Promise.reject(),
    } as Response);

    await expect(fetchMyNotifications()).rejects.toThrow("HTTP 500");
  });
});

describe("fetchPaymentMethods", () => {
  it("fetches from /api/patron/payment-methods", async () => {
    const mockData = [{ id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchPaymentMethods();
    expect(fetch).toHaveBeenCalledWith("/api/patron/payment-methods");
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.reject(),
    } as Response);

    await expect(fetchPaymentMethods()).rejects.toThrow("HTTP 401");
  });
});

describe("getPatron", () => {
  it("fetches patron by id", async () => {
    const patron = { id: "p1", display_name: "Alice", pledge_total: 5000 };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(patron),
    } as Response);

    const result = await getPatron("p1");
    expect(fetch).toHaveBeenCalledWith("/api/patrons/p1");
    expect(result).toEqual(patron);
  });

  it("throws 'Patron not found' on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(getPatron("p1")).rejects.toThrow("Patron not found");
  });

  it("throws on other error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(getPatron("p1")).rejects.toThrow("Failed to fetch patron: 500");
  });
});

describe("deletePaymentMethod", () => {
  it("sends DELETE to /api/patron/payment-methods/{id}", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 204,
    } as Response);

    await deletePaymentMethod("pm_123");
    expect(fetch).toHaveBeenCalledWith("/api/patron/payment-methods/pm_123", {
      method: "DELETE",
    });
  });

  it("throws with detail on error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: "Payment method is in use by an active pledge" }),
    } as Response);

    await expect(deletePaymentMethod("pm_123")).rejects.toThrow(
      "Payment method is in use by an active pledge",
    );
  });
});

describe("fetchEmailPreferences", () => {
  it("fetches from /api/patron/email-preferences", async () => {
    const mockData = [{ notification_type: "task_accepted", enabled: true }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchEmailPreferences();
    expect(fetch).toHaveBeenCalledWith("/api/patron/email-preferences");
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.reject(),
    } as Response);

    await expect(fetchEmailPreferences()).rejects.toThrow("HTTP 401");
  });
});

describe("updateEmailPreferences", () => {
  it("sends PUT with preferences payload", async () => {
    const mockData = [{ notification_type: "task_accepted", enabled: false }];
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await updateEmailPreferences({ task_accepted: false });
    expect(fetch).toHaveBeenCalledWith("/api/patron/email-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { task_accepted: false } }),
    });
    expect(result).toEqual(mockData);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(),
    } as Response);

    await expect(updateEmailPreferences({ task_accepted: false })).rejects.toThrow(
      "HTTP 500",
    );
  });
});
