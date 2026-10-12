export type Salary = {
  id: number;
  amount: number;
  currency: string;
  effective_from: string;
  reason: string;
};

export type Employee = {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  country_code: string;
  department: string;
  job_title: string;
  status: "active" | "leave" | "terminated";
  hired_on: string;
  current_salary: Salary | null;
  salary_history?: Salary[];
};

export type EmployeeUpdate = Pick<Employee, "employee_number" | "first_name" | "last_name" | "email" | "country_code" | "department" | "job_title" | "status" | "hired_on">;
export type SalaryInput = Pick<Salary, "amount" | "currency" | "effective_from" | "reason">;

export type SessionUser = {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "hr_manager";
  organization: { id: number; name: string; slug: string };
};

export type ReferenceData = {
  countries: { code: string; name: string }[];
  departments: { code: string; id: number; name: string; hr_manager: { id: number; full_name: string } }[];
  hr_managers: { id: number; full_name: string; email: string; role: "admin" | "hr_manager" }[];
};

export type Department = {
  id: number;
  name: string;
  code: string;
  employee_count: number;
  hr_manager: { id: number; full_name: string };
};

export type PayrollReport = {
  report_type: "employees" | "salary_increases" | "headcount";
  title: string;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  rows: Record<string, string | number | null>[];
  show_table: boolean;
  chart: { label: string; value: number }[];
  chart_type: "bar" | "pie";
  chart_group: string | null;
};

export type PayrollAssistantResponse = { answer: string; report: PayrollReport | null };

export type Page<T> = {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
};

export type Metric = {
  key: string;
  currency: string;
  employee_count: number;
  average_salary: number;
  total_salary: number;
};

export type Dashboard = {
  as_of: string;
  headcount: number;
  employee_count: number;
  by_country: Metric[];
  by_department: Metric[];
  by_currency: Metric[];
};
