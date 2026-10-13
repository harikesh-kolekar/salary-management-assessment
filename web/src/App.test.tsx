import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { fetchEmployees } from "./api";

const sessionUser = { id: 1, full_name: "Jamie Davis", email: "manager@example.test", role: "admin" as const, organization: { id: 1, name: "ACME Corporation", slug: "acme-corporation" } };
const referenceData = { countries: [{ code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "SG", name: "Singapore" }], departments: ["Engineering", "Finance", "People", "Sales", "Operations", "Legal", "Marketing", "Product", "Support"].map((name, index) => ({ id: index + 1, code: name.toUpperCase().replaceAll(" ", "_"), name, hr_manager: { id: 1, full_name: "Jamie Davis" } })), hr_managers: [{ id: 1, full_name: "Jamie Davis", email: "manager@example.test", role: "admin" as "admin" | "hr_manager" }] };

const employee = {
  id: 1, employee_number: "ACME-00001", first_name: "Avery", last_name: "Kim", full_name: "Avery Kim",
  email: "employee00001@example.test", country_code: "US", department: "Engineering", job_title: "Engineer",
  status: "active" as const, hired_on: "2022-01-01",
  current_salary: { id: 1, amount: 95000, currency: "USD", effective_from: "2025-01-01", reason: "Annual review" },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("salary management workspace", () => {
  it("refreshes an expired access token and retries the failed API request", async () => {
    localStorage.setItem("acme-salary-session-token", "expired-access-token");
    let employeeRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/session/refresh") return new Response(JSON.stringify({ token: "fresh-access-token" }), { status: 200 });
      if (url.startsWith("/api/v1/employees")) {
        employeeRequests += 1;
        if (employeeRequests === 1) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
        expect(init?.headers).toMatchObject({ Authorization: "Bearer fresh-access-token" });
        return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchEmployees(new URLSearchParams());

    expect(result.data).toEqual([]);
    expect(employeeRequests).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/session/refresh", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect(localStorage.getItem("acme-salary-session-token")).toBe("fresh-access-token");
  });

  it("returns to sign in when refresh fails after the access token expires", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "test-session-token", user: sessionUser }), { status: 200 });
      if (url === "/api/v1/session/refresh") return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
      if (url.startsWith("/api/v1/employees") || url === "/api/v1/dashboard") return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(localStorage.getItem("acme-salary-session-token")).toBeNull();
  });

  it("signs in a manager and opens their organization workspace", async () => {
    localStorage.clear();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/v1/session" && init?.method === "POST") {
        return new Response(JSON.stringify({ token: "signed-in-token", user: sessionUser }), { status: 200 });
      }
      if (String(input) === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
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
      if (String(input) === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
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
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
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
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
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
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
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

    const addEmployeeButton = await screen.findByRole("button", { name: "Add employee" });
    await waitFor(() => expect(addEmployeeButton).toBeEnabled());
    fireEvent.click(addEmployeeButton);
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

  it("lets an admin create HR managers and departments and reassign department managers", async () => {
    let managers = [...referenceData.hr_managers];
    let departments = [...referenceData.departments];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "admin-token", user: sessionUser }), { status: 200 });
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify({ ...referenceData, departments, hr_managers: managers }), { status: 200 });
      if (url === "/api/v1/hr_managers" && init?.method === "POST") {
        const { hr_manager: user } = JSON.parse(String(init.body));
        const created = { id: 2, full_name: user.full_name, email: user.email, role: "hr_manager" as const };
        managers = [...managers, created];
        return new Response(JSON.stringify({ data: created }), { status: 201 });
      }
      if (url === "/api/v1/departments" && init?.method === "POST") {
        const { department } = JSON.parse(String(init.body));
        const manager = managers.find((item) => item.id === department.hr_manager_id)!;
        const created = { id: 20, name: department.name, code: department.name.toUpperCase(), hr_manager: { id: manager.id, full_name: manager.full_name } };
        departments = [...departments, created];
        return new Response(JSON.stringify({ data: created }), { status: 201 });
      }
      if (url === "/api/v1/departments/1" && init?.method === "PATCH") {
        const { department } = JSON.parse(String(init.body));
        const manager = managers.find((item) => item.id === department.hr_manager_id)!;
        departments = departments.map((item) => item.id === 1 ? { ...item, hr_manager: { id: manager.id, full_name: manager.full_name } } : item);
        return new Response(JSON.stringify({ data: departments[0] }), { status: 200 });
      }
      if (url.startsWith("/api/v1/employees")) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 });
      return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 0, employee_count: 0, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Organization" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Taylor HR" } });
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "taylor@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "strong-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "strong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Add HR manager" }));
    expect(await screen.findByText("HR manager added.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Department name"), { target: { value: "Compliance" } });
    fireEvent.change(screen.getByLabelText("HR manager"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add department" }));
    expect(await screen.findByText("Department added.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("HR manager for Engineering"), { target: { value: "2" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/departments/1", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByText("Department HR manager updated.")).toBeInTheDocument();
  });
});

describe("payroll assistant report presentation", () => {
  function setupAssistant(report: Record<string, unknown>) {
    localStorage.clear();
    localStorage.setItem("acme-salary-session-token", "assistant-test-token");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/session") return new Response(JSON.stringify({ token: "assistant-test-token", user: sessionUser }), { status: 200 });
      if (url === "/api/v1/reference_data") return new Response(JSON.stringify(referenceData), { status: 200 });
      if (url.startsWith("/api/v1/employees")) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 25, total: 0, total_pages: 0 } }), { status: 200 });
      if (url === "/api/v1/dashboard") return new Response(JSON.stringify({ as_of: "2026-10-11", headcount: 0, employee_count: 0, by_country: [], by_department: [], by_currency: [] }), { status: 200 });
      if (url === "/api/v1/assistant/ask") return new Response(JSON.stringify({ answer: "Here is the requested report.", report }), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function askQuestion(question: string) {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask payroll" }));
    fireEvent.change(screen.getByLabelText("What would you like to know?"), { target: { value: question } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  }

  it("shows a department pie chart without an employee table for an aggregate chart request", async () => {
    setupAssistant({
      report_type: "headcount", title: "Employee headcount", total: 3, page: 1, per_page: 25, total_pages: 1,
      rows: [], show_table: false,
      chart: [{ label: "Engineering", value: 2 }, { label: "Finance", value: 1 }],
      chart_type: "pie", chart_group: "department",
    });

    await askQuestion("Give me count of employee with pi-chart with department");

    expect(await screen.findByRole("img", { name: /Pie chart showing 3 employees/ })).toBeInTheDocument();
    expect(document.querySelectorAll(".assistant-pie path")).toHaveLength(2);
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("shows the employee table without a chart for an employee list request", async () => {
    setupAssistant({
      report_type: "employees", title: "Employee list", total: 1, page: 1, per_page: 25, total_pages: 1,
      rows: [{ employee: "Avery Kim", employee_number: "ACME-00001", job_title: "Engineer", department: "Engineering", country: "United States", status: "active" }],
      show_table: true, chart: [], chart_type: "bar", chart_group: null,
    });

    await askQuestion("Give me the employee list for Engineering");

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Avery Kim")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Pie chart/ })).not.toBeInTheDocument();
    expect(document.querySelector(".assistant-chart-row")).toBeNull();
  });
});
