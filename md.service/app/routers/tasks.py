from fastapi import APIRouter

from ..data_loader import load_json

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/")
def list_tasks():
  return load_json("tasks.json")

