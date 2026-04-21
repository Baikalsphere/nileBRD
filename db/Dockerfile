FROM postgres:16-alpine

# Copy schema — Postgres runs all .sql files in this dir on first startup
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 5432
