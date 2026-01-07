from fastapi import APIRouter

from ..data_loader import load_json

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/")
def list_settings():
  return load_json("settings.json")

