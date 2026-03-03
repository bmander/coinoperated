# CoinOperatedBrandon

A pledge-based task platform. Anyone can propose tasks, anyone can pledge money toward them, and one person (Brandon) decides which ones to do. Pledges are weighted votes — putting a credit card behind a request is a fundamentally different signal than clicking an upvote button.

No money moves until work is done. On completion, pledgers are charged via Stripe. Failed charges just fail. No contracts, no escrow, no democracy.

## How it works

1. Sign in with your email via magic link
2. Post a task (a wish, a bug, a feature, a spec, a standard)
3. Pledge money toward tasks you care about ($1 minimum)
4. Brandon reviews the board and ships what he wants
5. On completion, pledgers are charged; the task closes with collection stats

## Tech stack

| Layer       | Technology                                |
|-------------|-------------------------------------------|
| Backend     | FastAPI + SQLAlchemy 2.0 (async)          |
| Frontend    | React 19 + TypeScript + Vite 7            |
| Database    | PostgreSQL 16                             |
| Payments    | Stripe (SetupIntents + PaymentIntents)    |
| Auth        | Magic link email (SMTP)                   |
| Deployment  | Google App Engine                         |
| CI/CD       | GitHub Actions (test on PR, deploy on `prod`) |

## Development

### Prerequisites

- Python 3.13+
- Node.js 20+
- Docker (for PostgreSQL)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for webhook forwarding)

### Setup

```sh
make install    # Create Python venv, install backend + frontend deps
cp .env.example .env                   # Configure local env vars
```

### Run

```sh
make dev        # Starts PostgreSQL, backend, frontend, and Stripe webhook forwarding
```

Or run each piece individually:

```sh
make db             # Start PostgreSQL via Docker Compose
make migrate        # Run database migrations
make dev-backend    # Start FastAPI on :8000
make dev-frontend   # Start Vite dev server on :5173
```

### Test

```sh
make test           # Run backend + frontend tests in parallel
make test-backend   # pytest tests/ -q
make test-frontend  # npx vitest run
```

### Lint & format

```sh
make lint           # Run ruff (backend) + eslint (frontend)
make format         # Run ruff format
```

## Project layout

```
backend/
  app/
    main.py          # FastAPI app factory
    models.py        # SQLAlchemy ORM models
    routers/         # Route handlers (tasks, pledges, admin, auth, webhooks)
    services/        # Business logic
  alembic/           # Database migrations
  tests/
  app.yaml           # App Engine config
frontend/
  src/
    api/             # fetch-based API client
    contexts/        # Auth state (React Context)
    pages/           # TaskBoard, TaskDetail, SubmitTask, Dashboard, Admin, SignIn, ...
    components/      # Layout, TaskCard, PledgeWidget, PaymentModal, ...
docker-compose.yml   # PostgreSQL 16
Makefile
```

## Deployment

The app deploys to Google App Engine via GitHub Actions. Pushing to the `prod` branch triggers:

1. Frontend and backend tests run in parallel
2. Frontend is built and copied to `backend/static/`
3. Backend deploys as an App Engine service with the frontend served as static files
4. Secrets are injected from GitHub Actions secrets into `app.yaml` at deploy time
