#!/usr/bin/env bash
# Prints an access token for a seeded user.
# usage: ./scripts/token.sh doctor1 [password]
# Always uses "localhost": the token issuer must be http://localhost:8180/realms/sgh.
set -euo pipefail
USER_NAME="${1:?username required}"
PASS="${2:-Sgh@dev2026}"
curl -s -X POST "http://localhost:8180/realms/sgh/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=sgh-dev-cli \
  -d "username=${USER_NAME}" -d "password=${PASS}" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
