#!/usr/bin/env bash
# Checks the gateway and the six services.
for entry in gateway:8080 patient:8081 reception:8082 consultation:8083 lab:8084 pharmacy:8085 staff:8086; do
  name="${entry%%:*}"; port="${entry##*:}"
  if curl -fsS --max-time 2 "http://localhost:${port}/health" >/dev/null 2>&1; then
    echo "UP    ${name} (${port})"
  else
    echo "DOWN  ${name} (${port})"
  fi
done
