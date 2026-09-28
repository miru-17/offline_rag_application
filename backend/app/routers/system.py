from fastapi import APIRouter
import os
import requests

router = APIRouter(
    prefix="/system",
    tags=["System"],
)


OLLAMA_TAGS_URL = os.getenv(
    "OLLAMA_TAGS_URL",
    "http://127.0.0.1:11434/api/tags",
)


@router.get("/status")
def system_status():
    """
    Return the current local AI runtime status.
    """

    ollama_status = "offline"
    model_status = "unavailable"

    try:
        response = requests.get(
            OLLAMA_TAGS_URL,
            timeout=2,
        )

        if response.status_code == 200:
            ollama_status = "online"

            data = response.json()

            models = data.get("models", [])

            for model in models:
                if model.get("name") == "llama3.2:3b":
                    model_status = "available"
                    break

    except requests.RequestException:
        pass

    return {
        "api": "healthy",
        "ollama": ollama_status,
        "model": "llama3.2:3b",
        "model_status": model_status,
        "vector_store": "ChromaDB",
        "deployment": "self-hosted",
        "mode": "offline",
    }