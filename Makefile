VENV := backend/.venv/bin

.PHONY: dev dev-backend dev-frontend db migrate install

# Start everything for local development
dev:
	$(MAKE) -j3 db dev-backend dev-frontend

# Start the FastAPI backend
dev-backend:
	cd backend && $(CURDIR)/$(VENV)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start the Vite dev server
dev-frontend:
	cd frontend && npm run dev

# Start PostgreSQL via Docker Compose
db:
	docker compose up db

# Run Alembic migrations
migrate:
	cd backend && $(CURDIR)/$(VENV)/alembic upgrade head

# Install all dependencies
install:
	python3.13 -m venv backend/.venv
	$(VENV)/pip install -e "backend/.[dev]"
	cd frontend && npm install
