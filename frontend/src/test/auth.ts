import { vi } from "vitest";
import type { PatronMe } from "../api/types";

interface MockAuthOptions {
  patron?: PatronMe | null;
  loading?: boolean;
  login?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
}

export function mockAuth(options: MockAuthOptions = {}) {
  return {
    patron: options.patron ?? null,
    loading: options.loading ?? false,
    login: options.login ?? vi.fn(),
    logout: options.logout ?? vi.fn(),
  };
}
