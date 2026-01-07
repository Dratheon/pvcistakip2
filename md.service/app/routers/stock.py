import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/stock", tags=["stock"])


class StockItemIn(BaseModel):
  name: str
  sku: str
  unit: str
  supplier: str
  category: str | None = None
  warehouse: str | None = None
  barcode: str | None = None
  color: str | None = None
  colorCode: str | None = None
  onHand: float
  reserved: float
  critical: float
  reorderPoint: float | None = None
  minOrderQty: float | None = None
  leadTimeDays: int | None = None
  unitCost: float | None = None
  notes: str | None = None


class MovementIn(BaseModel):
  itemId: str
  qty: float
  type: str  # stockIn, stockOut, reserve, release
  reason: str | None = None
  operator: str | None = None
  reference: str | None = None
  location: str | None = None


@router.get("/items")
def list_items():
  return load_json("stockItems.json")


@router.post("/items", status_code=201)
def create_item(payload: StockItemIn):
  items = load_json("stockItems.json")
  new_id = f"STK-{str(uuid.uuid4())[:8].upper()}"
  new_item = {
      "id": new_id,
      **payload.model_dump(),
      "lastUpdated": datetime.utcnow().isoformat()[:10]
  }
  
  items.insert(0, new_item)
  save_json("stockItems.json", items)
  return new_item


@router.put("/items/{item_id}")
def update_item(item_id: str, payload: StockItemIn):
  items = load_json("stockItems.json")
  for idx, item in enumerate(items):
    if item.get("id") == item_id:
      updated = {**item, **payload.model_dump()}
      updated["lastUpdated"] = datetime.utcnow().isoformat()[:10]
      items[idx] = updated
      save_json("stockItems.json", items)
      return updated
  raise HTTPException(status_code=404, detail="Stok kalemi bulunamadı")


@router.delete("/items/{item_id}")
def delete_item(item_id: str):
  items = load_json("stockItems.json")
  items = [i for i in items if i.get("id") != item_id]
  save_json("stockItems.json", items)
  return {"success": True, "id": item_id}


@router.get("/movements")
def list_movements():
  return load_json("stockMovements.json")


@router.post("/movements", status_code=201)
def create_movement(payload: MovementIn):
  items = load_json("stockItems.json")
  movements = load_json("stockMovements.json")
  
  # Find item
  target = None
  target_idx = -1
  for idx, item in enumerate(items):
    if item.get("id") == payload.itemId:
      target = item
      target_idx = idx
      break
  
  if not target:
    raise HTTPException(status_code=404, detail="Stok kalemi bulunamadı")
  
  qty = payload.qty
  
  # Apply movement
  if payload.type == "stockIn":
    target["onHand"] = (target.get("onHand") or 0) + qty
  elif payload.type == "stockOut":
    target["onHand"] = max(0, (target.get("onHand") or 0) - qty)
  elif payload.type == "reserve":
    target["reserved"] = (target.get("reserved") or 0) + qty
  elif payload.type == "release":
    target["reserved"] = max(0, (target.get("reserved") or 0) - qty)
  
  target["lastUpdated"] = datetime.utcnow().isoformat()[:10]
  items[target_idx] = target
  
  # Create movement record
  change = qty if payload.type in ("stockIn", "reserve") else -qty
  movement = {
      "id": f"MOV-{str(uuid.uuid4())[:8].upper()}",
      "date": datetime.utcnow().isoformat()[:10],
      "item": target.get("name"),
      "itemId": payload.itemId,
      "change": change,
      "reason": payload.reason or payload.type,
      "operator": payload.operator or "Sistem",
      "reference": payload.reference,
      "location": payload.location or target.get("warehouse") or "Ana Depo",
  }
  
  movements.insert(0, movement)
  
  save_json("stockItems.json", items)
  save_json("stockMovements.json", movements)
  
  return {"item": target, "movement": movement}


@router.get("/reservations")
def list_reservations():
  return load_json("reservations.json")

