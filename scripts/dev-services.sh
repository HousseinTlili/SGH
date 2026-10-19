#!/usr/bin/env bash
# Starts, stops and checks the six services and the gateway on this machine (no Docker needed for
# them; Postgres, RabbitMQ and Keycloak come from infra/docker-compose.yml).
#
# usage: ./scripts/dev-services.sh <start|stop|restart|status> [service ...]
#   services: patient reception consultation lab pharmacy staff gateway   (default: all of them)
#
# Each service runs with the command from its README. Output goes to .run/logs/<service>.log and the
# process id to .run/pids/<service>.pid (the .run folder is git-ignored). First start installs
# dependencies and builds, which takes a few minutes.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
RUN="$ROOT/.run"; mkdir -p "$RUN/logs" "$RUN/pids"

ALL="staff patient reception consultation lab pharmacy gateway"

port_of() { case "$1" in patient) echo 8081;; reception) echo 8082;; consultation) echo 8083;; lab) echo 8084;; pharmacy) echo 8085;; staff) echo 8086;; gateway) echo 8080;; *) return 1;; esac; }
dir_of()  { case "$1" in patient) echo services/patient-service;; reception) echo services/reception-service;; consultation) echo services/doctor-service;; lab) echo services/lab-service;; pharmacy) echo services/pharmacy-service;; staff) echo services/staff-service;; gateway) echo gateway;; esac; }

healthy() { curl -fsS --max-time 2 "http://localhost:$(port_of "$1")/health" >/dev/null 2>&1; }

# Prepares (installs or builds) and prints the command that runs the service in the foreground.
prepare() {
  local name="$1" dir; dir="$ROOT/$(dir_of "$1")"
  case "$name" in
    patient|staff|gateway)
      local jar; jar="$(ls "$dir"/target/*.jar 2>/dev/null | grep -v original | head -1)"
      if [ -z "$jar" ] || [ -n "$(find "$dir/src" "$dir/pom.xml" -newer "$jar" -print -quit 2>/dev/null)" ]; then
        echo "building $name ..." >&2
        (cd "$dir" && ./mvnw -q -B -DskipTests package) >>"$RUN/logs/$name.build.log" 2>&1 || { echo "build of $name failed, see $RUN/logs/$name.build.log" >&2; return 1; }
        jar="$(ls "$dir"/target/*.jar | grep -v original | head -1)"
      fi
      echo "java -jar $jar" ;;
    reception|consultation|pharmacy)
      if [ ! -d "$dir/node_modules" ]; then
        echo "installing $name ..." >&2
        (cd "$dir" && npm ci) >>"$RUN/logs/$name.build.log" 2>&1 || { echo "npm ci of $name failed, see $RUN/logs/$name.build.log" >&2; return 1; }
      fi
      echo "npm start" ;;
    lab)
      if [ ! -x "$dir/.venv/bin/uvicorn" ]; then
        echo "installing lab ..." >&2
        (cd "$dir" && python3 -m venv .venv && ./.venv/bin/pip install -q -r requirements.txt) >>"$RUN/logs/$name.build.log" 2>&1 || { echo "pip install of lab failed, see $RUN/logs/$name.build.log" >&2; return 1; }
      fi
      echo "./.venv/bin/uvicorn app.main:app --port 8084" ;;
  esac
}

pid_file() { echo "$RUN/pids/$1.pid"; }

start_one() {
  local name="$1"
  if healthy "$name"; then echo "UP        $name (already running)"; return 0; fi
  local cmd; cmd="$(prepare "$name")" || return 1
  local dir="$ROOT/$(dir_of "$name")"
  ( cd "$dir" && if command -v setsid >/dev/null 2>&1; then setsid nohup bash -c "$cmd" >"$RUN/logs/$name.log" 2>&1 < /dev/null & else nohup bash -c "$cmd" >"$RUN/logs/$name.log" 2>&1 < /dev/null & fi; echo $! > "$(pid_file "$name")" )
  local i
  for i in $(seq 1 90); do
    healthy "$name" && { echo "UP        $name (:$(port_of "$name"))"; return 0; }
    sleep 2
  done
  echo "FAILED    $name did not answer /health in 3 minutes, see $RUN/logs/$name.log"; return 1
}

stop_one() {
  local name="$1" port pid; port="$(port_of "$name")"
  # The recorded process, its children (npm -> node), and whatever still listens on the port.
  if [ -f "$(pid_file "$name")" ]; then
    pid="$(cat "$(pid_file "$name")")"
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    pkill -P "$pid" 2>/dev/null
    rm -f "$(pid_file "$name")"
  fi
  if command -v lsof >/dev/null 2>&1; then
    local listener; listener="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null)"
    [ -n "$listener" ] && kill $listener 2>/dev/null
  fi
  local i
  for i in $(seq 1 20); do healthy "$name" || { echo "STOPPED   $name"; return 0; }; sleep 0.5; done
  echo "STILL UP  $name (could not stop it)"; return 1
}

status_one() { if healthy "$1"; then echo "UP        $1 (:$(port_of "$1"))"; else echo "DOWN      $1 (:$(port_of "$1"))"; fi; }

cmd="${1:-}"; shift || true
targets="${*:-$ALL}"
for t in $targets; do port_of "$t" >/dev/null || { echo "unknown service '$t' (known: $ALL)" >&2; exit 2; }; done

rc=0
case "$cmd" in
  start)   for t in $targets; do start_one "$t" || rc=1; done ;;
  stop)    for t in $targets; do stop_one "$t" || rc=1; done ;;
  restart) for t in $targets; do stop_one "$t"; start_one "$t" || rc=1; done ;;
  status)  for t in $targets; do status_one "$t"; done ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
exit $rc
