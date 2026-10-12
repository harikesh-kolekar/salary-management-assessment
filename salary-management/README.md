# ACME Salary Management

An HR manager workspace for a synthetic 10,000-person, multi-country workforce. The app combines a Rails JSON API, SQLite relational storage, and a React/TypeScript single-page UI. It supports employee search/filtering, profiles, salary history and effective-dated salary changes, plus headcount and compensation summaries by country, department, and currency.

> This MVP includes manager login and organization-level data isolation, but it is still a demo and is not approved for production employee data. Production use still needs security review, access auditing, backup protection, and operational controls. Read [the requirements](REQUIREMENTS.md) for scope and omissions.

## Run locally

Requirements: Ruby 3.3.3 with Rails 8.1.4 (RVM is already configured on the development machine), Node.js 20.19+ (the bundled Node 24 runtime is fine), and pnpm 11.

In terminal 1:

```sh
cd salary-management/api
rvm use 3.3.3
bundle install
bin/rails db:prepare
bin/rails db:seed
bin/rails server -p 3000
```

In terminal 2:

```sh
cd salary-management/web
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:5173>. The Vite development server proxies `/api` to Rails. Seed data is synthetic (`example.test` emails), deterministic, and safe to rerun: existing employee and effective-date records are retained. The demo manager is `hr.manager@acme.test` with password `1234567890`. Managers can also create a new organization and account from the sign-in screen. To rebuild the local demo data from scratch, run `bin/rails db:drop db:create db:migrate db:seed` in `api`.

## Tests and production build

```sh
cd salary-management/api
bundle exec rails test

cd ../web
pnpm test
pnpm build
```

The Rails tests cover organization registration, manager login, tenant isolation, directory search/pagination, profiles, salary validation/history, future effective dates, dashboard grouping, and not-found behavior. The React tests cover authentication and organization registration, employee workflows, currency/date rendering, and API-backed directory search.

## API outline

- `GET /up` — health check.
- `POST /api/v1/organizations` — register an organization and its first manager; returns a bearer token.
- `POST /api/v1/session` — manager sign-in; returns a bearer token.
- `GET /api/v1/session` — validate the current bearer token and return its manager and organization.
- `POST /api/v1/assistant/ask` — project-scoped employee and compensation Q&A with paginated report data and optional chart aggregates.
- `GET /api/v1/employees?q=&country=&department=&status=&page=&per_page=&sort=&direction=` — filtered, sorted, bounded page.
- `GET /api/v1/employees/:id` — profile and salary history.
- `POST /api/v1/employees` — create a validated employee directory record.
- `PATCH /api/v1/employees/:id` — validate and update employee identity and organization fields.
- `POST /api/v1/employees/:employee_id/salary_records` — append a validated salary change.
- `GET /api/v1/dashboard` — headcount and current pay grouped in each native currency.

All application endpoints except organization registration, sign-in, and health require a bearer token. Employee searches, profiles, changes, salaries, and dashboard summaries are scoped to the signed-in manager’s organization. All aggregate calculations are performed in SQL; salary is never summed or averaged across currencies. Pagination is capped at 100 rows. Salary changes are append-only through the application API, with a unique `(employee_id, effective_from)` constraint and checks for positive amounts, supported currencies, and later effective dates.

## Deployable container

The root `Dockerfile` builds the React app and packages it with Rails. `docker-compose.yml` persists SQLite under a named volume and serves the static frontend and API from one origin. Create a strong secret key before running it:

```sh
export SECRET_KEY_BASE="$(cd api && bundle exec rails secret)"
export GEMINI_API_KEY="your-server-side-api-key"
# Optional: export GEMINI_MODEL="gemini-3.8-flash"
docker compose up --build
```

Then open <http://127.0.0.1:3000>. Seed optional synthetic rows with `docker compose exec app bundle exec rails db:seed`. Provide a persistent disk for `/app/storage` on a hosting platform. A public demo can use synthetic data. Before real employee records are loaded, add access audit logging, encrypted backups, rate limiting, and an organization-approved security and privacy review.

The payroll assistant uses RubyLLM with the Gemini API and reads `GEMINI_API_KEY` from the server environment. Never put the key in React, source code, or a committed `.env` file. Local Rails development also needs the variable exported before starting the API. Without a Gemini API key, the assistant explains how to configure the service and does not call the model.

The assistant only receives the authenticated user's existing organization and department-scoped employee relation. Its only model tool runs fixed, parameterized reports; it cannot run arbitrary SQL or access external tools. It supports employee lists, salary increases, headcount, and count charts grouped by department, country, status, or salary-change month.

## Repository map

- `REQUIREMENTS.md` — one-page product framing and boundaries.
- `docs/engineering-notes.md` — architecture, data model, scale and trade-offs, AI-assisted workflow.
- `api/` — Rails API, migrations, deterministic seed, model and integration tests.
- `web/` — React interface, TypeScript API client, formatting helpers and tests.

## Demo walkthrough

1. Open People and see the 10,000-person directory and on-roster headcount.
2. Search for an employee number or filter by country, department, and status; move between pages.
3. Add an employee or open an existing profile to edit identity and organization details such as country, department, and status. New employees can have salary added afterward from their profile.
4. Inspect salary history or add a future-dated salary change with a reason and local currency.
5. Open Compensation to compare average salary and headcount within each country/department and inspect native-currency totals.

The `docs/engineering-notes.md` contains the design choices and AI-use notes for an assessment walkthrough. No public deployment URL or recording has been created in this workspace; a hosting account/target is needed for those submission artifacts.
