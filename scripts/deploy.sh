#!/bin/bash
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cd frontend
VITE_BASE_PATH=/coinop/ npm run build
cd "$ROOT_DIR"

rm -rf backend/static
cp -r frontend/dist backend/static

cd backend
gcloud app deploy --quiet
cd "$ROOT_DIR"

gcloud app deploy dispatch.yaml --quiet
