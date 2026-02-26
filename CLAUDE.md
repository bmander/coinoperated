# CLAUDE.md

## Backend

- The backend virtual environment is at `backend/.venv`. Always activate it before installing packages or running tests:
  ```
  source backend/.venv/bin/activate
  ```
- Install dev dependencies: `pip install -e ".[dev]"` (from `backend/`)
- Run tests: `pytest tests/ -v` (from `backend/`)
