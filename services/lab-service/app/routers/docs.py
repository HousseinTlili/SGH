import os
import yaml
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["docs"])

openapi_cache = None

@router.get("/openapi.json")
def get_openapi_json():
    global openapi_cache
    if openapi_cache is not None:
        return JSONResponse(content=openapi_cache)

    yaml_path = os.path.join(os.path.dirname(__file__), "..", "..", "openapi.yaml")
    if os.path.exists(yaml_path):
        with open(yaml_path, "r", encoding="utf-8") as f:
            openapi_cache = yaml.safe_load(f)
            return JSONResponse(content=openapi_cache)
    return JSONResponse(content={"error": "openapi.yaml not found"}, status_code=404)
