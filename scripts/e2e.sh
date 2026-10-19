#!/usr/bin/env bash
# End-to-end scenarios through the gateway (Notion: Testing and Quality > End-to-End Scenarios).
#
# usage: ./scripts/e2e.sh [--resilience] [--only N]
#   default       scenarios 1-7 and 12: security, booking, consultation, lab, pharmacy, billing, staff, portal
#   --resilience  also 8-11: stops and restarts Lab, Patient, Consultation and RabbitMQ (takes minutes)
#   --only N      run one scenario (some need data from earlier ones and will report that)
#
# Needs bash, curl and jq, and everything up: infra (compose), the six services and the gateway
# (./scripts/dev-services.sh start), a seeded database. It can be run again and again: it creates
# its own patients (unique name per run) and finds free appointment slots.
#
# Stopping and starting things for 8-11 uses these commands, override them if you run things differently:
#   SGH_STOP_SERVICE   default "./scripts/dev-services.sh stop"     (called with the service name)
#   SGH_START_SERVICE  default "./scripts/dev-services.sh start"
#   SGH_STOP_RABBITMQ  default "docker compose -f infra/docker-compose.yml stop rabbitmq"
#   SGH_START_RABBITMQ default "docker compose -f infra/docker-compose.yml start rabbitmq"
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE:-http://localhost:8080}"
RESILIENCE=0; ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --resilience) RESILIENCE=1 ;;
    --only) ONLY="${2:?scenario number}"; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

SGH_STOP_SERVICE="${SGH_STOP_SERVICE:-./scripts/dev-services.sh stop}"
SGH_START_SERVICE="${SGH_START_SERVICE:-./scripts/dev-services.sh start}"
SGH_STOP_RABBITMQ="${SGH_STOP_RABBITMQ:-docker compose -f infra/docker-compose.yml stop rabbitmq}"
SGH_START_RABBITMQ="${SGH_START_RABBITMQ:-docker compose -f infra/docker-compose.yml start rabbitmq}"

# Hooks are shell commands, so they may contain quotes and pipes.
hook() { bash -c "$1 ${2:-}"; }

PASS=0; FAIL=0; SKIP=0
RES_BODY=""; RES_STATUS=""

pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; }
skip() { SKIP=$((SKIP + 1)); printf 'SKIP  %s\n' "$1"; }
note() { printf '      %s\n' "$1"; }
section() { printf '\n== %s\n' "$1"; }
wants() { [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]; }

# check "label" expected actual
check() {
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1" "expected '$2', got '$3'"; fi
}

# call METHOD TOKEN PATH [JSON]  -> RES_BODY, RES_STATUS
call() {
  local method="$1" token="$2" path="$3" data="${4:-}" out
  local args=(-s -m 20 -w '\n%{http_code}' -X "$method" "$BASE$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' -d "$data")
  out="$(curl "${args[@]}")"
  RES_STATUS="${out##*$'\n'}"
  RES_BODY="${out%$'\n'*}"
}
status_of() { call "$@"; echo "$RES_STATUS"; }
field() { printf '%s' "$RES_BODY" | jq -r "$1" 2>/dev/null; }

# Poll until a command prints the wanted value (or give up after N seconds).
eventually() { # label seconds expected command...
  local label="$1" max="$2" want="$3" i=0 got=""; shift 3
  while [ "$i" -lt "$max" ]; do
    got="$("$@" 2>/dev/null)"
    [ "$got" = "$want" ] && { pass "$label"; return 0; }
    sleep 1; i=$((i + 1))
  done
  fail "$label" "expected '$want' within ${max}s, last got '$got'"; return 1
}

# ---------------------------------------------------------------------------
# Preconditions and tokens
# ---------------------------------------------------------------------------
section "Preconditions"
if ! curl -fsS -m 3 "$BASE/health" >/dev/null 2>&1; then
  echo "The gateway is not answering on $BASE. Start everything first (see README, section 9)." >&2; exit 2
fi
T_REC="$(./scripts/token.sh reception1)"; T_DOC="$(./scripts/token.sh doctor1)"; T_DOC2="$(./scripts/token.sh doctor2)"
T_NUR="$(./scripts/token.sh nurse1)"; T_LAB="$(./scripts/token.sh lab1)"; T_PHA="$(./scripts/token.sh pharmacist1)"
T_ADM="$(./scripts/token.sh admin1)"; T_PAT="$(./scripts/token.sh patient1)"
for t in "$T_REC" "$T_DOC" "$T_DOC2" "$T_NUR" "$T_LAB" "$T_PHA" "$T_ADM" "$T_PAT"; do
  [ -n "$t" ] || { echo "Could not get a token from Keycloak (./scripts/token.sh doctor1)." >&2; exit 2; }
done
curl -fsS -m 3 "$BASE/gateway/health/services" | jq -r '.services | to_entries[] | "\(.key)=\(.value)"' | tr '\n' ' ' | sed 's/^/      services: /; s/$/\n/'
DOWN="$(curl -fsS -m 3 "$BASE/gateway/health/services" | jq -r '[.services[] | select(. != "UP")] | length')"
[ "$DOWN" = "0" ] || { echo "Some services are down; start them with ./scripts/dev-services.sh start" >&2; exit 2; }
pass "gateway and the six services are up"

RUN_ID="$(date +%s)$RANDOM"
P1="a1a1a1a1-0000-4000-8000-000000000001"; P2="a1a1a1a1-0000-4000-8000-000000000002"; P4="a1a1a1a1-0000-4000-8000-000000000004"
S1="b2b2b2b2-0000-4000-8000-000000000001"; S2="b2b2b2b2-0000-4000-8000-000000000002"
D01="d4d4d4d4-0000-4000-8000-000000000001"; D09="d4d4d4d4-0000-4000-8000-000000000009"

# A 30-minute slot at 09:00 UTC that the doctor has free, found through the availability endpoint.
START=""; END=""
free_slot() { # doctor id, hour  -> sets START/END
  local doctor="$1" hour="${2:-09}" day i
  for i in $(seq 3 90); do
    day="$(date -u -d "+$i days" +%Y-%m-%d 2>/dev/null || date -u -v+${i}d +%Y-%m-%d)"
    call GET "$T_REC" "/api/appointments/availability?doctorId=$doctor&date=$day"
    if [ "$(printf '%s' "$RES_BODY" | jq -r --arg s "${day}T${hour}:00:00Z" '.slots[] | select((.startAt | sub("\\.[0-9]+Z$"; "Z"))==$s) | .available')" = "true" ]; then
      START="${day}T${hour}:00:00Z"; END="${day}T${hour}:30:00Z"; return 0
    fi
  done
  return 1
}

PID=""; APPT=""; CON=""; LAB=""; RX=""; RX2=""; INV=""

# ---------------------------------------------------------------------------
if wants 1; then
section "Scenario 1: security basics"
check "no token on /api/patients -> 401" 401 "$(curl -s -m 5 -o /dev/null -w '%{http_code}' $BASE/api/patients)"
check "NURSE on /api/drugs -> 403 (gateway)" 403 "$(status_of GET "$T_NUR" /api/drugs)"
check "NURSE creating a patient -> 403 (service)" 403 "$(status_of POST "$T_NUR" /api/patients '{"firstName":"X"}')"
check "PATIENT reading another patient -> 403" 403 "$(status_of GET "$T_PAT" /api/patients/$P2)"
check "PATIENT reading own record -> 200" 200 "$(status_of GET "$T_PAT" /api/patients/$P1)"
b64url() { printf '%s' "$1" | base64 | tr -d '\n=' | tr '+/' '-_'; }
forged="$(b64url '{"alg":"none","typ":"JWT"}').$(b64url '{"preferred_username":"mallory","realm_access":{"roles":["ADMIN"]},"iss":"http://localhost:8180/realms/sgh"}')."
check "forged unsigned ADMIN token -> 401" 401 "$(status_of GET "$forged" /api/patients)"
fi

# ---------------------------------------------------------------------------
if wants 2; then
section "Scenario 2: registration and booking"
call POST "$T_REC" /api/patients "{\"firstName\":\"Test\",\"lastName\":\"Scenario$RUN_ID\",\"birthDate\":\"1990-01-01\",\"gender\":\"FEMALE\"}"
PID="$(field .id)"; check "register a patient -> 201" 201 "$RES_STATUS"
[[ "$PID" =~ ^[0-9a-f-]{36}$ ]] && pass "patient id is a uuid" || fail "patient id is a uuid" "$PID"
check "same patient, different case -> 409" 409 "$(status_of POST "$T_REC" /api/patients "{\"firstName\":\"test\",\"lastName\":\"scenario$RUN_ID\",\"birthDate\":\"1990-01-01\",\"gender\":\"FEMALE\"}")"
check "birth date in the future -> 422" 422 "$(status_of POST "$T_REC" /api/patients '{"firstName":"Bad","lastName":"Date","birthDate":"2999-01-01","gender":"MALE"}')"

free_slot "$S1" 09 || { fail "found a free slot for doctor S1"; }
call POST "$T_REC" /api/appointments "{\"patientId\":\"$PID\",\"doctorId\":\"$S1\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"reason\":\"Scenario visit\"}"
APPT="$(field .id)"; check "book an appointment -> 201" 201 "$RES_STATUS"; check "patientVerified is true" true "$(field .patientVerified)"
check "same doctor, same time -> 409" 409 "$(status_of POST "$T_REC" /api/appointments "{\"patientId\":\"$P2\",\"doctorId\":\"$S1\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"reason\":\"Overlap\"}")"
check "check in -> 200" 200 "$(status_of POST "$T_REC" /api/appointments/$APPT/check-in)"
check "check in again -> 409" 409 "$(status_of POST "$T_REC" /api/appointments/$APPT/check-in)"
fi

# ---------------------------------------------------------------------------
if wants 3; then
section "Scenario 3: consultation, vitals, lab order, prescription"
[ -n "$PID" ] || { call POST "$T_REC" /api/patients "{\"firstName\":\"Test\",\"lastName\":\"Scenario$RUN_ID\",\"birthDate\":\"1990-01-01\",\"gender\":\"FEMALE\"}"; PID="$(field .id)"; }
APPT_JSON=null; [ -n "$APPT" ] && APPT_JSON="\"$APPT\""
call POST "$T_DOC" /api/consultations "{\"patientId\":\"$PID\",\"appointmentId\":$APPT_JSON,\"subjective\":\"Headache\"}"
CON="$(field .id)"; check "open a consultation -> 201" 201 "$RES_STATUS"
call GET "$T_DOC" /api/consultations/$CON
check "status DRAFT" DRAFT "$(field .status)"; check "doctorId is S1 (from the token)" "$S1" "$(field .doctorId)"
check "patient snapshot name" "Test Scenario$RUN_ID" "$(field .patientSnapshot.fullName)"
check "vital signs by the nurse -> 201" 201 "$(status_of POST "$T_NUR" /api/vitals "{\"patientId\":\"$PID\",\"consultationId\":\"$CON\",\"temperature\":37.0,\"heartRate\":72,\"systolic\":120,\"diastolic\":80}")"
check "diastolic above systolic -> 422" 422 "$(status_of POST "$T_NUR" /api/vitals "{\"patientId\":\"$PID\",\"systolic\":80,\"diastolic\":120}")"
call POST "$T_DOC" /api/consultations/$CON/lab-orders '{"priority":"URGENT","tests":[{"code":"GLU","name":"Fasting glucose"}]}'
LAB="$(field .id)"; check "order a lab test -> 201" 201 "$RES_STATUS"
call POST "$T_DOC" /api/consultations/$CON/prescriptions '{"items":[{"drugName":"Paracetamol 500 mg","dosage":"1 tablet","frequency":"3 per day","duration":"3 days"}]}'
RX="$(field .id)"; check "prescribe -> 201" 201 "$RES_STATUS"
call POST "$T_DOC" /api/consultations/$CON/prescriptions '{"items":[{"drugName":"Cetirizine 10 mg","dosage":"1 tablet","frequency":"1 per day","duration":"7 days"}]}'
RX2="$(field .id)"; check "second prescription (used by scenario 10) -> 201" 201 "$RES_STATUS"
check "write assessment and plan -> 200" 200 "$(status_of PUT "$T_DOC" /api/consultations/$CON '{"assessment":"Tension headache","plan":"Rest and hydration"}')"
check "sign -> 200" 200 "$(status_of POST "$T_DOC" /api/consultations/$CON/sign)"
check "edit a signed consultation -> 409" 409 "$(status_of PUT "$T_DOC" /api/consultations/$CON '{"plan":"changed"}')"
fi

# ---------------------------------------------------------------------------
if wants 4; then
section "Scenario 4: lab processing (through RabbitMQ)"
if [ -z "$LAB" ]; then skip "needs the lab order from scenario 3"; else
lab_has_request() { call GET "$T_LAB" "/api/lab-requests/$LAB"; echo "$RES_STATUS"; }
eventually "lab received the order through RabbitMQ" 15 200 lab_has_request
call GET "$T_LAB" '/api/lab-requests?status=REQUESTED'
check "work queue puts URGENT first" URGENT "$(field '.content[0].priority')"
check "start -> 200" 200 "$(status_of POST "$T_LAB" /api/lab-requests/$LAB/start)"
check "validate without results -> 409" 409 "$(status_of POST "$T_LAB" /api/lab-requests/$LAB/validate)"
call POST "$T_LAB" /api/lab-requests/$LAB/results '{"results":[{"testCode":"GLU","value":135}]}'
check "glucose 135 is flagged HIGH" HIGH "$(field '.results[0].flag')"
check "reference range 70.0-100.0" "70.0-100.0" "$(field '.results[0].referenceRange')"
check "validate -> 200" 200 "$(status_of POST "$T_LAB" /api/lab-requests/$LAB/validate)"
doctor_sees_result() { call GET "$T_DOC" /api/consultations/$CON/lab-results; field '.[0].results[0].flag'; }
eventually "the doctor receives the validated result" 15 HIGH doctor_sees_result
call GET "$T_DOC" /api/consultations/$CON/lab-orders; check "lab order is VALIDATED" VALIDATED "$(field '.[0].status')"
fi; fi

# ---------------------------------------------------------------------------
if wants 5; then
section "Scenario 5: pharmacy"
if [ -z "$RX" ]; then skip "needs the prescription from scenario 3"; else
rx_arrived() { call GET "$T_PHA" /api/prescriptions/$RX; echo "$RES_STATUS"; }
eventually "pharmacy received the prescription through RabbitMQ" 15 200 rx_arrived
call GET "$T_PHA" '/api/prescriptions?status=ISSUED&size=100'
check "queue contains the new prescription" true "$(printf '%s' "$RES_BODY" | jq -r --arg id "$RX" '[.content[].id] | index($id) != null')"
call GET "$T_PHA" /api/stock/alerts; check "Amoxicillin is in the stock alerts" true "$(printf '%s' "$RES_BODY" | jq -r '[.[].name] | index("Amoxicillin") != null')"
call GET "$T_PHA" '/api/drugs?search=paracetamol'; before="$(field '.content[0].stock')"
call POST "$T_PHA" /api/prescriptions/$RX/dispense "{\"lines\":[{\"itemIndex\":0,\"drugId\":\"$D01\",\"quantity\":9}]}"
check "dispense -> DISPENSED" DISPENSED "$(field .status)"
call GET "$T_PHA" '/api/drugs?search=paracetamol'; check "stock went down by 9" "$((before - 9))" "$(field '.content[0].stock')"
check "dispense again -> 409" 409 "$(status_of POST "$T_PHA" /api/prescriptions/$RX/dispense "{\"lines\":[{\"itemIndex\":0,\"drugId\":\"$D01\",\"quantity\":1}]}")"
check "more than the stock -> 409" 409 "$(status_of POST "$T_PHA" /api/prescriptions/f8f8f8f8-0000-4000-8000-000000000001/dispense '{"lines":[{"itemIndex":0,"drugId":"d4d4d4d4-0000-4000-8000-000000000003","quantity":999}]}')"
fi; fi

# ---------------------------------------------------------------------------
if wants 6; then
section "Scenario 6: billing"
[ -n "$PID" ] || skip "needs the patient from scenario 2" 
if [ -n "$PID" ]; then
call POST "$T_REC" /api/invoices "{\"patientId\":\"$PID\",${APPT:+\"appointmentId\":\"$APPT\",}\"lines\":[{\"description\":\"Consultation\",\"quantity\":1,\"unitPrice\":50.00},{\"description\":\"Glucose test\",\"quantity\":2,\"unitPrice\":12.50}]}"
INV="$(field .id)"; check "create an invoice -> 201" 201 "$RES_STATUS"
call GET "$T_REC" /api/invoices/$INV; check "total is computed: 75" 75 "$(field .total)"; check "status PENDING" PENDING "$(field .status)"
call POST "$T_REC" /api/invoices/$INV/pay '{"method":"CASH"}'; check "pay -> PAID" PAID "$(field .status)"; check "paid in CASH" CASH "$(field .paymentMethod)"
check "pay again -> 409" 409 "$(status_of POST "$T_REC" /api/invoices/$INV/pay '{"method":"CASH"}')"
if [ -n "$APPT" ]; then check "complete the checked-in visit -> 200" 200 "$(status_of POST "$T_REC" /api/appointments/$APPT/complete)"; fi
fi; fi

# ---------------------------------------------------------------------------
if wants 7; then
section "Scenario 7: staff directory and profile"
call GET "$T_REC" '/api/staff/directory?role=DOCTOR'; check "two doctors in the directory" 2 "$(field length)"
check "staff list is admin only -> 403 for the receptionist" 403 "$(status_of GET "$T_REC" /api/staff)"
call GET "$T_ADM" /api/staff; check "admin sees 7 staff members" 7 "$(field .totalElements)"
call GET "$T_DOC" /api/me; check "/api/me shows the doctor's profile" "Amel Trabelsi" "$(field .staff.fullName)"
call GET "$T_PAT" /api/me; check "patient /api/me carries patientId" "$P1" "$(field .patientId)"; check "patient has no staff profile" null "$(field .staff)"
fi

# ---------------------------------------------------------------------------
if wants 12; then
section "Scenario 12: patient portal"
call GET "$T_PAT" /api/appointments; check "appointments of patient1 only" "[\"$P1\"]" "$(printf '%s' "$RES_BODY" | jq -c '[.content[].patientId] | unique')"
call GET "$T_PAT" /api/consultations; check "consultations of patient1 only (or none)" true "$(printf '%s' "$RES_BODY" | jq -r --arg p "$P1" '[.content[].patientId] | unique | all(. == $p)')"
check "invoices -> 200" 200 "$(status_of GET "$T_PAT" /api/invoices)"
check "staff list -> 403" 403 "$(status_of GET "$T_PAT" /api/staff)"
fi

# ---------------------------------------------------------------------------
# Resilience (8-11)
# ---------------------------------------------------------------------------
service_state() { curl -fsS -m 3 "$BASE/gateway/health/services" | jq -r ".services.$1"; }

if [ "$RESILIENCE" = 1 ] || [ -n "$ONLY" -a "${ONLY:-0}" -ge 8 ] 2>/dev/null; then
if wants 8; then
section "Scenario 8: resilience, Lab stopped"
if hook "$SGH_STOP_SERVICE" lab >/dev/null 2>&1; then
  eventually "lab shows DOWN in the status endpoint within 3 seconds" 3 DOWN service_state lab
  call GET "$T_LAB" /api/lab-requests; check "lab screens get a structured 503" 503 "$RES_STATUS"; check "naming the lab service" lab "$(field .service)"
  call POST "$T_DOC2" /api/consultations "{\"patientId\":\"$P2\"}"; LAB2="$(field .id)"
  call POST "$T_DOC2" /api/consultations/$LAB2/lab-orders '{"priority":"ROUTINE","tests":[{"code":"HGB","name":"Hemoglobin"}]}'; LABQ="$(field .id)"
  check "the doctor can still order a test (201)" 201 "$RES_STATUS"
  check "other services are unaffected" 200 "$(status_of GET "$T_REC" /api/patients)"
  hook "$SGH_START_SERVICE" lab >/dev/null 2>&1
  queued_arrived() { call GET "$T_LAB" "/api/lab-requests/$LABQ"; echo "$RES_STATUS"; }
  eventually "the order placed while Lab was down shows up after the restart" 40 200 queued_arrived
else skip "could not stop the lab service (set SGH_STOP_SERVICE)"; fi
fi

if wants 9; then
section "Scenario 9: resilience, Patient stopped"
if hook "$SGH_STOP_SERVICE" patient >/dev/null 2>&1; then
  free_slot "$S2" 10 || fail "found a free slot for doctor S2"
  call POST "$T_REC" /api/appointments "{\"patientId\":\"$P4\",\"doctorId\":\"$S2\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"reason\":\"Patient service down\"}"
  A9="$(field .id)"; check "booking still works (201)" 201 "$RES_STATUS"; check "flagged patientVerified false" false "$(field .patientVerified)"
  call POST "$T_DOC" /api/consultations "{\"patientId\":\"$P4\"}"; C3="$(field .id)"; check "consultation still opens (201)" 201 "$RES_STATUS"
  call GET "$T_DOC" /api/consultations/$C3; check "patient snapshot is null" null "$(field .patientSnapshot)"
  hook "$SGH_START_SERVICE" patient >/dev/null 2>&1
  verified() { call GET "$T_REC" /api/appointments/$A9; field .patientVerified; }
  eventually "the appointment gets verified after the restart (REC-6, about a minute)" 120 true verified
else skip "could not stop the patient service (set SGH_STOP_SERVICE)"; fi
fi

if wants 10; then
section "Scenario 10: resilience, Consultation stopped"
if [ -z "$RX2" ]; then skip "needs the second prescription from scenario 3"; else
rx2_arrived() { call GET "$T_PHA" /api/prescriptions/$RX2; echo "$RES_STATUS"; }
eventually "pharmacy has the prescription before the outage" 15 200 rx2_arrived
if hook "$SGH_STOP_SERVICE" consultation >/dev/null 2>&1; then
  call POST "$T_PHA" /api/prescriptions/$RX2/dispense "{\"lines\":[{\"itemIndex\":0,\"drugId\":\"$D09\",\"quantity\":7}]}"
  check "dispensing works from the local copy" DISPENSED "$(field .status)"
  hook "$SGH_START_SERVICE" consultation >/dev/null 2>&1
else skip "could not stop the consultation service (set SGH_STOP_SERVICE)"; fi
fi; fi

if wants 11; then
section "Scenario 11: resilience, RabbitMQ stopped"
if hook "$SGH_STOP_RABBITMQ" >/dev/null 2>&1; then
  call POST "$T_DOC2" /api/consultations "{\"patientId\":\"$P2\"}"; C11="$(field .id)"
  call POST "$T_DOC2" /api/consultations/$C11/lab-orders '{"priority":"ROUTINE","tests":[{"code":"WBC","name":"White blood cells"}]}'; L11="$(field .id)"
  check "ordering a test still works (201)" 201 "$RES_STATUS"
  check "REST features keep working" 200 "$(status_of GET "$T_REC" /api/patients)"
  hook "$SGH_START_RABBITMQ" >/dev/null 2>&1
  l11_arrived() { call GET "$T_LAB" "/api/lab-requests/$L11"; echo "$RES_STATUS"; }
  if eventually "the order placed while the broker was down is delivered after it returns" 60 200 l11_arrived; then :; fi
  note "(The Notion page documents that such an event may be lost without an outbox; the services here keep retrying while they run.)"
else skip "could not stop RabbitMQ (set SGH_STOP_RABBITMQ)"; fi
fi
fi

printf '\n== Summary: %d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" = 0 ]
