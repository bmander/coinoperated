# CLAUDE.md

## Backend

- The backend virtual environment is at `backend/.venv`. Always activate it before installing packages or running tests:
  ```
  source backend/.venv/bin/activate
  ```
- Install dev dependencies: `pip install -e ".[dev]"` (from `backend/`)
- Run tests: `pytest tests/ -v` (from `backend/`)
- **Worktrees**: The `.venv` is not shared across git worktrees. When working in a worktree, create a new venv:
  ```
  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
  ```

## Frontend

- Install dependencies: `npm install` (from `frontend/`)
- **Worktrees**: `node_modules/` is not shared across git worktrees. When working in a worktree, install dependencies:
  ```
  cd frontend && npm install
  ```
