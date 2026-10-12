import type { Dashboard, Department, Employee, EmployeeUpdate, Page, PayrollAssistantResponse, ReferenceData, Salary, SalaryInput, SessionUser } from "./types";

const sessionTokenKey = "acme-salary-session-token";
const refreshPath = "/api/v1/session/refresh";
let refreshInFlight: Promise<string | null> | null = null;

export function clearSessionToken() {
  localStorage.removeItem(sessionTokenKey);
}

function expireSession() {
  clearSessionToken();
  window.dispatchEvent(new Event("salary-session-expired"));
}

function saveSessionToken(token: string) {
  localStorage.setItem(sessionTokenKey, token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const send = (token = localStorage.getItem(sessionTokenKey)) => fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  let response = await send();
  const isPublicAuthenticationRequest = (path === "/api/v1/session" && init?.method === "POST") || (path === "/api/v1/organizations" && init?.method === "POST");
  if (response.status === 401 && localStorage.getItem(sessionTokenKey) && path !== refreshPath && !isPublicAuthenticationRequest) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(refreshedToken);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.details ? Object.values(body.details).flat().join(" · ") : body.error;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(refreshPath, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        expireSession();
        return null;
      }
      const result = await response.json() as { token: string };
      saveSessionToken(result.token);
      return result.token;
    }).catch(() => {
      expireSession();
      return null;
    }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

export async function logout() {
  try {
    await fetch("/api/v1/session", { method: "DELETE", credentials: "same-origin" });
  } finally {
    clearSessionToken();
  }
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

export async function fetchDepartments() {
  const result = await request<{ data: Department[] }>("/api/v1/departments");
  return result.data;
}

export function fetchDepartment(id: number, page = 1) {
  return request<{ data: Department; employees: Employee[]; meta: Page<Employee>["meta"] }>(`/api/v1/departments/${id}?page=${page}&per_page=25`);
}

export function askPayrollAssistant(question: string, page = 1) {
  return request<PayrollAssistantResponse>("/api/v1/assistant/ask", {
    method: "POST",
    body: JSON.stringify({ question, page }),
  });
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
