"""A local stand-in for the Keycloak realm: a signing key, a JWKS endpoint and a token factory.
Users and claims mirror infra/keycloak/sgh-realm.json. Imported by conftest.py and by the tests, so
there is exactly one key pair per test run."""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

ISSUER = "http://localhost:8180/realms/sgh"
KEY_ID = "test-key"
_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)  # for forged tokens


def _jwks_document() -> bytes:
    jwk = json.loads(RSAAlgorithm.to_jwk(_private_key.public_key()))
    jwk.update({"kid": KEY_ID, "alg": "RS256", "use": "sig"})
    return json.dumps({"keys": [jwk]}).encode()


class _JwksHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = _jwks_document()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # silence
        pass


_server = HTTPServer(("127.0.0.1", 0), _JwksHandler)
threading.Thread(target=_server.serve_forever, daemon=True).start()
os.environ["KEYCLOAK_JWKS_URI"] = f"http://127.0.0.1:{_server.server_address[1]}/certs"


def create_test_token(
    username: str,
    roles: list,
    staff_id: str = None,
    patient_id: str = None,
    *,
    key=None,
    algorithm: str = "RS256",
    issuer: str = ISSUER,
    expires_in: int = 3600,
) -> str:
    now = int(time.time())
    payload = {
        "preferred_username": username,
        "realm_access": {"roles": roles + ["offline_access"]},
        "iss": issuer,
        "sub": username,
        "iat": now,
        "exp": now + expires_in,
    }
    if staff_id:
        payload["staffId"] = staff_id
    if patient_id:
        payload["patientId"] = patient_id
    return jwt.encode(payload, key or _private_key, algorithm=algorithm, headers={"kid": KEY_ID})


