from flask import jsonify


def error(status, message, **extra):
    body = {"status": status, "error": _name(status), "message": message}
    body.update(extra)
    return jsonify(body), status


def _name(status):
    return {
        400: "Bad Request",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        503: "Service Unavailable",
    }.get(status, "Error")
