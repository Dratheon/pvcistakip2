from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    archive,
    customers,
    dashboard,
    documents,
    finance,
    jobs,
    planning,
    purchase,
    reports,
    settings,
    stock,
    tasks,
    colors,
)

app = FastAPI(
    title="MD Service",
    description="Modüler FastAPI backend; veri kaynağı md.data klasörü.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(jobs.router)
app.include_router(tasks.router)
app.include_router(customers.router)
app.include_router(planning.router)
app.include_router(stock.router)
app.include_router(purchase.router)
app.include_router(finance.router)
app.include_router(archive.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(colors.router)
app.include_router(documents.router)


@app.get("/health", tags=["meta"])
def health():
  return {"status": "ok"}

