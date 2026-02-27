# CLAUDE.md

## Backend

- The backend virtual environment is at `backend/.venv`. Always activate it before installing packages or running tests:
  ```
  source backend/.venv/bin/activate
  ```
- Install dev dependencies: `pip install -e ".[dev]"` (from `backend/`)
- Run tests: `pytest tests/ -q` (from `backend/`). Use `-q` (quiet) to keep output concise.
- **Worktrees**: The `.venv` is not shared across git worktrees. When working in a worktree, create a new venv:
  ```
  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
  ```

## Frontend

- Run tests: `npx vitest run` (from `frontend/`). Vitest output is already concise by default.
- Install dependencies: `npm install` (from `frontend/`)
- **Worktrees**: `node_modules/` is not shared across git worktrees. When working in a worktree, install dependencies:
  ```
  cd frontend && npm install
  ```
