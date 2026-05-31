"""
BikeSense AI — FastAPI ML Microservice
SARIMA/SARIMAX Demand & Price Forecasting Engine v2.1
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import logging
import os

# Load .env file if present (for local development with SMTP credentials)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — env vars must be set externally

from core.model_engine import ModelEngine
from routers import predict, admin, consumer, auth

logger = logging.getLogger("bikesense")
engine: ModelEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("🚲 BikeSense ML Engine — Initialising SARIMA models...")
    engine = ModelEngine()
    engine.train()
    app.state.engine = engine
    logger.info("✅ Models ready. Serving predictions.")
    yield
    logger.info("Shutting down ML service...")


app = FastAPI(
    title="BikeSense AI — ML Forecasting Service",
    description="SARIMA/SARIMAX demand & dynamic pricing predictions for Bangalore bike rentals",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bike-sense-sable.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router, prefix="/api/v1",          tags=["Predictions"])
app.include_router(admin.router,   prefix="/api/v1/admin",    tags=["Admin"])
app.include_router(consumer.router,prefix="/api/v1/consumer", tags=["Consumer"])
app.include_router(auth.router,    prefix="/api/v1/auth",     tags=["Auth"])


@app.get("/health")
async def health():
    return {"status": "healthy", "model": "SARIMA/SARIMAX", "version": "2.0.0"}


@app.get("/")
async def root():
    return {
        "service": "BikeSense AI Forecasting Engine",
        "endpoints": ["/api/v1/predict-demand", "/api/v1/predict-price",
                      "/api/v1/admin/revenue", "/api/v1/admin/heatmap",
                      "/api/v1/consumer/bikes", "/api/v1/consumer/recommendations"]
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
