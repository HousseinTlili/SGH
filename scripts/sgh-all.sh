#!/usr/bin/env bash
# Start, stop or inspect the complete local SGH stack.
#
# Usage (Git Bash or WSL):
#   ./scripts/sgh-all.sh start
#   ./scripts/sgh-all.sh status
#   ./scripts/sgh-all.sh stop
#
# Logs are written to .run/logs. No database volume is deleted by "stop".
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
RUN="$ROOT/.run"
LOGS="$RUN/logs"
PIDS="$RUN/pids"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"

mkdir -p "$LOGS" "$PIDS"

frontend_up() {
  curl -fsS --max-time 2 "http://localhost:4200" >/dev/null 2>&1
}

start_frontend() {
  if frontend_up; then
    echo "UP        frontend (:4200, already running)"
    return 0
  fi

  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "installing frontend dependencies ..."
    (cd "$ROOT/frontend" && npm ci) >"$LOGS/frontend.build.log" 2>&1 || {
      echo "FAILED    frontend install; see $LOGS/frontend.build.log"
      return 1
    }
  fi

  echo "starting frontend ..."
  (
    cd "$ROOT/frontend"
    if command -v setsid >/dev/null 2>&1; then
      setsid nohup npm start >"$LOGS/frontend.log" 2>&1 < /dev/null &
    else
      nohup npm start >"$LOGS/frontend.log" 2>&1 < /dev/null &
    fi
    echo $! >"$PIDS/frontend.pid"
  )

  local i
  for i in $(seq 1 90); do
    if frontend_up; then
      echo "UP        frontend (:4200)"
      return 0
    fi
    sleep 2
  done

  echo "FAILED    frontend did not answer in 3 minutes; see $LOGS/frontend.log"
  return 1
}

stop_frontend() {
  local pid=""
  if [ -f "$PIDS/frontend.pid" ]; then
    pid="$(cat "$PIDS/frontend.pid")"
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    command -v pkill >/dev/null 2>&1 && pkill -P "$pid" 2>/dev/null || true
    rm -f "$PIDS/frontend.pid"
  fi

  if command -v lsof >/dev/null 2>&1; then
    local listener
    listener="$(lsof -t -iTCP:4200 -sTCP:LISTEN 2>/dev/null || true)"
    [ -n "$listener" ] && kill $listener 2>/dev/null || true
  fi

  echo "STOPPED   frontend"
}

start_all() {
  command -v docker >/dev/null 2>&1 || {
    echo "Docker is required but was not found." >&2
    return 1
  }
  command -v npm >/dev/null 2>&1 || {
    echo "Node.js/npm is required but was not found." >&2
    return 1
  }

  echo "Starting PostgreSQL, RabbitMQ and Keycloak ..."
  docker compose -f "$COMPOSE_FILE" up -d --wait || return 1

  echo "Starting six services and Gateway ..."
  "$ROOT/scripts/dev-services.sh" start || return 1

  start_frontend || return 1

  echo
  echo "SGH is ready:"
  echo "  Application  http://localhost:4200"
  echo "  Gateway      http://localhost:8080/health"
  echo "  Keycloak     http://localhost:8180"
  echo "  RabbitMQ     http://localhost:15672"
}

stop_all() {
  stop_frontend
  "$ROOT/scripts/dev-services.sh" stop
  docker compose -f "$COMPOSE_FILE" stop
  echo "Infrastructure stopped; PostgreSQL data volume was preserved."
}

status_all() {
  echo "Infrastructure:"
  docker compose -f "$COMPOSE_FILE" ps
  echo
  echo "Backend and Gateway:"
  "$ROOT/scripts/dev-services.sh" status
  echo
  if frontend_up; then
    echo "UP        frontend (:4200)"
  else
    echo "DOWN      frontend (:4200)"
  fi
}

case "${1:-start}" in
  start) start_all ;;
  stop) stop_all ;;
  restart)
    stop_all
    start_all
    ;;
  status) status_all ;;
  *)
    echo "Usage: $0 <start|stop|restart|status>" >&2
    exit 2
    ;;
esac
