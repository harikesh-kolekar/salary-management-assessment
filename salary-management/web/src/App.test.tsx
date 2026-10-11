import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const employee = {
  id: 1, employee_number: "ACME-00001", first_name: "Avery", last_name: "Kim", full_name: "Avery Kim",
  email: "employee00001@example.test", country_code: "US", department: "Engineering", job_title: "Engineer",
  status: "active" as const, hired_on: "2022-01-01",
  current_salary: { id: 1, amount: 95000, currency: "USD", effective_from: "2025-01-01", reason: "Annual review" },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

  it("edits employee country, status, and department from the profile", async () => {
    let current = { ...employee, salary_history: [employee.current_salary] };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/employees/1" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)).employee;
        current = { ...current, ...body, full_name: `${body.first_name} ${body.last_name}` };
        return new Response(JSON.stringify({ data: current }), { status: 200 });
      }
      if (url === "/api/v1/employees/1") return new Response(JSON.stringify({ data: current }), { status: 200 });
      if (url.startsWith("/api/v1/employees")) {
        return new Response(JSON.stringify({ data: [current], meta: { page: 1, per_page: 25, total: 1, total_pages: 1 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 1, employee_count: 1, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByText("Avery Kim"));
    await screen.findByRole("dialog", { name: "Avery Kim profile" });
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    await screen.findByRole("dialog", { name: "Edit employee details" });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "GB" } });
    fireEvent.change(screen.getByLabelText("Employee status"), { target: { value: "leave" } });
    expect(screen.getByLabelText("Department").tagName).toBe("SELECT");
    expect(within(screen.getByLabelText("Department")).getByRole("option", { name: "Engineering" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "Legal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save employee" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/employees/1", expect.objectContaining({ method: "PATCH" })));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit employee details" })).not.toBeInTheDocument());
    const profile = within(screen.getByRole("dialog", { name: "Avery Kim profile" }));
    expect(profile.getByText("On leave")).toBeInTheDocument();
    expect(profile.getByText("United Kingdom (GB)")).toBeInTheDocument();
    expect(profile.getByText("Legal")).toBeInTheDocument();
  });

  it("creates an employee and opens the new profile", async () => {
    let created: (typeof employee & { salary_history: never[] }) | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/employees" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)).employee;
        created = { ...employee, ...body, id: 2, full_name: `${body.first_name} ${body.last_name}`, current_salary: null, salary_history: [] };
        return new Response(JSON.stringify({ data: created }), { status: 201 });
      }
      if (url === "/api/v1/employees/2") return new Response(JSON.stringify({ data: created }), { status: 200 });
      if (url.startsWith("/api/v1/employees")) {
        return new Response(JSON.stringify({ data: created ? [created] : [employee], meta: { page: 1, per_page: 25, total: created ? 2 : 1, total_pages: 1 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 1, employee_count: 1, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add employee" }));
    await screen.findByRole("dialog", { name: "Add employee" });
    fireEvent.change(screen.getByLabelText("Employee number"), { target: { value: "ACME-NEW-2" } });
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Iris" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Wong" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "iris.wong@example.test" } });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "SG" } });
    expect(screen.getByLabelText("Department").tagName).toBe("SELECT");
    expect(within(screen.getByLabelText("Department")).getByRole("option", { name: "Engineering" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "Legal" } });
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Counsel" } });
    fireEvent.click(screen.getByRole("button", { name: "Create employee" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/employees", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByRole("dialog", { name: "Iris Wong profile" })).toBeInTheDocument();
    expect(screen.getByText("No salary record")).toBeInTheDocument();
  });
});
