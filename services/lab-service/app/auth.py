import logging
from typing import List, Optional

import jwt
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import settings

logger = logging.getLogger("lab-service.auth")

security = HTTPBearer(auto_error=False)

# SGH canonical roles: anything else in the token is ignored.
SGH_ROLES = {"PATIENT", "DOCTOR", "NURSE", "LAB_TECHNICIAN", "PHARMACIST", "RECEPTIONIST", "ADMIN"}

# Keys are cached and refreshed when an unknown key id shows up.
jwks_client = PyJWKClient(settings.KEYCLOAK_JWKS_URI, cache_keys=True, lifespan=3600)


class AuthUser:
    def __init__(
        self,
        username: str,
        roles: List[str],
        staff_id: Optional[str] = None,
        patient_id: Optional[str] = None,
    ):
        self.username = username
        self.roles = roles
        self.staff_id = staff_id
        self.patient_id = patient_id


def _unauthorized() -> HTTPException:
    # One message for every failure: the reason is logged, never returned to the caller.
    return HTTPException(status_code=401, detail="Missing or invalid token")


# A plain `def` dependency: FastAPI runs it in a worker thread, so the blocking JWKS fetch
# done by PyJWKClient never stalls the event loop.
def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthUser:
    if not credentials or not credentials.credentials:
        raise _unauthorized()

    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        # RS256 only: an unsigned ("alg": "none") or HMAC token can never get through.
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.KEYCLOAK_ISSUER_URI,
            options={"verify_aud": False, "require": ["exp", "iss"]},
        )
    except Exception as exc:  # signature, issuer, expiry, malformed token, JWKS unreachable
        logger.warning("Token rejected: %s", exc.__class__.__name__)
        raise _unauthorized() from exc

    realm_access = payload.get("realm_access")
    raw_roles = realm_access.get("roles", []) if isinstance(realm_access, dict) else []
    roles = [str(r).upper() for r in raw_roles if str(r).upper() in SGH_ROLES]

    user = AuthUser(
        username=payload.get("preferred_username") or payload.get("sub") or "unknown",
        roles=roles,
        staff_id=payload.get("staffId"),
        patient_id=payload.get("patientId"),
    )
    request.state.username = user.username  # for the request log line
    return user


def require_roles(allowed_roles: List[str]):
    allowed = {r.upper() for r in allowed_roles}

    def role_checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not allowed.intersection(user.roles):
            raise HTTPException(status_code=403, detail="Your role is not allowed to do this")
        return user

    return role_checker
