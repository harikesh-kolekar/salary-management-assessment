# Salary Management — Product Requirements

**Owner:** ACME HR · **Primary user:** HR Manager · **Status:** MVP proposal

## Goal

Replace spreadsheet-based salary tracking for ACME’s 10,000 employees across multiple countries with a dependable HR workspace. A manager must be able to find an employee’s current compensation, review salary history, and answer aggregate questions such as “How many employees do we have in each country?” and “What is the average salary by department?” without exporting and reconciling spreadsheets.

## Scope and features

- **Employee directory:** searchable, sortable, paginated list with name, employee ID, country, department, title, employment status, and current salary/currency. Filter by country, department, and status.
- **Employee profile:** view identity and organization details plus effective-dated salary history. Record a salary change with amount, currency, effective date, and reason; preserve earlier records rather than overwriting history.
- **Compensation overview:** show headcount and salary summaries grouped by country, department, and currency. State clearly that amounts in different currencies are not combined; exchange-rate conversion is outside the MVP.
- **Data integrity:** unique employee IDs; positive salary amounts; ISO currency and country codes; valid effective dates; no overlapping salary periods per employee. Seed 10,000 realistic but entirely synthetic employees for repeatable evaluation.
- **Usable demo:** responsive web UI, deterministic seed command, API-backed data, empty/error/loading states, and a concise local run/demo guide. Core business logic is covered by fast automated tests.

## Deliberately out of scope

- **Payroll execution, tax, benefits, deductions, payslips, and bank details:** these introduce country-specific legal and financial obligations; this tool is a salary information system, not a payroll processor.
- **FX normalization or cross-country “global average salary”:** a valid exchange-rate source, valuation date, and reporting policy are not specified. Show grouped native-currency totals/averages instead of misleading comparisons.
- **Employee self-service, manager approvals, and complex permissions:** the stated persona is an HR Manager. Start with an HR-only demo boundary; production deployment must add organization identity, authorization, and audit policy before real personal data is used.
- **Bulk spreadsheet import/export and integrations:** mapping, validation, and source-of-truth rules are unknown. Seeded data and individual edits demonstrate the core model first.
- **Advanced compensation planning, salary bands, equity, and analytics exports:** valuable follow-on work once the organization’s policies and questions are validated.

## Product and engineering measures

On the seeded 10,000-person dataset, the manager can find a matching employee and open their profile quickly, create a valid future-dated salary change without losing history, and view country/department summaries with currency kept explicit. API pagination and aggregation run in the database. Synthetic records contain no real employee data. The demo is not approved for production PII until authentication, access controls, audit logging, backups, and deployment security are implemented and reviewed.
