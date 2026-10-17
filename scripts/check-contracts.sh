#!/usr/bin/env bash
# Each service folder holds a byte-identical copy of its contract (Decisions Log D24).
# Fails when a copy differs from contracts/openapi/<service>.yaml. A missing copy is reported, not failed,
# so the check can run while modules are still being built.
cd "$(dirname "$0")/.."
status=0
check() { # contract name, module folder
  local contract="contracts/openapi/$1.yaml" copy="services/$2/openapi.yaml"
  if [ ! -f "$contract" ]; then echo "MISSING CONTRACT  $contract"; status=1; return; fi
  if [ ! -f "$copy" ]; then echo "no copy yet       $copy"; return; fi
  if cmp -s "$contract" "$copy"; then echo "OK                $copy"; else echo "DIFFERS           $copy"; status=1; fi
}
check patient patient-service
check reception reception-service
check consultation doctor-service
check lab lab-service
check pharmacy pharmacy-service
check staff staff-service
exit $status
