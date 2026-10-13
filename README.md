# ACME Salary Management

An HR manager workspace for a synthetic 10,000-person, multi-country workforce. The app combines a Rails JSON API, SQLite for development/test, PostgreSQL for production, and a React/TypeScript single-page UI. It supports employee search/filtering, profiles, salary history and effective-dated salary changes, plus headcount and compensation summaries by country, department, and currency.

> This MVP includes manager login and organization-level data isolation, but it is still a demo and is not approved for production employee data. Production use still needs security review, access auditing, backup protection, and operational controls. Read [the requirements](REQUIREMENTS.md) for scope and omissions.

**Assignment brief:** [Salary Management Assessment (PDF)](docs/Salary-Management-Assessment.pdf)

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
- `POST /api/v1/mcp` — authenticated MCP Streamable HTTP endpoint exposing the read-only `ask_payroll` tool.
- `GET /api/v1/employees?q=&country=&department=&status=&page=&per_page=&sort=&direction=` — filtered, sorted, bounded page.
- `GET /api/v1/employees/:id` — profile and salary history.
- `POST /api/v1/employees` — create a validated employee directory record.
- `PATCH /api/v1/employees/:id` — validate and update employee identity and organization fields.
- `POST /api/v1/employees/:employee_id/salary_records` — append a validated salary change.
- `GET /api/v1/dashboard` — headcount and current pay grouped in each native currency.

All application endpoints except organization registration, sign-in, and health require a bearer token. Employee searches, profiles, changes, salaries, and dashboard summaries are scoped to the signed-in manager’s organization. All aggregate calculations are performed in SQL; salary is never summed or averaged across currencies. Pagination is capped at 100 rows. Salary changes are append-only through the application API, with a unique `(employee_id, effective_from)` constraint and checks for positive amounts, supported currencies, and later effective dates.

### MCP connection

The MCP endpoint accepts the same `Authorization: Bearer <access-token>` JWT issued by `POST /api/v1/session`; MCP clients must be configured to send that header and renew the access token when it expires (15 minutes). MCP tool arguments cannot set a user or organization. Rails loads the user from the verified token and scopes `ask_payroll` to that user's organization and assigned departments. The server uses the official Ruby `mcp` SDK with Streamable HTTP and a fresh stateless server context per request.

For local evaluation, point an MCP client that supports remote Streamable HTTP and custom headers at `http://127.0.0.1:3000/api/v1/mcp` and configure an access token obtained through the app sign-in API. For a non-loopback deployment, set `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` to comma-separated allowlists. This app accepts its own bearer JWT; it does not currently provide MCP OAuth 2.1 discovery/authorization endpoints for clients that require the complete OAuth flow. Read [the MCP request, auth, and tenant details](docs/architecture-and-data-flow.md#authenticated-mcp-server) before exposing the endpoint outside local evaluation.

## LLM reporting assistant

The Ask Payroll feature uses [RubyLLM](https://github.com/crmne/ruby_llm) with OpenAI's Responses API. `OPENAI_API_KEY` is read only by Rails from the server environment; `OPENAI_MODEL` optionally selects the model (default: `gpt-6-luna`). The browser never receives the provider key. Without a configured key, the assistant endpoint returns a setup-required response.

For an authenticated, in-scope question, Rails first builds the signed-in user's organization and department-scoped employee relation. RubyLLM sends the question, the assistant's reporting instructions, and a constrained, allow-listed report-tool schema to OpenAI. OpenAI returns structured arguments for `payroll_report`; Rails invokes that local tool and runs the query using fixed Active Record filters and bounded pagination. The LLM does not generate or execute SQL. The tool sends aggregate counts and chart groups to the model for a short explanation, while requested employee rows stay in Rails and go directly to the React UI. List questions show a table; count/chart questions do not include employee rows. The assistant supports employee lists, salary increases, headcount, and count charts by department, country, status, or salary-change month. Salary amounts are not combined across currencies.

See the [LLM request/data-flow diagram and implementation references](docs/architecture-and-data-flow.md#ruby-llm-and-openai-reporting-assistant) for the full flow, tenant boundaries, and code locations.

## Deployable container

The root `Dockerfile` builds the React app and packages it with Rails. Development and test use SQLite; production uses PostgreSQL through `DATABASE_URL`. `docker-compose.yml` serves the static frontend and API from one origin and retains a named volume for local storage. Set a strong Rails secret and the production database URL before starting it:

```sh
export SECRET_KEY_BASE="$(cd api && bundle exec rails secret)"
export DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
export OPENAI_API_KEY="your-openai-api-key"
# Optional: export OPENAI_MODEL="gpt-6-luna"
# Optional when exposing MCP behind a public host or browser origin:
# export MCP_ALLOWED_HOSTS="people.example.com"
# export MCP_ALLOWED_ORIGINS="https://people.example.com"
# Optional: set this to true to load the synthetic 10,000-employee demo dataset.
export SEED_DEMO_DATA=true
docker compose up --build
```

Then open <http://127.0.0.1:3000>. Demo seeding is off by default; set `SEED_DEMO_DATA=true` before startup to seed synthetic accounts and 10,000 employees. Seeding runs at container startup and is safe to rerun for employee and salary natural keys, but it resets the seeded demo users' passwords. To seed after startup, run `docker compose exec app bundle exec rails db:seed`. This Compose setup is intended for local evaluation or a synthetic-data demo, not as a production deployment template for real payroll records. Before using real employee data, add access audit logging, encrypted backups, rate limiting, and an organization-approved security and privacy review.

Never put the OpenAI key in React, source code, or a committed `.env` file. Local Rails development needs `OPENAI_API_KEY` exported before starting the API.

## Repository map

- `REQUIREMENTS.md` — one-page product framing and boundaries.
- `docs/engineering-notes.md` — architecture, data model, scale and trade-offs, AI-assisted workflow.
- `docs/architecture-and-data-flow.md` — system architecture, JWT lifecycle, RubyLLM and MCP data flows, tenant boundaries, code references, and Mermaid ER diagram.
- `api/` — Rails API, migrations, deterministic seed, model and integration tests.
- `web/` — React interface, TypeScript API client, formatting helpers and tests.

## Demo walkthrough

1. Open People and see the 10,000-person directory and on-roster headcount.
2. Search for an employee number or filter by country, department, and status; move between pages.
3. Add an employee or open an existing profile to edit identity and organization details such as country, department, and status. New employees can have salary added afterward from their profile.
4. Inspect salary history or add a future-dated salary change with a reason and local currency.
5. Open Compensation to compare average salary and headcount within each country/department and inspect native-currency totals.

No demo recording or public deployment URL is currently included in the repository. A hosting target and account are needed to deploy the app.
