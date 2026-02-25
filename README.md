# CoinOperatedBrandon

A pledge-based task platform. Anyone can propose tasks, anyone can pledge money toward them, and one person (Brandon) decides which ones to do. Pledges are weighted votes — putting a credit card behind a request is a fundamentally different signal than clicking an upvote button.

No money moves until work is done. On completion, pledgers are charged via Stripe. Failed charges just fail. No contracts, no escrow, no democracy.

See [DESIGN.md](DESIGN.md) for the full design document.

## How it works

1. Anyone posts a task (a wish, a bug, a feature, a spec, a standard)
2. Patrons pledge money toward tasks they care about ($5 minimum)
3. Brandon reviews the board and ships what he wants
4. On completion, pledgers are charged; the task closes with stats

## Tech stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | FastAPI + SQLAlchemy 2.0 (async)    |
| Frontend | React 19 + TypeScript + Vite        |
| Database | PostgreSQL 16                       |
| Payments | Stripe (SetupIntents + PaymentIntents) |

## Development

### Prerequisites

- Python 3.13+
- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```sh
make install    # Create Python venv, install backend + frontend deps
cp backend/.env.example backend/.env
```

### Run

```sh
make dev        # Starts PostgreSQL, backend, and frontend concurrently
```

Or run each piece individually:

```sh
make db             # Start PostgreSQL via Docker Compose
make migrate        # Run database migrations
make dev-backend    # Start FastAPI on :8000
make dev-frontend   # Start Vite dev server on :5173
```

### Project layout

```
backend/
  app/
    main.py         # FastAPI app & routes
    config.py       # Settings (env vars)
    models.py       # SQLAlchemy ORM models
    schemas.py      # Pydantic request/response schemas
    database.py     # Async engine & session
  alembic/          # Database migrations
  alembic.ini
frontend/
  src/
    App.tsx
    api/            # API client
    components/
    pages/
docker-compose.yml  # PostgreSQL 16
Makefile
DESIGN.md           # Full design document
```
