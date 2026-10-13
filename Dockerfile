FROM node:24-bookworm-slim AS frontend
RUN npm install --global pnpm@11.19.0
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

FROM ruby:3.3.3-slim AS app
RUN apt-get update -qq && apt-get install --no-install-recommends -y build-essential ca-certificates libpq-dev libsqlite3-0 libsqlite3-dev libyaml-0-2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV RAILS_ENV=production BUNDLE_WITHOUT="development:test" RAILS_SERVE_STATIC_FILES=1
COPY api/Gemfile api/Gemfile.lock ./
RUN bundle install
COPY api/ ./
COPY --from=frontend /web/dist/ ./public/
RUN mkdir -p storage tmp/pids
EXPOSE 3000
CMD ["sh", "-c", "bundle exec rails db:prepare && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then bundle exec rails db:seed; fi && exec bundle exec rails server -b 0.0.0.0"]
