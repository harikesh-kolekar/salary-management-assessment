import type { Dashboard, Employee, EmployeeUpdate, Page, Salary } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.details ? Object.values(body.details).flat().join(" · ") : body.error;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchEmployees(params: URLSearchParams) {
  return request<Page<Employee>>(`/api/v1/employees?${params.toString()}`);
}

export async function fetchEmployee(id: number) {
  const result = await request<{ data: Employee }>(`/api/v1/employees/${id}`);
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

export async function createSalary(employeeId: number, input: Pick<Salary, "amount" | "currency" | "effective_from" | "reason">) {
  const result = await request<{ data: Salary }>(`/api/v1/employees/${employeeId}/salary_records`, {
    method: "POST",
    body: JSON.stringify({ salary_record: input }),
  });
  return result.data;
}
