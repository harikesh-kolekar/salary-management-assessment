import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const employee = {
  id: 1, employee_number: "ACME-00001", first_name: "Avery", last_name: "Kim", full_name: "Avery Kim",
  email: "employee00001@example.test", country_code: "US", department: "Engineering", job_title: "Engineer",
  status: "active" as const, hired_on: "2022-01-01",
  current_salary: { id: 1, amount: 95000, currency: "USD", effective_from: "2025-01-01", reason: "Annual review" },
};

afterEach(() => vi.unstubAllGlobals());

describe("salary management workspace", () => {
  it("shows directory data from the API and supports employee search", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/v1/employees")) {
        const filtered = url.includes("q=ACME-00001");
        return new Response(JSON.stringify({ data: filtered ? [employee] : [employee], meta: { page: 1, per_page: 25, total: 1, total_pages: 1 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 1, employee_count: 1, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(await screen.findByText("Avery Kim")).toBeInTheDocument();
    expect(screen.getByText(/95,000/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search employees" }), { target: { value: "ACME-00001" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=ACME-00001"), expect.anything()));
  });
});
