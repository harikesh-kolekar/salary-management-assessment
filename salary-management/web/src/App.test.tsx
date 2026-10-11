import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sessionUser = { id: 1, full_name: "Jamie Davis", email: "manager@example.test", role: "manager" as const, organization: { id: 1, name: "ACME Corporation", slug: "acme-corporation" } };

const employee = {
  id: 1, employee_number: "ACME-00001", first_name: "Avery", last_name: "Kim", full_name: "Avery Kim",
  email: "employee00001@example.test", country_code: "US", department: "Engineering", job_title: "Engineer",
  status: "active" as const, hired_on: "2022-01-01",
  current_salary: { id: 1, amount: 95000, currency: "USD", effective_from: "2025-01-01", reason: "Annual review" },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("salary management workspace", () => {
  it("signs in a manager and opens their organization workspace", async () => {
    localStorage.clear();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/session" && init?.method === "POST") {
        return new Response(JSON.stringify({ token: "signed-in-token", user: sessionUser }), { status: 200 });
      }
      if (String(input).startsWith("/api/v1/employees")) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 });
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 0, employee_count: 0, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: sessionUser.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "testing-password" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[1]);

    expect(await screen.findByText("Employee directory")).toBeInTheDocument();
    expect(screen.getByText("ACME Corporation")).toBeInTheDocument();
    expect(localStorage.getItem("acme-salary-session-token")).toBe("signed-in-token");
  });

  it("registers an organization and its first manager", async () => {
    localStorage.clear();
    const registeredUser = { ...sessionUser, email: "hr@northwind.test", organization: { id: 7, name: "Northwind Legal", slug: "northwind-legal" } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/organizations" && init?.method === "POST") {
        return new Response(JSON.stringify({ token: "organization-token", user: registeredUser }), { status: 201 });
      }
      if (String(input).startsWith("/api/v1/employees")) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 });
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 0, employee_count: 0, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Northwind Legal" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jordan Lee" } });
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "hr@northwind.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "northwind-pass-123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "northwind-pass-123" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Create organization" })[1]);

    expect(await screen.findByText("Employee directory")).toBeInTheDocument();
    expect(screen.getByText("Northwind Legal")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url) === "/api/v1/organizations")?.[1]?.body)).organization).toMatchObject({ name: "Northwind Legal", manager_name: "Jordan Lee" });
  });

  it("shows directory data from the API and supports employee search", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "test-session-token", user: sessionUser }), { status: 200 });
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

  it("edits employee country, status, department, and job title from the profile", async () => {
    let current = { ...employee, salary_history: [employee.current_salary] };
    let updatePayload: Record<string, string> | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "test-session-token", user: sessionUser }), { status: 200 });
      if (url === "/api/v1/employees/1" && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)).employee;
        updatePayload = body;
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
    const departmentSelect = screen.getByLabelText("Department");
    expect(departmentSelect.tagName).toBe("SELECT");
    expect(within(departmentSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Engineering", "Finance", "People", "Sales", "Operations", "Legal", "Marketing", "Product", "Support",
    ]);
    fireEvent.change(departmentSelect, { target: { value: "Legal" } });
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Senior Counsel" } });
    fireEvent.click(screen.getByRole("button", { name: "Save employee" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/employees/1", expect.objectContaining({ method: "PATCH" })));
    expect(updatePayload).toMatchObject({ country_code: "GB", status: "leave", department: "Legal", job_title: "Senior Counsel" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit employee details" })).not.toBeInTheDocument());
    const profile = within(screen.getByRole("dialog", { name: "Avery Kim profile" }));
    expect(profile.getByText("On leave")).toBeInTheDocument();
    expect(profile.getByText("United Kingdom (GB)")).toBeInTheDocument();
    expect(profile.getByText("Legal")).toBeInTheDocument();
    expect(profile.getByText("Senior Counsel")).toBeInTheDocument();
  });

  it("creates an employee and opens the new profile", async () => {
    let created: (typeof employee & { salary_history: never[] }) | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "test-session-token", user: sessionUser }), { status: 200 });
      if (url === "/api/v1/employees" && init?.method === "POST") {
        const requestBody = JSON.parse(String(init.body));
        const body = requestBody.employee;
        const initialSalary = requestBody.initial_salary;
        created = { ...employee, ...body, id: 2, full_name: `${body.first_name} ${body.last_name}`, current_salary: initialSalary ? { id: 2, ...initialSalary } : null, salary_history: initialSalary ? [{ id: 2, ...initialSalary }] : [] };
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
    fireEvent.click(screen.getByLabelText("Add initial salary"));
    fireEvent.change(screen.getByLabelText("Initial annual salary"), { target: { value: "90000" } });
    fireEvent.change(screen.getByLabelText("Initial salary currency"), { target: { value: "SGD" } });
    fireEvent.change(screen.getByLabelText("Initial salary reason"), { target: { value: "New hire offer" } });
    fireEvent.click(screen.getByRole("button", { name: "Create employee" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/employees", expect.objectContaining({ method: "POST", body: expect.stringContaining('"initial_salary"') })));
    expect(await screen.findByRole("dialog", { name: "Iris Wong profile" })).toBeInTheDocument();
    expect(screen.queryByText("No salary record")).not.toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Iris Wong profile" })).getAllByText(/90,000/)).toHaveLength(2);
  });
});
