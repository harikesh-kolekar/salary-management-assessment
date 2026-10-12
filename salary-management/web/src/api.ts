import type { Dashboard, Employee, EmployeeUpdate, Page, ReferenceData, Salary, SalaryInput, SessionUser } from "./types";

const sessionTokenKey = "acme-salary-session-token";

export function clearSessionToken() {
  localStorage.removeItem(sessionTokenKey);
}

function saveSessionToken(token: string) {
  localStorage.setItem(sessionTokenKey, token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem(sessionTokenKey) ? { Authorization: `Bearer ${localStorage.getItem(sessionTokenKey)}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.details ? Object.values(body.details).flat().join(" · ") : body.error;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

type SessionResponse = { token: string; user: SessionUser };

async function persistSession(path: string, body: unknown) {
  const result = await request<SessionResponse>(path, { method: "POST", body: JSON.stringify(body) });
  saveSessionToken(result.token);
  return result.user;
}

export async function login(email: string, password: string) {
  return persistSession("/api/v1/session", { email, password });
}

export async function registerOrganization(input: { name: string; manager_name: string; email: string; password: string; password_confirmation: string }) {
  return persistSession("/api/v1/organizations", { organization: input });
}

export async function fetchCurrentUser() {
  const result = await request<SessionResponse>("/api/v1/session");
  saveSessionToken(result.token);
  return result.user;
}

export function fetchEmployees(params: URLSearchParams) {
  return request<Page<Employee>>(`/api/v1/employees?${params.toString()}`);
}

export async function fetchEmployee(id: number) {
  const result = await request<{ data: Employee }>(`/api/v1/employees/${id}`);
  return result.data;
}

export async function createEmployee(input: EmployeeUpdate, initialSalary?: SalaryInput) {
  const result = await request<{ data: Employee }>("/api/v1/employees", {
    method: "POST",
    body: JSON.stringify({ employee: input, ...(initialSalary ? { initial_salary: initialSalary } : {}) }),
  });
  return result.data;
}

export async function updateEmployee(id: number, input: EmployeeUpdate) {
  const result = await request<{ data: Employee }>(`/api/v1/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ employee: input }),
  });
  return result.data;
}

export function fetchDashboard() {
  return request<Dashboard>("/api/v1/dashboard");
}

export function fetchReferenceData() {
  return request<ReferenceData>("/api/v1/reference_data");
}

export async function createHrManager(input: { full_name: string; email: string; password: string; password_confirmation: string }) {
  const result = await request<{ data: ReferenceData["hr_managers"][number] }>("/api/v1/hr_managers", {
    method: "POST", body: JSON.stringify({ hr_manager: input }),
  });
  return result.data;
}

export async function createDepartment(input: { name: string; hr_manager_id: number }) {
  const result = await request<{ data: ReferenceData["departments"][number] }>("/api/v1/departments", {
    method: "POST", body: JSON.stringify({ department: input }),
  });
  return result.data;
}

export async function updateDepartment(id: number, input: { hr_manager_id: number }) {
  const result = await request<{ data: ReferenceData["departments"][number] }>(`/api/v1/departments/${id}`, {
    method: "PATCH", body: JSON.stringify({ department: input }),
  });
  return result.data;
}

export async function createSalary(employeeId: number, input: SalaryInput) {
  const result = await request<{ data: Salary }>(`/api/v1/employees/${employeeId}/salary_records`, {
    method: "POST",
    body: JSON.stringify({ salary_record: input }),
  });
  return result.data;
}
