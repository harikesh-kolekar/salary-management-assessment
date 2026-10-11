# ACME Salary Management

An HR manager workspace for a synthetic 10,000-person, multi-country workforce. The app combines a Rails JSON API, SQLite relational storage, and a React/TypeScript single-page UI. It supports employee search/filtering, profiles, salary history and effective-dated salary changes, plus headcount and compensation summaries by country, department, and currency.

> Demo data only. This MVP has no authentication or authorization and is not suitable for real employee salary or personal data. Read [the requirements](REQUIREMENTS.md) for the boundary and explicit omissions.

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

Open <http://127.0.0.1:5173>. The Vite development server proxies `/api` to Rails. Seed data is synthetic (`example.test` emails), deterministic, and safe to rerun: existing employee and effective-date records are retained. To rebuild the local demo data from scratch, run `bin/rails db:drop db:create db:migrate db:seed` in `api`.

## Tests and production build

```sh
cd salary-management/api
bundle exec rails test

cd ../web
pnpm test
pnpm build
```

The Rails tests cover directory search/pagination, profiles, salary validation/history, future effective dates, dashboard grouping, and not-found behavior. The React tests cover currency/date rendering and API-backed directory search.

## API outline

- `GET /up` — health check.
- `GET /api/v1/employees?q=&country=&department=&status=&page=&per_page=&sort=&direction=` — filtered, sorted, bounded page.
- `GET /api/v1/employees/:id` — profile and salary history.
- `PATCH /api/v1/employees/:id` — validate and update employee identity and organization fields.
- `POST /api/v1/employees/:employee_id/salary_records` — append a validated salary change.
- `GET /api/v1/dashboard` — headcount and current pay grouped in each native currency.

All aggregate calculations are performed in SQL; salary is never summed or averaged across currencies. Pagination is capped at 100 rows. Salary changes are append-only through the application API, with a unique `(employee_id, effective_from)` constraint and checks for positive amounts, supported currencies, and later effective dates.

## Deployable container

The root `Dockerfile` builds the React app and packages it with Rails. `docker-compose.yml` persists SQLite under a named volume and serves the static frontend and API from one origin. Create a strong secret key before running it:

```sh
export SECRET_KEY_BASE="$(cd api && bundle exec rails secret)"
docker compose up --build
```

Then open <http://127.0.0.1:3000>. Seed optional synthetic rows with `docker compose exec app bundle exec rails db:seed`. Provide a persistent disk for `/app/storage` on a hosting platform. A public demo can use synthetic data, but real employee records require authentication, authorization, access audit, encrypted backups, and an organization-approved privacy review first.

## Repository map

- `REQUIREMENTS.md` — one-page product framing and boundaries.
- `docs/engineering-notes.md` — architecture, data model, scale and trade-offs, AI-assisted workflow.
- `api/` — Rails API, migrations, deterministic seed, model and integration tests.
- `web/` — React interface, TypeScript API client, formatting helpers and tests.

## Demo walkthrough

1. Open People and see the 10,000-person directory and on-roster headcount.
2. Search for an employee number or filter by country, department, and status; move between pages.
3. Open an employee, edit identity or organization details such as country, department, and status, then inspect salary history or add a future-dated salary change.
4. Open Compensation to compare average salary and headcount within each country/department and inspect native-currency totals.

The `docs/engineering-notes.md` contains the design choices and AI-use notes for an assessment walkthrough. No public deployment URL or recording has been created in this workspace; a hosting account/target is needed for those submission artifacts.
