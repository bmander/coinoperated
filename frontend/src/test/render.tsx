import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { AuthProvider } from "../contexts/AuthContext";

export function renderWithRouter(ui: ReactElement, initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>,
  );
}

export function renderWithAuth(ui: ReactElement, initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
  );
}
