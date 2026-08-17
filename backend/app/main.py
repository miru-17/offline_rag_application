from fastapi import FastAPI
from app.routers.documents import router as documents_router
from app.routers.auth import router as auth_router


app = FastAPI(
    title="Offline RAG Application",
    description="Self-hosted offline Retrieval-Augmented Generation system",
    version="1.0.0",
)


app.include_router(auth_router)
app.include_router(documents_router)

@app.get("/")
def root():
    return {
        "message": "Offline RAG Application API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }