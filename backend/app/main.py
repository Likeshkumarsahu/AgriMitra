"""AgriMitra — FastAPI application entrypoint.

Registers routers, CORS and central exception handlers so every failure is
returned as a consistent JSON envelope instead of an unhandled 500.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import chat as chat_api
from app.api import courses as courses_api
from app.api import crops as crops_api
from app.api import health as health_api
from app.api import recommend as recommend_api
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agrimitra.main")

settings = get_settings()

app = FastAPI(
    title="AgriMitra API",
    description="Agriculture learning, crop recommendation & RAG chatbot backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "request_error", "message": str(exc.detail)},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Something went wrong. Please try again later.",
        },
    )


@app.get("/", include_in_schema=False)
def root():
    return {
        "app": "AgriMitra API",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": ["/api/recommend", "/api/crops", "/api/chat", "/api/courses", "/api/health"],
    }


app.include_router(health_api.router)
app.include_router(courses_api.router)
app.include_router(crops_api.router)
app.include_router(recommend_api.router)
app.include_router(chat_api.router)