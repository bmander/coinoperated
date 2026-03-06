VENV := backend/.venv/bin
STRIPE := $(or $(shell command -v stripe 2>/dev/null),$(HOME)/.local/bin/stripe)

.PHONY: dev dev-backend dev-frontend db migrate install test-db

# Start everything for local development
dev: install
	@bash -c '\
	export STRIPE_WEBHOOK_SECRET=$$($(STRIPE) listen --print-secret); \
	cleanup() { \
		trap "" INT TERM EXIT; \
		kill $$(jobs -p) 2>/dev/null; \
		docker compose stop -t 2 db 2>/dev/null; \
		wait; \
	}; \
	trap cleanup INT TERM EXIT; \
	docker compose up db & \
	(cd backend && exec $(CURDIR)/$(VENV)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) & \
	(cd frontend && exec npm run dev) & \
	$(STRIPE) listen --forward-to localhost:8000/api/webhooks/stripe & \
	wait'

# Start the FastAPI backend
dev-backend:
	cd backend && $(CURDIR)/$(VENV)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start the Vite dev server
dev-frontend:
	cd frontend && npm run dev

# Start PostgreSQL via Docker Compose
db:
	docker compose up db

# Run Alembic migrations (starts db container first)
migrate:
	docker compose up -d db
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 0.5; done
	cd backend && $(CURDIR)/$(VENV)/alembic upgrade head

# Create test database (idempotent, for existing setups without init script)
test-db:
	docker compose up -d db
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 0.5; done
	@docker compose exec db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'coinoperated_test'" | grep -q 1 \
		|| docker compose exec db psql -U postgres -c "CREATE DATABASE coinoperated_test"

# Install all dependencies
install:
	@# Recreate venv if its shebang points to a stale path (e.g. different worktree)
	@if [ -f $(VENV)/pip ] && ! head -1 $(VENV)/pip | grep -q "$(CURDIR)"; then \
		echo "Stale venv detected — recreating..."; \
		rm -rf backend/.venv; \
	fi
	python3.13 -m venv backend/.venv
	$(VENV)/pip install -e "backend/.[dev]"
	cd frontend && npm install
