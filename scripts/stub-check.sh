#!/usr/bin/env bash
# Black-box check of one running service against the stub acceptance list
# (Notion: Stack Templates, section 3).
#
# usage: ./scripts/stub-check.sh <port> <module-folder> [options]
#   ./scripts/stub-check.sh 8083 doctor-service
#
# The protected endpoint used for the 401/403/200 check is a real one of each service (the stub
# placeholder /api/_stub/ping is gone, D25). Defaults per module folder, overridable with:
#   --protected-path PATH   a GET endpoint that needs a role
#   --role ROLE             a role that may call it
#   --wrong-role ROLE       a role that must get 403
#
# Needs the infra running (Keycloak for tokens, RabbitMQ management for the topology).
# SGH_TOKEN_CMD overrides the token command (called with a username, default scripts/token.sh).
# Items that cannot be observed from outside are reported as MANUAL and never fail the run.
set -uo pipefail

PORT="${1:?port required}"; MODULE="${2:?module folder required (e.g. doctor-service)}"; shift 2
case "$MODULE" in
  patient-service)   PROTECTED=/api/patients;     ROLE=RECEPTIONIST;   WRONG=PATIENT ;;
  reception-service) PROTECTED=/api/appointments; ROLE=RECEPTIONIST;   WRONG=NURSE ;;
  doctor-service)    PROTECTED=/api/vitals;       ROLE=NURSE;          WRONG=PATIENT ;;
  lab-service)       PROTECTED=/api/tests;        ROLE=LAB_TECHNICIAN; WRONG=PATIENT ;;
  pharmacy-service)  PROTECTED=/api/drugs;        ROLE=PHARMACIST;     WRONG=NURSE ;;
  staff-service)     PROTECTED=/api/staff;        ROLE=ADMIN;          WRONG=RECEPTIONIST ;;
  *)                 PROTECTED=/api/_stub/ping;   ROLE=ADMIN;          WRONG=DOCTOR ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --protected-path) PROTECTED="${2:?}"; shift 2 ;;
    --role) ROLE="${2:?}"; shift 2 ;;
    --wrong-role) WRONG="${2:?}"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="http://localhost:${PORT}"
TOKEN_CMD="${SGH_TOKEN_CMD:-$ROOT/scripts/token.sh}"
RMQ_API="${RABBITMQ_API:-http://localhost:15672/api}"
RMQ_AUTH="${RABBITMQ_AUTH:-sgh:sgh_dev_password}"
failed=0

pass()   { printf 'PASS    %s\n' "$1"; }
fail()   { printf 'FAIL    %s\n' "$1"; failed=1; }
manual() { printf 'MANUAL  %s\n' "$1"; }

user_for() {
  case "$1" in
    ADMIN) echo admin1 ;; DOCTOR) echo doctor1 ;; NURSE) echo nurse1 ;; PATIENT) echo patient1 ;;
    PHARMACIST) echo pharmacist1 ;; LAB_TECHNICIAN) echo lab1 ;; RECEPTIONIST) echo reception1 ;;
    *) echo "unknown role $1" >&2; return 1 ;;
  esac
}
token_for() { "$TOKEN_CMD" "$(user_for "$1")"; }
status_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$@"; }

echo "Stub acceptance: ${MODULE} on port ${PORT}"

manual "starts with one documented command while Postgres and RabbitMQ are stopped (start it that way and rerun)"

# health
body="$(curl -s --max-time 5 "$BASE/health")"
code="$(status_of "$BASE/health")"
if [ "$code" = 200 ] && echo "$body" | grep -Eq '"status" *: *"UP"'; then pass "GET /health -> 200 {status: UP} without a token"
else fail "GET /health -> expected 200 {status: UP}, got ${code} ${body}"; fi

# protected endpoint
none="$(status_of "$BASE$PROTECTED")"
good_token="$(token_for "$ROLE" 2>/dev/null)"; bad_token="$(token_for "$WRONG" 2>/dev/null)"
if [ -z "$good_token" ] || [ -z "$bad_token" ]; then
  fail "could not obtain tokens from Keycloak (is the realm up? try ./scripts/token.sh doctor1)"
else
  wrong="$(status_of -H "Authorization: Bearer $bad_token" "$BASE$PROTECTED")"
  right="$(status_of -H "Authorization: Bearer $good_token" "$BASE$PROTECTED")"
  if [ "$none" = 401 ] && [ "$wrong" = 403 ] && [ "$right" = 200 ]; then
    pass "GET ${PROTECTED} -> 401 without token, 403 as ${WRONG}, 200 as ${ROLE}"
  else
    fail "GET ${PROTECTED} -> expected 401/403/200, got ${none}/${wrong}/${right}"
  fi
fi

# docs
docs="$(status_of -L "$BASE/docs")"; spec="$(curl -s --max-time 5 "$BASE/openapi.json")"
if [ "$docs" = 200 ] && echo "$spec" | grep -q '"openapi"'; then pass "GET /docs opens and /openapi.json is served"
else fail "GET /docs -> ${docs}, /openapi.json ${spec:0:60}"; fi

# unknown route
# with a valid token: an unauthenticated request is answered 401 before routing, which is correct
unknown="$(curl -s --max-time 5 -w '\n%{http_code}' -H "Authorization: Bearer $good_token" "$BASE/api/this-route-does-not-exist")"
if [ "$(echo "$unknown" | tail -1)" = 404 ] && echo "$unknown" | grep -q '"correlationId"'; then
  pass "unknown route -> 404 in the shared error body with a correlationId"
else fail "unknown route -> expected 404 JSON with correlationId, got: $(echo "$unknown" | tr '\n' ' ' | cut -c1-120)"; fi

manual "migrations create the tables and the seed checks pass (Seed Data page, 'Checks after seeding')"

# broker topology
if curl -fsS --max-time 5 -u "$RMQ_AUTH" "$RMQ_API/exchanges/%2F/sgh.events" >/dev/null 2>&1; then
  missing=""
  for q in sgh.events.dlq; do
    curl -fsS --max-time 5 -u "$RMQ_AUTH" "$RMQ_API/queues/%2F/$q" >/dev/null 2>&1 || missing="$missing $q"
  done
  [ -z "$missing" ] && pass "RabbitMQ: exchange sgh.events and the dead-letter queue exist" \
    || fail "RabbitMQ: missing queue(s):$missing"
else
  fail "RabbitMQ management API not reachable or exchange sgh.events missing (is the broker up with definitions.json?)"
fi

manual "stopping and starting the broker does not crash the service and it reconnects"

# files
missing=""
for f in README.md .env.example openapi.yaml; do [ -f "$ROOT/services/$MODULE/$f" ] || missing="$missing $f"; done
[ -z "$missing" ] && pass "services/${MODULE} has README.md, .env.example and openapi.yaml" \
  || fail "services/${MODULE} is missing:$missing"

manual "the documented test command passes (see the service README)"

if [ "$failed" = 0 ]; then echo "RESULT  all automated checks passed"; else echo "RESULT  some checks failed"; fi
exit "$failed"
