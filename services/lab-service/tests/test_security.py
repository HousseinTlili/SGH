"""Authentication must verify the signature: a forged token never gets through."""
import base64
import json

import pytest

from tests.jwks import _other_key, create_test_token

URL = "/api/lab-requests"


def b64(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def get(client, token):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get(URL, headers=headers)


def test_unsigned_alg_none_token_is_rejected(client):
    forged = (
        b64({"alg": "none", "typ": "JWT"})
        + "."
        + b64({"preferred_username": "attacker", "realm_access": {"roles": ["ADMIN"]}, "iss": "http://localhost:8180/realms/sgh"})
        + "."
    )
    res = get(client, forged)
    assert res.status_code == 401
    assert res.json()["message"] == "Missing or invalid token"


def test_token_signed_with_another_key_is_rejected(client):
    token = create_test_token("lab1", ["LAB_TECHNICIAN"], staff_id="b2b2b2b2-0000-4000-8000-000000000004", key=_other_key)
    assert get(client, token).status_code == 401


def test_hmac_token_signed_with_a_public_value_is_rejected(client):
    token = create_test_token("lab1", ["LAB_TECHNICIAN"], key="a-shared-secret-of-thirty-two-bytes!", algorithm="HS256")
    assert get(client, token).status_code == 401


def test_expired_token_is_rejected(client):
    token = create_test_token("lab1", ["LAB_TECHNICIAN"], staff_id="b2b2b2b2-0000-4000-8000-000000000004", expires_in=-60)
    assert get(client, token).status_code == 401


def test_token_from_another_issuer_is_rejected(client):
    token = create_test_token("lab1", ["LAB_TECHNICIAN"], staff_id="b2b2b2b2-0000-4000-8000-000000000004", issuer="http://evil.example/realms/sgh")
    assert get(client, token).status_code == 401


@pytest.mark.parametrize("header", ["Bearer ", "Bearer not.a.jwt", "Basic abc", ""])
def test_missing_or_garbage_credentials_are_rejected(client, header):
    res = client.get(URL, headers={"Authorization": header} if header else {})
    assert res.status_code == 401


def test_error_never_reveals_why_the_token_failed(client):
    res = get(client, "garbage.garbage.garbage")
    assert res.json()["message"] == "Missing or invalid token"


def test_unknown_roles_in_the_token_are_ignored(client):
    token = create_test_token("x", ["SUPERUSER", "LAB_TECH"], staff_id="b2b2b2b2-0000-4000-8000-000000000004")
    assert get(client, token).status_code == 403  # no SGH role left


def test_valid_token_works(client, lab_tech_token):
    assert get(client, lab_tech_token).status_code == 200
