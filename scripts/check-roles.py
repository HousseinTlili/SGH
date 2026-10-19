#!/usr/bin/env python3
"""Black-box role matrix for one running service, driven by the OpenAPI contract.

For every operation with `x-roles` in contracts/openapi/<contract>.yaml the script calls the
running service with a real Keycloak token for each seeded user and checks:

  - no token and an invalid token  -> 401
  - a role that is not allowed     -> 403   (the role is checked before the body is validated)
  - a role that is allowed         -> anything except 401/403
    (PATIENT is only checked for "not 401": "own record only" rules legitimately answer 403)

Path ids are random UUIDs and bodies are empty objects, so nothing is created or changed
(allowed roles end in 400/404/422). Needs Keycloak up: tokens come from scripts/token.sh.

usage: scripts/check-roles.py <contract> <port>      e.g. scripts/check-roles.py patient 8081
"""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
USERS = {
    "ADMIN": "admin1", "DOCTOR": "doctor1", "NURSE": "nurse1", "PATIENT": "patient1",
    "PHARMACIST": "pharmacist1", "LAB_TECHNICIAN": "lab1", "RECEPTIONIST": "reception1",
}


def token(username: str) -> str:
    out = subprocess.run([str(ROOT / "scripts" / "token.sh"), username], capture_output=True, text=True)
    if not out.stdout.strip():
        sys.exit(f"cannot get a token for {username}; is Keycloak up?")
    return out.stdout.strip()


def call(port: int, method: str, path: str, bearer: str | None, body: bool) -> int:
    headers = {"Content-Type": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    data = b"{}" if body else None
    req = urllib.request.Request(f"http://localhost:{port}{path}", data=data, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status
    except urllib.error.HTTPError as err:
        return err.code


def main() -> int:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    contract, port = sys.argv[1], int(sys.argv[2])
    spec = yaml.safe_load((ROOT / "contracts" / "openapi" / f"{contract}.yaml").read_text())
    tokens = {role: token(user) for role, user in USERS.items()}
    failures, checked = [], 0

    for path, item in spec["paths"].items():
        for method, op in item.items():
            roles = op.get("x-roles") if isinstance(op, dict) else None
            if not roles:
                continue
            real = re.sub(r"\{[^}]+\}", lambda _: str(uuid.uuid4()), path)
            sends_body = method in ("post", "put", "patch")
            label = f"{method.upper():6} {path}"

            def expect(who: str, got: int, ok: bool, want: str):
                nonlocal checked
                checked += 1
                if not ok:
                    failures.append(f"{label}  as {who}: got {got}, expected {want}")

            got = call(port, method, real, None, sends_body)
            expect("no token", got, got == 401, "401")
            got = call(port, method, real, "not.a.token", sends_body)
            expect("invalid token", got, got == 401, "401")
            for role, bearer in tokens.items():
                got = call(port, method, real, bearer, sends_body)
                if role in roles:
                    if role == "PATIENT":
                        expect(role, got, got != 401, "not 401")
                    else:
                        expect(role, got, got not in (401, 403), "not 401/403")
                else:
                    expect(role, got, got == 403, "403")

    for line in failures:
        print("FAIL", line)
    print(f"{checked - len(failures)}/{checked} role checks passed for {contract} on :{port}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
