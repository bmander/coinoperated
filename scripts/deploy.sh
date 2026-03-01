#!/bin/bash
set -e
cd frontend
VITE_BASE_PATH=/coinop/ npm run build
cd ..
rm -rf backend/static
cp -r frontend/dist backend/static
cd backend
gcloud app deploy --quiet
cd ..
gcloud app deploy dispatch.yaml --quiet
