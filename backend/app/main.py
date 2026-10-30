
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.api.osint import router as osint_router
from app.api.safety import router as safety_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SHEild API",
    description="Women's Safety and Amritsar Public Safety Intelligence",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
def home():
    return {
        "project": "SHEild",
        "description": "Women's Safety and Amritsar Public Safety Intelligence",
        "status": "online"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(osint_router)
app.include_router(safety_router)
