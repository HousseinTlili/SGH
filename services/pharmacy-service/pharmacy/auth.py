from functools import wraps

import jwt
from flask import current_app, g, jsonify, request


def _claims_from_request():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.removeprefix("Bearer ").strip()
    if not token:
        return None

    key = current_app.config.get("JWT_SECRET") or current_app.config.get("JWT_PUBLIC_KEY")
    if not key:
        return None
    options = {"verify_signature": True, "verify_aud": bool(current_app.config.get("JWT_AUDIENCE"))}
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256", "HS256"],
            issuer=current_app.config.get("JWT_ISSUER"),
            audience=current_app.config.get("JWT_AUDIENCE"),
            options=options,
        )
    except jwt.PyJWTError:
        return None
    return claims


def require_roles(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            claims = _claims_from_request()
            if claims is None:
                return jsonify({"status": 401, "error": "Unauthorized", "message": "A valid Bearer token is required"}), 401
            token_roles = set(claims.get("realm_access", {}).get("roles", []))
            token_roles.update(claims.get("roles", []))
            if roles and not token_roles.intersection(roles):
                return jsonify({"status": 403, "error": "Forbidden", "message": "You are not allowed to do this"}), 403
            g.claims = claims
            g.user_id = claims.get("staffId") or claims.get("sub") or claims.get("preferred_username")
            return view(*args, **kwargs)

        return wrapped

    return decorator
