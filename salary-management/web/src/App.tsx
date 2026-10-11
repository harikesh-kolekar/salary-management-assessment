import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, CircleDollarSign, Pencil, Plus, Search, Users, X } from "lucide-react";
import { createEmployee, createSalary, fetchDashboard, fetchEmployee, fetchEmployees, updateEmployee } from "./api";
import { formatCurrency, formatDate } from "./format";
import type { Dashboard, Employee, EmployeeUpdate, Metric, Page, SalaryInput } from "./types";

type View = "people" | "compensation";

export default function App() {
  const [view, setView] = useState<View>("people");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("last_name");
  const [direction, setDirection] = useState("asc");
  const [people, setPeople] = useState<Page<Employee> | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [employeeFormMode, setEmployeeFormMode] = useState<"create" | "edit" | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const params = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), per_page: "25", sort, direction });
    if (query.trim()) value.set("q", query.trim());
    if (country) value.set("country", country);
    if (department) value.set("department", department);
    if (status) value.set("status", status);
    return value;
  }, [page, sort, direction, query, country, department, status]);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError("");
      fetchEmployees(params).then((data) => { if (live) setPeople(data); })
        .catch((reason: Error) => { if (live) setError(reason.message); })
        .finally(() => { if (live) setBusy(false); });
    }, 120);
    return () => { live = false; window.clearTimeout(timer); };
  }, [params, refreshKey]);

  useEffect(() => {
    fetchDashboard().then(setDashboard).catch((reason: Error) => setError(reason.message));
  }, [refreshKey]);

  async function openEmployee(id: number) {
    try {
      setError("");
      setSelected(await fetchEmployee(id));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function changeSort(key: string) {
    if (sort === key) setDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSort(key); setDirection("asc"); }
    setPage(1);
  }

  async function salaryAdded() {
    if (selected) setSelected(await fetchEmployee(selected.id));
    setShowSalaryForm(false);
    setRefreshKey((key) => key + 1);
  }

  async function employeeSaved(input: EmployeeUpdate, initialSalary?: SalaryInput) {
    if (employeeFormMode === "create") {
      const created = await createEmployee(input, initialSalary);
      setSelected(await fetchEmployee(created.id));
    } else if (selected) {
      await updateEmployee(selected.id, input);
      setSelected(await fetchEmployee(selected.id));
    }
    setEmployeeFormMode(null);
    setRefreshKey((key) => key + 1);
  }

  const pageTitle = view === "people" ? "People" : "Compensation";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#people" onClick={() => setView("people")} aria-label="ACME home"><span className="brand-mark">A</span><span>acme<span className="brand-light">people</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${view === "people" ? "active" : ""}`} onClick={() => setView("people")}><Users size={18} /> People <span className="nav-count">{dashboard ? dashboard.employee_count.toLocaleString() : "—"}</span></button>
        <button className={`nav-item ${view === "compensation" ? "active" : ""}`} onClick={() => setView("compensation")}><CircleDollarSign size={18} /> Compensation</button>
        <div className="sidebar-bottom"><div className="sidebar-org"><div className="org-avatar">AC</div><div><strong>ACME Corporation</strong><small>HR workspace</small></div><span className="chevron">⌄</span></div><div className="demo-note"><span className="demo-dot" /> Synthetic demo data</div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {pageTitle}</div><div className="user-chip"><span className="avatar">JD</span><span>Jamie Davis</span><span className="chevron">⌄</span></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow">PEOPLE OPERATIONS</div><h1>{pageTitle}</h1><p>{view === "people" ? "Your organization, at a glance." : "Understand how your organization pays people."}</p></div><div className="heading-actions">{view === "people" && <button className="button-primary add-employee-button" onClick={() => setEmployeeFormMode("create")}><Plus size={15} /> Add employee</button>}<div className="as-of"><span className="live-dot" /> Data updated just now</div></div></div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
          {view === "people" ? <>
            <Stats dashboard={dashboard} />
            <section className="panel directory-panel">
              <div className="panel-heading"><div><h2>Employee directory</h2><p>Search and manage employee records</p></div><span className="result-count">{people?.meta.total.toLocaleString() ?? "—"} people</span></div>
              <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search name, ID or email" aria-label="Search employees" /><kbd>⌘ K</kbd></label><select aria-label="Filter by country" value={country} onChange={(event) => updateFilter(setCountry, event.target.value)}><option value="">All countries</option>{countries.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select><select aria-label="Filter by department" value={department} onChange={(event) => updateFilter(setDepartment, event.target.value)}><option value="">All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => updateFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="leave">On leave</option><option value="terminated">Terminated</option></select></div>
              <div className="table-scroll"><table><thead><tr><SortHead label="Employee" sortKey="last_name" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Department" sortKey="department" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Country" sortKey="country_code" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Current salary" sortKey="employee_number" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Status" sortKey="status" active={sort} direction={direction} onSort={changeSort} /></tr></thead><tbody>
                {busy && !people ? <tr><td colSpan={5} className="table-message">Loading employees…</td></tr> : null}
                {people?.data.map((person) => <tr key={person.id} onClick={() => openEmployee(person.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openEmployee(person.id); }}><td><div className="person-cell"><span className="person-avatar">{initials(person.full_name)}</span><span><strong>{person.full_name}</strong><small>{person.employee_number} · {person.job_title}</small></span></div></td><td>{person.department}</td><td><span className="country-cell"><span className="country-code">{person.country_code}</span>{countryNames[person.country_code] ?? person.country_code}</span></td><td className="salary-cell">{person.current_salary ? <><strong>{formatCurrency(person.current_salary.amount, person.current_salary.currency)}</strong><small>{person.current_salary.currency} / year</small></> : "—"}</td><td><span className={`status-pill ${person.status}`}>{person.status === "active" ? "Active" : person.status === "leave" ? "On leave" : "Terminated"}</span></td></tr>)}
                {!busy && people?.data.length === 0 && <tr><td colSpan={5} className="table-message">No employees match these filters. Try a different search.</td></tr>}
              </tbody></table></div>
              <div className="pagination"><span>Showing <strong>{people?.meta.total ? ((people.meta.page - 1) * people.meta.per_page + 1).toLocaleString() : 0}–{Math.min((people?.meta.page ?? 1) * (people?.meta.per_page ?? 25), people?.meta.total ?? 0).toLocaleString()}</strong> of <strong>{people?.meta.total.toLocaleString() ?? 0}</strong></span><div className="page-controls"><button aria-label="Previous page" disabled={(people?.meta.page ?? 1) <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><span>Page {people?.meta.page ?? 1} of {people?.meta.total_pages ?? 1}</span><button aria-label="Next page" disabled={(people?.meta.page ?? 1) >= (people?.meta.total_pages ?? 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>
            </section>
          </> : <Compensation dashboard={dashboard} />}
          <footer className="footer-note">ACME People <span>·</span> Compensation is shown in each employee’s local currency. No currency conversion is applied.</footer>
        </div>
      </main>

      {selected && <EmployeePanel employee={selected} onClose={() => { setSelected(null); setShowSalaryForm(false); setEmployeeFormMode(null); }} onAdd={() => setShowSalaryForm(true)} onEdit={() => setEmployeeFormMode("edit")} />}
      {employeeFormMode && <EmployeeEditDialog mode={employeeFormMode} employee={employeeFormMode === "edit" ? selected ?? undefined : undefined} onClose={() => setEmployeeFormMode(null)} onSave={employeeSaved} />}
      {showSalaryForm && selected && <SalaryDialog employee={selected} onClose={() => setShowSalaryForm(false)} onSaved={salaryAdded} />}
    </div>
  );
}

function Stats({ dashboard }: { dashboard: Dashboard | null }) {
  const activeCurrencies = dashboard?.by_currency.length ?? 0;
  return <div className="stats-grid">
    <article className="stat-card"><span className="stat-icon blue"><Users size={18} /></span><span className="stat-label">Employees on roster</span><strong>{dashboard?.headcount.toLocaleString() ?? "—"}</strong><small>Including employees on leave</small></article>
    <article className="stat-card"><span className="stat-icon violet"><Building2 size={18} /></span><span className="stat-label">Countries</span><strong>{dashboard ? new Set(dashboard.by_country.map((row) => row.key)).size : "—"}</strong><small>With employees on roster</small></article>
    <article className="stat-card"><span className="stat-icon green"><BriefcaseBusiness size={18} /></span><span className="stat-label">Departments</span><strong>{dashboard ? new Set(dashboard.by_department.map((row) => row.key)).size : "—"}</strong><small>Across the organization</small></article>
    <article className="stat-card"><span className="stat-icon amber"><CircleDollarSign size={18} /></span><span className="stat-label">Pay currencies</span><strong>{activeCurrencies || "—"}</strong><small>Reported separately</small></article>
  </div>;
}

function Compensation({ dashboard }: { dashboard: Dashboard | null }) {
  if (!dashboard) return <section className="panel table-message">Loading compensation overview…</section>;
  return <div className="insights-grid">
    <section className="panel insight-panel"><div className="panel-heading"><div><div className="section-kicker"><Building2 size={15} /> LOCATION</div><h2>Pay by country</h2><p>Average annual salary and headcount</p></div></div><MetricTable rows={dashboard.by_country} /></section>
    <section className="panel insight-panel"><div className="panel-heading"><div><div className="section-kicker"><BriefcaseBusiness size={15} /> ORGANIZATION</div><h2>Pay by department</h2><p>Average annual salary and headcount</p></div></div><MetricTable rows={dashboard.by_department} /></section>
    <section className="panel insight-panel wide"><div className="panel-heading"><div><div className="section-kicker"><CircleDollarSign size={15} /> PAYROLL MIX</div><h2>Compensation by currency</h2><p>Native-currency view — totals are not converted or combined</p></div></div><div className="currency-cards">{dashboard.by_currency.map((row) => <div className="currency-card" key={row.currency}><span className="currency-symbol">{currencyGlyph[row.currency] ?? row.currency}</span><span><small>{row.currency} annualized payroll</small><strong>{formatCurrency(row.total_salary, row.currency)}</strong><small>{row.employee_count.toLocaleString()} employees on roster · avg {formatCurrency(row.average_salary, row.currency)}</small></span></div>)}</div></section>
    <div className="insight-footnote"><Activity size={15} /> Summaries include each employee on the roster, including people on leave, using their latest salary effective as of {formatDate(dashboard.as_of)}. Values in different currencies must not be compared directly.</div>
  </div>;
}

function MetricTable({ rows }: { rows: Metric[] }) {
  if (!rows.length) return <div className="table-message">No compensation data yet.</div>;
  const maxCount = Math.max(...rows.map((row) => row.employee_count));
  return <div className="metric-list">{rows.map((row) => <div className="metric-row" key={`${row.key}-${row.currency}`}><div className="metric-title"><strong>{countryNames[row.key] ?? row.key}</strong><span>{row.employee_count.toLocaleString()} people · {row.currency}</span></div><div className="metric-data"><strong>{formatCurrency(row.average_salary, row.currency)}</strong><small>average</small></div><div className="metric-bar"><span style={{ width: `${Math.max(5, row.employee_count / maxCount * 100)}%` }} /></div></div> )}</div>;
}

function SortHead({ label, sortKey, active, direction, onSort }: { label: string; sortKey: string; active: string; direction: string; onSort: (key: string) => void }) {
  const Icon = active === sortKey ? direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  return <th><button className="sort-button" onClick={() => onSort(sortKey)}>{label}<Icon size={13} /></button></th>;
}

function EmployeePanel({ employee, onClose, onAdd, onEdit }: { employee: Employee; onClose: () => void; onAdd: () => void; onEdit: () => void }) {
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="employee-panel" role="dialog" aria-modal="true" aria-label={`${employee.full_name} profile`}><div className="drawer-top"><span>EMPLOYEE PROFILE</span><div className="drawer-actions"><button className="small-action" onClick={onEdit}><Pencil size={14} /> Edit details</button><button aria-label="Close profile" className="icon-button" onClick={onClose}><X size={19} /></button></div></div><div className="profile-header"><div className="profile-avatar">{initials(employee.full_name)}</div><h2>{employee.full_name}</h2><p>{employee.job_title}</p><span className={`status-pill ${employee.status}`}>{employee.status === "active" ? "Active" : employee.status === "leave" ? "On leave" : "Terminated"}</span></div><div className="profile-section"><div className="profile-section-title"><h3>Personal details</h3><span>#{employee.employee_number}</span></div><Detail label="Email" value={employee.email} /><Detail label="Department" value={employee.department} /><Detail label="Location" value={`${countryNames[employee.country_code] ?? employee.country_code} (${employee.country_code})`} /><Detail label="Hire date" value={formatDate(employee.hired_on)} /></div><div className="profile-section compensation-section"><div className="profile-section-title"><div><h3>Compensation</h3><p>Annual base salary</p></div><button className="small-action" onClick={onAdd}><Plus size={15} /> Add change</button></div>{employee.current_salary ? <div className="current-pay"><span>Current salary</span><strong>{formatCurrency(employee.current_salary.amount, employee.current_salary.currency)}</strong><small>{employee.current_salary.currency} · effective {formatDate(employee.current_salary.effective_from)}</small></div> : <div className="empty-pay">No salary record</div>}<h4 className="history-title">Salary history</h4><div className="history-list">{employee.salary_history?.map((record) => <div className="history-row" key={record.id}><span className="history-dot" /><div><strong>{formatCurrency(record.amount, record.currency)}</strong><small>{formatDate(record.effective_from)} · {record.reason}</small></div></div>)}</div></div><div className="drawer-disclaimer">Salary records are retained as history. Changes are effective from the date shown and do not rewrite earlier records.</div></aside></div>;
}

function EmployeeEditDialog({ mode, employee, onClose, onSave }: { mode: "create" | "edit"; employee?: Employee; onClose: () => void; onSave: (input: EmployeeUpdate, initialSalary?: SalaryInput) => Promise<void> }) {
  const [form, setForm] = useState<EmployeeUpdate>(() => employee ? ({
    employee_number: employee.employee_number, first_name: employee.first_name, last_name: employee.last_name,
    email: employee.email, country_code: employee.country_code, department: employee.department,
    job_title: employee.job_title, status: employee.status, hired_on: employee.hired_on,
  }) : ({ employee_number: "", first_name: "", last_name: "", email: "", country_code: "US", department: departments[0], job_title: "", status: "active", hired_on: new Date().toISOString().slice(0, 10) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addInitialSalary, setAddInitialSalary] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState(currencyByCountry[form.country_code] ?? "USD");
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState(form.hired_on);
  const [salaryReason, setSalaryReason] = useState("Initial compensation");
  function change<K extends keyof EmployeeUpdate>(key: K, value: EmployeeUpdate[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const initialSalary = mode === "create" && addInitialSalary ? {
        amount: Number(salaryAmount), currency: salaryCurrency, effective_from: salaryEffectiveDate, reason: salaryReason,
      } : undefined;
      await onSave(form, initialSalary);
    }
    catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="overlay modal-overlay"><section className="salary-modal employee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="employee-edit-title"><div className="modal-head"><div><div className="eyebrow">EMPLOYEE RECORD</div><h2 id="employee-edit-title">{mode === "create" ? "Add employee" : "Edit employee details"}</h2><p>{mode === "create" ? "Add a person to the organization directory." : "Update identity and organization information."}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="employee-edit-grid"><label>Employee number<input required value={form.employee_number} onChange={(event) => change("employee_number", event.target.value)} /></label><label>Status<select aria-label="Employee status" value={form.status} onChange={(event) => change("status", event.target.value as Employee["status"])}><option value="active">Active</option><option value="leave">On leave</option><option value="terminated">Terminated</option></select></label><label>First name<input required value={form.first_name} onChange={(event) => change("first_name", event.target.value)} /></label><label>Last name<input required value={form.last_name} onChange={(event) => change("last_name", event.target.value)} /></label><label>Email<input type="email" required value={form.email} onChange={(event) => change("email", event.target.value)} /></label><label>Country<select aria-label="Country" value={form.country_code} onChange={(event) => { change("country_code", event.target.value); setSalaryCurrency(currencyByCountry[event.target.value] ?? "USD"); }}>{countries.map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label><label>Department<select aria-label="Department" required value={form.department} onChange={(event) => change("department", event.target.value)}>{departments.map((department) => <option value={department} key={department}>{department}</option>)}</select></label><label>Job title<input required value={form.job_title} onChange={(event) => change("job_title", event.target.value)} /></label><label>Hire date<input type="date" required value={form.hired_on} onChange={(event) => { change("hired_on", event.target.value); setSalaryEffectiveDate(event.target.value); }} /></label></div>{mode === "create" && <section className="initial-salary-section"><label className="initial-salary-toggle"><input type="checkbox" aria-label="Add initial salary" checked={addInitialSalary} onChange={(event) => setAddInitialSalary(event.target.checked)} /><span><strong>Add initial salary</strong><small>Record compensation as part of employee creation.</small></span></label>{addInitialSalary && <div className="initial-salary-fields"><label>Annual salary<div className="amount-input"><select aria-label="Initial salary currency" value={salaryCurrency} onChange={(event) => setSalaryCurrency(event.target.value)}>{["USD", "GBP", "INR", "EUR", "CAD", "AUD", "SGD", "JPY"].map((code) => <option key={code}>{code}</option>)}</select><input aria-label="Initial annual salary" type="number" min="0.01" step="0.01" value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} placeholder="0.00" required /></div></label><label>Effective date<input aria-label="Initial salary effective date" type="date" value={salaryEffectiveDate} onChange={(event) => setSalaryEffectiveDate(event.target.value)} required /></label><label>Reason<input aria-label="Initial salary reason" value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} maxLength={240} required /></label></div>}</section>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create employee" : "Save employee"}</button></div></form></section></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>; }

function SalaryDialog({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(employee.current_salary?.currency ?? currencyByCountry[employee.country_code] ?? "USD");
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await createSalary(employee.id, { amount: Number(amount), currency, effective_from: effective, reason }); await onSaved(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="overlay modal-overlay"><section className="salary-modal" role="dialog" aria-modal="true" aria-labelledby="salary-form-title"><div className="modal-head"><div><div className="eyebrow">COMPENSATION UPDATE</div><h2 id="salary-form-title">Add salary change</h2><p>For {employee.full_name} · {employee.employee_number}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><label>Annual salary<div className="amount-input"><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{["USD", "GBP", "INR", "EUR", "CAD", "AUD", "SGD", "JPY"].map((code) => <option key={code}>{code}</option>)}</select><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></div></label><label>Effective date<input type="date" value={effective} onChange={(event) => setEffective(event.target.value)} required min={employee.salary_history?.[0]?.effective_from} /></label><label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Annual compensation review" maxLength={240} required /></label><p className="form-hint">Changes are added to salary history and cannot overwrite an existing effective date.</p>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving}>{saving ? "Saving…" : "Save salary change"}</button></div></form></section></div>;
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }

const countries: [string, string][] = [["US", "United States"], ["GB", "United Kingdom"], ["IN", "India"], ["DE", "Germany"], ["CA", "Canada"], ["AU", "Australia"], ["SG", "Singapore"], ["JP", "Japan"]];
const countryNames = Object.fromEntries(countries);
const departments = ["Engineering", "Finance", "People", "Sales", "Operations", "Legal", "Marketing", "Product", "Support"];
const currencyByCountry: Record<string, string> = { US: "USD", GB: "GBP", IN: "INR", DE: "EUR", CA: "CAD", AU: "AUD", SG: "SGD", JP: "JPY" };
const currencyGlyph: Record<string, string> = { USD: "$", GBP: "£", INR: "₹", EUR: "€", CAD: "C$", AUD: "A$", SGD: "S$", JPY: "¥" };
