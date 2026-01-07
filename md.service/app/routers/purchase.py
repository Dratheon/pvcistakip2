from fastapi import APIRouter

from ..data_loader import load_json

router = APIRouter(prefix="/purchase", tags=["purchase"])


@router.get("/orders")
def list_orders():
  return load_json("purchaseOrders.json")


@router.get("/suppliers")
def list_suppliers():
  return load_json("suppliers.json")


@router.get("/requests")
def list_requests():
  return load_json("requests.json")

