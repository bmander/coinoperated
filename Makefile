VENV := backend/.venv/bin
STRIPE := $(or $(shell command -v stripe 2>/dev/null),$(HOME)/.local/bin/stripe)

.PHONY: dev dev-backend dev-frontend db migrate install

# Start everything for local development
dev: install
	@bash -c '\
	export STRIPE_WEBHOOK_SECRET=$$($(STRIPE) listen --print-secret); \
	cleanup() { kill 0; wait; }; \
	trap cleanup EXIT INT TERM; \
	docker compose up db & \
	(cd backend && $(CURDIR)/$(VENV)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) & \
	(cd frontend && npm run dev) & \
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
