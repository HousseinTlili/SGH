#!/usr/bin/env bash
# Wipes the infrastructure data and starts it again (Postgres, RabbitMQ, Keycloak).
# Services must be restarted afterwards: they re-run their migrations and seed on an empty database.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f infra/docker-compose.yml"

$COMPOSE down -v
$COMPOSE up -d

wait_until() { # description, command, seconds
  local what="$1" cmd="$2" max="${3:-120}" i=0
  printf 'waiting for %s ' "$what"
  until eval "$cmd" >/dev/null 2>&1; do
    i=$((i + 2)); [ "$i" -ge "$max" ] && { echo "TIMEOUT"; exit 1; }
    printf '.'; sleep 2
  done
  echo " ok"
}

wait_until "postgres" "docker exec sgh-postgres pg_isready -U sgh" 60
wait_until "rabbitmq" "docker exec sgh-rabbitmq rabbitmq-diagnostics -q ping" 90
wait_until "keycloak realm sgh" "curl -sf http://localhost:8180/realms/sgh" 180
echo "Infrastructure is ready. Start the services, the gateway and the front end."
