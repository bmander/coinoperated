#!/bin/sh
# Start PostgreSQL and create databases for development/testing

pg_ctlcluster 15 main start 2>/dev/null || true

su - postgres -c "psql -v ON_ERROR_STOP=0" >/dev/null 2>&1 <<'SQL'
ALTER USER postgres PASSWORD 'postgres';
SELECT 'CREATE DATABASE coinoperated' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'coinoperated') \gexec
SELECT 'CREATE DATABASE coinoperated_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'coinoperated_test') \gexec
SQL

exec "$@"
