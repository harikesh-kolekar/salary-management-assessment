import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, CircleDollarSign, Pencil, Plus, Search, Send, Settings, Sparkles, Users, UserPlus, X } from "lucide-react";
import { askPayrollAssistant, clearSessionToken, createDepartment, createEmployee, createHrManager, createSalary, fetchCurrentUser, fetchDashboard, fetchDepartment, fetchDepartments, fetchEmployee, fetchEmployees, fetchReferenceData, login, logout, registerOrganization, updateDepartment, updateEmployee } from "./api";
import { formatCurrency, formatDate } from "./format";
import type { Dashboard, Employee, EmployeeUpdate, Metric, Page, PayrollAssistantResponse, ReferenceData, SalaryInput, SessionUser } from "./types";

type View = "people" | "compensation" | "organization" | "departments" | "department-detail" | "assistant";

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const expireSession = () => setUser(null);
    window.addEventListener("salary-session-expired", expireSession);
    return () => window.removeEventListener("salary-session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("acme-salary-session-token")) {
      setCheckingSession(false);
      return;
    }
    fetchCurrentUser().then(setUser).catch(() => clearSessionToken()).finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return <div className="auth-loading" role="status">Loading your workspace…</div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return <Workspace user={user} onLogout={() => { void logout(); setUser(null); }} />;
}

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [view, setView] = useState<View>("people");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("last_name");
  const [direction, setDirection] = useState("asc");
  const [people, setPeople] = useState<Page<Employee> | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [referenceData, setReferenceData] = useState<ReferenceData | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [employeeFormMode, setEmployeeFormMode] = useState<"create" | "edit" | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const countries = referenceData?.countries ?? [];
  const departments = referenceData?.departments?.map((item) => item.name) ?? [];
  const countryNames = useMemo(() => Object.fromEntries(countries.map(({ code, name }) => [code, name])), [countries]);

  useEffect(() => {
    fetchReferenceData().then(setReferenceData).catch((reason: Error) => setError(reason.message));
  }, []);

  async function reloadReferenceData() {
    const data = await fetchReferenceData();
    setReferenceData(data);
  }

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

  const pageTitle = view === "people" ? "People" : view === "compensation" ? "Compensation" : view === "organization" ? "Organization" : view === "assistant" ? "Ask payroll" : "Departments";

  function openDepartment(id: number) {
    setSelectedDepartmentId(id);
    setView("department-detail");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#people" onClick={() => setView("people")} aria-label="ACME home"><span className="brand-mark">A</span><span>acme<span className="brand-light">people</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${view === "people" ? "active" : ""}`} onClick={() => setView("people")}><Users size={18} /> People <span className="nav-count">{dashboard ? dashboard.employee_count.toLocaleString() : "—"}</span></button>
        <button className={`nav-item ${view === "compensation" ? "active" : ""}`} onClick={() => setView("compensation")}><CircleDollarSign size={18} /> Compensation</button>
        <button className={`nav-item ${view === "departments" || view === "department-detail" ? "active" : ""}`} onClick={() => setView("departments")}><Building2 size={18} /> Departments</button>
        <button className={`nav-item ${view === "assistant" ? "active" : ""}`} onClick={() => setView("assistant")}><Sparkles size={18} /> Ask payroll</button>
        {user.role === "admin" && <button className={`nav-item ${view === "organization" ? "active" : ""}`} onClick={() => setView("organization")}><Settings size={18} /> Organization</button>}
        <div className="sidebar-bottom"><div className="sidebar-org"><div className="org-avatar">{initials(user.organization.name)}</div><div><strong>{user.organization.name}</strong><small>HR workspace</small></div><span className="chevron">⌄</span></div><div className="demo-note"><span className="demo-dot" /> Organization workspace</div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">{user.organization.name} <span>/</span> {pageTitle}</div><div className="user-chip"><span className="avatar">{initials(user.full_name)}</span><span>{user.full_name}</span><button className="logout-button" onClick={onLogout}>Sign out</button></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow">PEOPLE OPERATIONS</div><h1>{pageTitle}</h1><p>{view === "people" ? "Your organization, at a glance." : view === "departments" || view === "department-detail" ? "Explore departments and the people in them." : view === "assistant" ? "Ask questions and build reports from your accessible data." : "Understand how your organization pays people."}</p></div><div className="heading-actions">{view === "people" && <button className="button-primary add-employee-button" disabled={!referenceData} onClick={() => setEmployeeFormMode("create")}><Plus size={15} /> Add employee</button>}<div className="as-of"><span className="live-dot" /> Data updated just now</div></div></div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
          {view === "people" ? <>
            <Stats dashboard={dashboard} />
            <section className="panel directory-panel">
              <div className="panel-heading"><div><h2>Employee directory</h2><p>Search and manage employee records</p></div><span className="result-count">{people?.meta.total.toLocaleString() ?? "—"} people</span></div>
              <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search name, ID or email" aria-label="Search employees" /><kbd>⌘ K</kbd></label><select aria-label="Filter by country" value={country} onChange={(event) => updateFilter(setCountry, event.target.value)}><option value="">All countries</option>{countries.map(({ code, name }) => <option value={code} key={code}>{name}</option>)}</select><select aria-label="Filter by department" value={department} onChange={(event) => updateFilter(setDepartment, event.target.value)}><option value="">All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => updateFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="leave">On leave</option><option value="terminated">Terminated</option></select></div>
              <div className="table-scroll"><table><thead><tr><SortHead label="Employee" sortKey="last_name" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Department" sortKey="department" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Country" sortKey="country_code" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Current salary" sortKey="employee_number" active={sort} direction={direction} onSort={changeSort} /><SortHead label="Status" sortKey="status" active={sort} direction={direction} onSort={changeSort} /></tr></thead><tbody>
                {busy && !people ? <tr><td colSpan={5} className="table-message">Loading employees…</td></tr> : null}
                {people?.data.map((person) => <tr key={person.id} onClick={() => openEmployee(person.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") openEmployee(person.id); }}><td><div className="person-cell"><span className="person-avatar">{initials(person.full_name)}</span><span><strong>{person.full_name}</strong><small>{person.employee_number} · {person.job_title}</small></span></div></td><td>{person.department}</td><td><span className="country-cell"><span className="country-code">{person.country_code}</span>{countryNames[person.country_code] ?? person.country_code}</span></td><td className="salary-cell">{person.current_salary ? <><strong>{formatCurrency(person.current_salary.amount, person.current_salary.currency)}</strong><small>{person.current_salary.currency} / year</small></> : "—"}</td><td><span className={`status-pill ${person.status}`}>{person.status === "active" ? "Active" : person.status === "leave" ? "On leave" : "Terminated"}</span></td></tr>)}
                {!busy && people?.data.length === 0 && <tr><td colSpan={5} className="table-message">No employees match these filters. Try a different search.</td></tr>}
              </tbody></table></div>
              <div className="pagination"><span>Showing <strong>{people?.meta.total ? ((people.meta.page - 1) * people.meta.per_page + 1).toLocaleString() : 0}–{Math.min((people?.meta.page ?? 1) * (people?.meta.per_page ?? 25), people?.meta.total ?? 0).toLocaleString()}</strong> of <strong>{people?.meta.total.toLocaleString() ?? 0}</strong></span><div className="page-controls"><button aria-label="Previous page" disabled={(people?.meta.page ?? 1) <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><span>Page {people?.meta.page ?? 1} of {people?.meta.total_pages ?? 1}</span><button aria-label="Next page" disabled={(people?.meta.page ?? 1) >= (people?.meta.total_pages ?? 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>
            </section>
          </> : view === "compensation" ? <Compensation dashboard={dashboard} countryNames={countryNames} /> : view === "organization" ? <OrganizationAdmin referenceData={referenceData} onRefresh={reloadReferenceData} /> : view === "departments" ? <DepartmentIndex isAdmin={user.role === "admin"} referenceData={referenceData} onRefresh={reloadReferenceData} onOpen={openDepartment} /> : view === "assistant" ? <PayrollAssistantView /> : selectedDepartmentId ? <DepartmentDetail departmentId={selectedDepartmentId} onBack={() => setView("departments")} /> : null}
          <footer className="footer-note">ACME People <span>·</span> Compensation is shown in each employee’s local currency. No currency conversion is applied.</footer>
        </div>
      </main>

      {selected && <EmployeePanel employee={selected} countryNames={countryNames} onClose={() => { setSelected(null); setShowSalaryForm(false); setEmployeeFormMode(null); }} onAdd={() => setShowSalaryForm(true)} onEdit={() => setEmployeeFormMode("edit")} />}
      {employeeFormMode && referenceData && <EmployeeEditDialog mode={employeeFormMode} countries={countries} departments={departments} employee={employeeFormMode === "edit" ? selected ?? undefined : undefined} onClose={() => setEmployeeFormMode(null)} onSave={employeeSaved} />}
      {showSalaryForm && selected && <SalaryDialog employee={selected} onClose={() => setShowSalaryForm(false)} onSaved={salaryAdded} />}
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [organizationName, setOrganizationName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const user = mode === "login"
        ? await login(email, password)
        : await registerOrganization({ name: organizationName, manager_name: managerName, email, password, password_confirmation: passwordConfirmation });
      onAuthenticated(user);
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">A</span><span>acme<span className="brand-light">people</span></span></div><div className="auth-intro"><div className="eyebrow">SALARY MANAGEMENT</div><h1>{mode === "login" ? "Welcome back" : "Create your organization"}</h1><p>{mode === "login" ? "Sign in to your organization’s employee and compensation workspace." : "Set up an organization and its first manager account."}</p></div><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create organization</button></div><form onSubmit={submit}>{mode === "register" && <><label>Organization name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} autoComplete="organization" required maxLength={120} /></label><label>Your name<input value={managerName} onChange={(event) => setManagerName(event.target.value)} autoComplete="name" required maxLength={120} /></label></>}<label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : undefined} /></label>{mode === "register" && <label>Confirm password<input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" required minLength={10} /></label>}{error && <div className="form-error" role="alert">{error}</div>}<button className="button-primary auth-submit" disabled={saving}>{saving ? "Please wait…" : mode === "login" ? "Sign in" : "Create organization"}</button></form>{mode === "login" && <div className="demo-credentials"><strong>Demo manager</strong><span>hr.manager@acme.test</span><span>Password: 1234567890</span><button type="button" onClick={() => { setEmail("hr.manager@acme.test"); setPassword("1234567890"); }}>Use demo account</button></div>}</section></main>;
}

function OrganizationAdmin({ referenceData, onRefresh }: { referenceData: ReferenceData | null; onRefresh: () => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [newDepartmentManager, setNewDepartmentManager] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const managers = referenceData?.hr_managers ?? [];

  async function createManager(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await createHrManager({ full_name: fullName, email, password, password_confirmation: passwordConfirmation });
      setFullName(""); setEmail(""); setPassword(""); setPasswordConfirmation("");
      await onRefresh(); setMessage("HR manager added.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function createOrgDepartment(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await createDepartment({ name: departmentName, hr_manager_id: Number(newDepartmentManager) });
      setDepartmentName(""); await onRefresh(); setMessage("Department added.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function reassignDepartment(departmentId: number, managerId: number) {
    setBusy(true); setError(""); setMessage("");
    try { await updateDepartment(departmentId, { hr_manager_id: managerId }); await onRefresh(); setMessage("Department HR manager updated."); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  if (!referenceData) return <section className="panel table-message">Loading organization settings…</section>;
  return <div className="organization-admin">
    <section className="panel admin-intro"><div className="panel-heading"><div><h2>Organization access</h2><p>Manage department ownership and HR manager accounts for {"your organization"}.</p></div></div><p className="form-hint">HR managers can access employees in their assigned departments. One HR manager can own multiple departments. The admin can access all organization employees.</p></section>
    <div className="admin-form-grid">
      <section className="panel admin-form-panel"><div className="panel-heading"><div><h2>Add HR manager</h2><p>Create an organization-scoped HR account</p></div><UserPlus size={18} /></div><form onSubmit={createManager} className="admin-form"><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} /></label><label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /></label><label>Confirm password<input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={10} required /></label><button className="button-primary" disabled={busy}>Add HR manager</button></form></section>
      <section className="panel admin-form-panel"><div className="panel-heading"><div><h2>Add department</h2><p>Assign an HR manager when creating it</p></div><Building2 size={18} /></div><form onSubmit={createOrgDepartment} className="admin-form"><label>Department name<input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} required maxLength={100} /></label><label>HR manager<select value={newDepartmentManager} onChange={(event) => setNewDepartmentManager(event.target.value)} required><option value="">Choose a manager</option>{managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.full_name} · {manager.role === "admin" ? "Admin" : manager.email}</option>)}</select></label><p className="form-hint">The department code is generated from its name.</p><button className="button-primary" disabled={busy || managers.length === 0}>Add department</button></form></section>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    <section className="panel department-admin-panel"><div className="panel-heading"><div><h2>Departments</h2><p>Change the manager responsible for each department.</p></div><span className="result-count">{referenceData.departments.length} departments</span></div><div className="table-scroll"><table><thead><tr><th>Department</th><th>Code</th><th>HR manager</th></tr></thead><tbody>{referenceData.departments.map((department) => <tr key={department.id}><td>{department.name}</td><td>{department.code}</td><td><select aria-label={`HR manager for ${department.name}`} value={department.hr_manager.id} disabled={busy} onChange={(event) => reassignDepartment(department.id, Number(event.target.value))}>{managers.map((manager) => <option value={manager.id} key={manager.id}>{manager.full_name} · {manager.role === "admin" ? "Admin" : manager.email}</option>)}</select></td></tr>)}</tbody></table></div></section>
  </div>;
}

function DepartmentIndex({ isAdmin, referenceData, onRefresh, onOpen }: { isAdmin: boolean; referenceData: ReferenceData | null; onRefresh: () => Promise<void>; onOpen: (id: number) => void }) {
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof fetchDepartments>>>([]);
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    setError("");
    try { setDepartments(await fetchDepartments()); }
    catch (reason) { setError((reason as Error).message); }
  }

  useEffect(() => { void reload(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await createDepartment({ name, hr_manager_id: Number(managerId) });
      setName(""); setManagerId("");
      await Promise.all([reload(), onRefresh()]);
      setMessage("Department created.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="department-page">
    {isAdmin && <section className="panel admin-form-panel"><div className="panel-heading"><div><h2>Create department</h2><p>Add a department to this organization and assign its HR manager.</p></div><Building2 size={18} /></div><form onSubmit={submit} className="admin-form department-create-form"><label>Department name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label><label>HR manager<select value={managerId} onChange={(event) => setManagerId(event.target.value)} required><option value="">Choose a manager</option>{(referenceData?.hr_managers ?? []).map((manager) => <option value={manager.id} key={manager.id}>{manager.full_name} · {manager.role === "admin" ? "Admin" : manager.email}</option>)}</select></label><p className="form-hint">A unique department code is generated from its name.</p><button className="button-primary" disabled={busy || !referenceData?.hr_managers.length}>Create department</button></form>{error && <div className="form-error department-form-message" role="alert">{error}</div>}{message && <div className="success-banner department-form-message" role="status">{message}</div>}</section>}
    {!isAdmin && error && <div className="error-banner" role="alert">{error}<button onClick={() => void reload()}>Retry</button></div>}
    <section className="panel department-list-panel"><div className="panel-heading"><div><h2>Departments</h2><p>Browse department details and employee rosters.</p></div><span className="result-count">{departments.length} departments</span></div><div className="department-card-grid">{departments.map((department) => <button className="department-card" key={department.id} onClick={() => onOpen(department.id)}><span className="department-card-icon"><Building2 size={19} /></span><span className="department-card-copy"><strong>{department.name}</strong><small>{department.code} · HR manager {department.hr_manager.full_name}</small></span><span className="department-card-count"><strong>{department.employee_count.toLocaleString()}</strong><small>employees</small></span><ChevronRight size={17} className="department-card-arrow" /></button>)}{departments.length === 0 && !error && <p className="department-empty">Loading departments…</p>}</div></section>
  </div>;
}

function DepartmentDetail({ departmentId, onBack }: { departmentId: number; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchDepartment>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setError("");
    fetchDepartment(departmentId, page).then((data) => { if (live) setResult(data); })
      .catch((reason: Error) => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [departmentId, page]);

  if (error) return <section className="panel department-error"><p role="alert">{error}</p><button className="button-secondary" onClick={onBack}>Back to departments</button></section>;
  if (!result) return <section className="panel table-message">Loading department…</section>;

  const { data: department, employees, meta } = result;
  return <div className="department-detail-page">
    <button className="department-back" onClick={onBack}><ChevronLeft size={16} /> All departments</button>
    <section className="panel department-summary"><div className="department-detail-mark"><Building2 size={21} /></div><div className="department-summary-copy"><div className="eyebrow">DEPARTMENT DETAILS</div><h2>{department.name}</h2><p>{department.code}</p></div><span className="department-employee-total"><strong>{department.employee_count.toLocaleString()}</strong><small>employees</small></span></section>
    <section className="panel department-info"><div><span>HR manager</span><strong>{department.hr_manager.full_name}</strong></div><div><span>Department code</span><strong>{department.code}</strong></div><div><span>Employees</span><strong>{department.employee_count.toLocaleString()}</strong></div></section>
    <section className="panel department-roster"><div className="panel-heading"><div><h2>Employee roster</h2><p>Employees assigned to {department.name}.</p></div><span className="result-count">{department.employee_count.toLocaleString()} employees</span></div><div className="table-scroll"><table><thead><tr><th>Employee</th><th>Job title</th><th>Country</th><th>Status</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><div className="person-cell"><span className="person-avatar">{initials(employee.full_name)}</span><span><strong>{employee.full_name}</strong><small>{employee.employee_number} · {employee.email}</small></span></div></td><td>{employee.job_title}</td><td>{employee.country_code}</td><td><span className={`status-pill ${employee.status}`}>{employee.status === "active" ? "Active" : employee.status === "leave" ? "On leave" : "Terminated"}</span></td></tr>)}{employees.length === 0 && <tr><td colSpan={4} className="table-message">No employees assigned to this department.</td></tr>}</tbody></table></div><div className="pagination"><span>Showing <strong>{meta.total ? ((meta.page - 1) * meta.per_page + 1).toLocaleString() : 0}–{Math.min(meta.page * meta.per_page, meta.total).toLocaleString()}</strong> of <strong>{meta.total.toLocaleString()}</strong></span><div className="page-controls"><button aria-label="Previous page" disabled={meta.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button><span>Page {meta.page} of {meta.total_pages}</span><button aria-label="Next page" disabled={meta.page >= meta.total_pages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div></section>
  </div>;
}

const pieColors = ["#617ce0", "#36a29a", "#e3a348", "#bc70b4", "#e57663", "#5887b5", "#8caa58", "#dc7894", "#8b80cb"];

function PayrollPieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let angle = -Math.PI / 2;
  const slices = data.filter((item) => item.value > 0).map((item, index) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const startX = 110 + 96 * Math.cos(angle);
    const startY = 110 + 96 * Math.sin(angle);
    const endAngle = angle + sweep;
    const endX = 110 + 96 * Math.cos(endAngle);
    const endY = 110 + 96 * Math.sin(endAngle);
    const path = sweep >= Math.PI * 2 - 0.0001
      ? "M 110 110 L 110 14 A 96 96 0 1 1 110 206 A 96 96 0 1 1 110 14 Z"
      : `M 110 110 L ${startX} ${startY} A 96 96 0 ${sweep > Math.PI ? 1 : 0} 1 ${endX} ${endY} Z`;
    angle = endAngle;
    return { ...item, path, color: pieColors[index % pieColors.length] };
  });

  return <div className="assistant-pie-layout">
    <svg className="assistant-pie" viewBox="0 0 220 220" role="img" aria-label={`Pie chart showing ${total.toLocaleString()} employees by ${data.length} ${data.length === 1 ? "group" : "groups"}`}>
      <title>Employee count by department</title>
      {slices.map((slice) => <path key={slice.label} d={slice.path} fill={slice.color} stroke="white" strokeWidth="1.5"><title>{slice.label}: {slice.value.toLocaleString()} ({((slice.value / total) * 100).toFixed(1)}%)</title></path>)}
    </svg>
    <ul className="assistant-pie-legend">{slices.map((slice) => <li key={slice.label}><span className="assistant-pie-swatch" style={{ backgroundColor: slice.color }} /><span className="assistant-pie-name" title={slice.label}>{slice.label}</span><strong>{slice.value.toLocaleString()}</strong><span className="assistant-pie-percent">{((slice.value / total) * 100).toFixed(1)}%</span></li>)}</ul>
  </div>;
}

function PayrollAssistantView() {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [response, setResponse] = useState<PayrollAssistantResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(text: string, page = 1) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion) return;
    setBusy(true); setError(""); setSubmittedQuestion(cleanQuestion);
    try { setResponse(await askPayrollAssistant(cleanQuestion, page)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question, 1);
  }

  const report = response?.report;
  const isPieChart = report?.chart_type === "pie" || /\b(?:pie|pi)[\s-]*chart\b/i.test(submittedQuestion);
  const columns = report?.report_type === "salary_increases"
    ? [{ key: "employee", label: "Employee" }, { key: "employee_number", label: "Employee ID" }, { key: "department", label: "Department" }, { key: "effective_from", label: "Effective date" }, { key: "previous_amount", label: "Previous pay" }, { key: "amount", label: "New pay" }, { key: "reason", label: "Reason" }]
    : [{ key: "employee", label: "Employee" }, { key: "employee_number", label: "Employee ID" }, { key: "job_title", label: "Job title" }, { key: "department", label: "Department" }, { key: "country", label: "Country" }, { key: "status", label: "Status" }];

  return <div className="assistant-page">
    <section className="panel assistant-intro"><span className="assistant-mark"><Sparkles size={18} /></span><div><h2>Ask about your people data</h2><p>Get an employee list, compare headcount, or request a chart. Results follow your existing organization and department access.</p></div></section>
    <section className="panel assistant-ask-panel"><form onSubmit={submit}><label htmlFor="payroll-question">What would you like to know?</label><textarea id="payroll-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: List employees whose salary increased after June 20, 2025" maxLength={500} rows={3} disabled={busy} /><div className="assistant-form-footer"><span>{question.length}/500 · Employee and compensation data only</span><button className="button-primary assistant-send" disabled={busy || !question.trim()}>{busy ? <><span className="assistant-spinner" /> Preparing report…</> : <><Send size={14} /> Ask</>}</button></div></form><div className="assistant-suggestions"><span>Try asking</span>{["List employees whose salary increased after June 20, 2025", "Create a chart of employees by department", "Show the employee roster for India"].map((suggestion) => <button key={suggestion} disabled={busy} onClick={() => { setQuestion(suggestion); void ask(suggestion); }}>{suggestion}</button>)}</div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {response && <section className="assistant-response" aria-live="polite"><div className="assistant-answer"><span className="assistant-mark small"><Sparkles size={14} /></span><div><strong>Payroll assistant</strong><p>{response.answer}</p></div></div>
      {report && <>
        <section className="panel assistant-report-panel"><div className="panel-heading"><div><h2>{report.title}</h2><p>{submittedQuestion}</p></div><span className="result-count">{report.total.toLocaleString()} results</span></div>
          {report.chart.length > 0 && <div className="assistant-chart"><div className="assistant-chart-title"><strong>{isPieChart ? "Pie chart" : "Report chart"}</strong><span>Count by {report.chart_group}</span></div>{isPieChart ? <PayrollPieChart data={report.chart} /> : report.chart.map((item) => { const max = Math.max(...report.chart.map((datum) => datum.value), 1); return <div className="assistant-chart-row" key={item.label}><span className="assistant-chart-label" title={item.label}>{item.label}</span><div className="assistant-chart-track"><span style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }} /></div><strong>{item.value.toLocaleString()}</strong></div>; })}</div>}
          {report.show_table && <>
            <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={`${String(row.employee_number ?? row.employee)}-${String(row.effective_from ?? index)}`}>{columns.map((column) => <td key={column.key}>{formatReportValue(column.key, row[column.key], row.currency)}</td>)}</tr>)}{report.rows.length === 0 && <tr><td colSpan={columns.length} className="table-message">No matching records were found in your accessible data.</td></tr>}</tbody></table></div>
            <div className="pagination"><span>Showing <strong>{report.total ? ((report.page - 1) * report.per_page + 1).toLocaleString() : 0}–{Math.min(report.page * report.per_page, report.total).toLocaleString()}</strong> of <strong>{report.total.toLocaleString()}</strong></span><div className="page-controls"><button aria-label="Previous report page" disabled={busy || report.page <= 1} onClick={() => void ask(submittedQuestion, report.page - 1)}><ChevronLeft size={16} /></button><span>Page {report.page} of {report.total_pages}</span><button aria-label="Next report page" disabled={busy || report.page >= report.total_pages} onClick={() => void ask(submittedQuestion, report.page + 1)}><ChevronRight size={16} /></button></div></div>
          </>}
        </section>
      </>}
    </section>}
  </div>;
}

function formatReportValue(key: string, value: string | number | null | undefined, currency?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  if ((key === "amount" || key === "previous_amount") && typeof value === "number") return `${value.toLocaleString()} ${currency ?? ""}`.trim();
  return String(value);
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

function Compensation({ dashboard, countryNames }: { dashboard: Dashboard | null; countryNames: Record<string, string> }) {
  if (!dashboard) return <section className="panel table-message">Loading compensation overview…</section>;
  return <div className="insights-grid">
    <section className="panel insight-panel"><div className="panel-heading"><div><div className="section-kicker"><Building2 size={15} /> LOCATION</div><h2>Pay by country</h2><p>Average annual salary and headcount</p></div></div><MetricTable rows={dashboard.by_country} countryNames={countryNames} /></section>
    <section className="panel insight-panel"><div className="panel-heading"><div><div className="section-kicker"><BriefcaseBusiness size={15} /> ORGANIZATION</div><h2>Pay by department</h2><p>Average annual salary and headcount</p></div></div><MetricTable rows={dashboard.by_department} /></section>
    <section className="panel insight-panel wide"><div className="panel-heading"><div><div className="section-kicker"><CircleDollarSign size={15} /> PAYROLL MIX</div><h2>Compensation by currency</h2><p>Native-currency view — totals are not converted or combined</p></div></div><div className="currency-cards">{dashboard.by_currency.map((row) => <div className="currency-card" key={row.currency}><span className="currency-symbol">{currencyGlyph[row.currency] ?? row.currency}</span><span><small>{row.currency} annualized payroll</small><strong>{formatCurrency(row.total_salary, row.currency)}</strong><small>{row.employee_count.toLocaleString()} employees on roster · avg {formatCurrency(row.average_salary, row.currency)}</small></span></div>)}</div></section>
    <div className="insight-footnote"><Activity size={15} /> Summaries include each employee on the roster, including people on leave, using their latest salary effective as of {formatDate(dashboard.as_of)}. Values in different currencies must not be compared directly.</div>
  </div>;
}

function MetricTable({ rows, countryNames = {} }: { rows: Metric[]; countryNames?: Record<string, string> }) {
  if (!rows.length) return <div className="table-message">No compensation data yet.</div>;
  const maxCount = Math.max(...rows.map((row) => row.employee_count));
  return <div className="metric-list">{rows.map((row) => <div className="metric-row" key={`${row.key}-${row.currency}`}><div className="metric-title"><strong>{countryNames[row.key] ?? row.key}</strong><span>{row.employee_count.toLocaleString()} people · {row.currency}</span></div><div className="metric-data"><strong>{formatCurrency(row.average_salary, row.currency)}</strong><small>average</small></div><div className="metric-bar"><span style={{ width: `${Math.max(5, row.employee_count / maxCount * 100)}%` }} /></div></div> )}</div>;
}

function SortHead({ label, sortKey, active, direction, onSort }: { label: string; sortKey: string; active: string; direction: string; onSort: (key: string) => void }) {
  const Icon = active === sortKey ? direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  return <th><button className="sort-button" onClick={() => onSort(sortKey)}>{label}<Icon size={13} /></button></th>;
}

function EmployeePanel({ employee, countryNames, onClose, onAdd, onEdit }: { employee: Employee; countryNames: Record<string, string>; onClose: () => void; onAdd: () => void; onEdit: () => void }) {
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="employee-panel" role="dialog" aria-modal="true" aria-label={`${employee.full_name} profile`}><div className="drawer-top"><span>EMPLOYEE PROFILE</span><div className="drawer-actions"><button className="small-action" onClick={onEdit}><Pencil size={14} /> Edit details</button><button aria-label="Close profile" className="icon-button" onClick={onClose}><X size={19} /></button></div></div><div className="profile-header"><div className="profile-avatar">{initials(employee.full_name)}</div><h2>{employee.full_name}</h2><p>{employee.job_title}</p><span className={`status-pill ${employee.status}`}>{employee.status === "active" ? "Active" : employee.status === "leave" ? "On leave" : "Terminated"}</span></div><div className="profile-section"><div className="profile-section-title"><h3>Personal details</h3><span>#{employee.employee_number}</span></div><Detail label="Email" value={employee.email} /><Detail label="Department" value={employee.department} /><Detail label="Location" value={`${countryNames[employee.country_code] ?? employee.country_code} (${employee.country_code})`} /><Detail label="Hire date" value={formatDate(employee.hired_on)} /></div><div className="profile-section compensation-section"><div className="profile-section-title"><div><h3>Compensation</h3><p>Annual base salary</p></div><button className="small-action" onClick={onAdd}><Plus size={15} /> Add change</button></div>{employee.current_salary ? <div className="current-pay"><span>Current salary</span><strong>{formatCurrency(employee.current_salary.amount, employee.current_salary.currency)}</strong><small>{employee.current_salary.currency} · effective {formatDate(employee.current_salary.effective_from)}</small></div> : <div className="empty-pay">No salary record</div>}<h4 className="history-title">Salary history</h4><div className="history-list">{employee.salary_history?.map((record) => <div className="history-row" key={record.id}><span className="history-dot" /><div><strong>{formatCurrency(record.amount, record.currency)}</strong><small>{formatDate(record.effective_from)} · {record.reason}</small></div></div>)}</div></div><div className="drawer-disclaimer">Salary records are retained as history. Changes are effective from the date shown and do not rewrite earlier records.</div></aside></div>;
}

function EmployeeEditDialog({ mode, employee, countries, departments, onClose, onSave }: { mode: "create" | "edit"; employee?: Employee; countries: { code: string; name: string }[]; departments: string[]; onClose: () => void; onSave: (input: EmployeeUpdate, initialSalary?: SalaryInput) => Promise<void> }) {
  const [form, setForm] = useState<EmployeeUpdate>(() => employee ? ({
    employee_number: employee.employee_number, first_name: employee.first_name, last_name: employee.last_name,
    email: employee.email, country_code: employee.country_code, department: employee.department,
    job_title: employee.job_title, status: employee.status, hired_on: employee.hired_on,
  }) : ({ employee_number: "", first_name: "", last_name: "", email: "", country_code: countries[0]?.code ?? "", department: departments[0] ?? "", job_title: "", status: "active", hired_on: new Date().toISOString().slice(0, 10) }));
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
  return <div className="overlay modal-overlay"><section className="salary-modal employee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="employee-edit-title"><div className="modal-head"><div><div className="eyebrow">EMPLOYEE RECORD</div><h2 id="employee-edit-title">{mode === "create" ? "Add employee" : "Edit employee details"}</h2><p>{mode === "create" ? "Add a person to the organization directory." : "Update identity and organization information."}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><div className="employee-edit-grid"><label>Employee number<input required value={form.employee_number} onChange={(event) => change("employee_number", event.target.value)} /></label><label>Status<select aria-label="Employee status" value={form.status} onChange={(event) => change("status", event.target.value as Employee["status"])}><option value="active">Active</option><option value="leave">On leave</option><option value="terminated">Terminated</option></select></label><label>First name<input required value={form.first_name} onChange={(event) => change("first_name", event.target.value)} /></label><label>Last name<input required value={form.last_name} onChange={(event) => change("last_name", event.target.value)} /></label><label>Email<input type="email" required value={form.email} onChange={(event) => change("email", event.target.value)} /></label><label>Country<select aria-label="Country" required value={form.country_code} onChange={(event) => { change("country_code", event.target.value); setSalaryCurrency(currencyByCountry[event.target.value] ?? "USD"); }}>{countries.map(({ code, name }) => <option value={code} key={code}>{name}</option>)}</select></label><label>Department<select aria-label="Department" required value={form.department} onChange={(event) => change("department", event.target.value)}>{departments.map((department) => <option value={department} key={department}>{department}</option>)}</select></label><label>Job title<input required value={form.job_title} onChange={(event) => change("job_title", event.target.value)} /></label><label>Hire date<input type="date" required value={form.hired_on} onChange={(event) => { change("hired_on", event.target.value); setSalaryEffectiveDate(event.target.value); }} /></label></div>{mode === "create" && <section className="initial-salary-section"><label className="initial-salary-toggle"><input type="checkbox" aria-label="Add initial salary" checked={addInitialSalary} onChange={(event) => setAddInitialSalary(event.target.checked)} /><span><strong>Add initial salary</strong><small>Record compensation as part of employee creation.</small></span></label>{addInitialSalary && <div className="initial-salary-fields"><label>Annual salary<div className="amount-input"><select aria-label="Initial salary currency" value={salaryCurrency} onChange={(event) => setSalaryCurrency(event.target.value)}>{["USD", "GBP", "INR", "EUR", "CAD", "AUD", "SGD", "JPY"].map((code) => <option key={code}>{code}</option>)}</select><input aria-label="Initial annual salary" type="number" min="0.01" step="0.01" value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} placeholder="0.00" required /></div></label><label>Effective date<input aria-label="Initial salary effective date" type="date" value={salaryEffectiveDate} onChange={(event) => setSalaryEffectiveDate(event.target.value)} required /></label><label>Reason<input aria-label="Initial salary reason" value={salaryReason} onChange={(event) => setSalaryReason(event.target.value)} maxLength={240} required /></label></div>}</section>}{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving || !countries.length || !departments.length}>{saving ? "Saving…" : mode === "create" ? "Create employee" : "Save employee"}</button></div></form></section></div>;
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

const currencyByCountry: Record<string, string> = { US: "USD", GB: "GBP", IN: "INR", DE: "EUR", CA: "CAD", AU: "AUD", SG: "SGD", JP: "JPY" };
const currencyGlyph: Record<string, string> = { USD: "$", GBP: "£", INR: "₹", EUR: "€", CAD: "C$", AUD: "A$", SGD: "S$", JPY: "¥" };
