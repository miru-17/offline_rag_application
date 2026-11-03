import os
import threading
from functools import lru_cache

from sentence_transformers import SentenceTransformer


from app.core.config import EMBEDDING_MODEL

MODEL_NAME = EMBEDDING_MODEL

# all-MiniLM-L6-v2 truncates input at 256 tokens by default.
# Document chunks are up to 500 tokens, so raise the limit to the
# model's maximum of 512 tokens so the whole chunk is embedded.
MAX_SEQ_LENGTH = int(os.getenv("EMBEDDING_MAX_SEQ_LENGTH", "512"))

_encode_lock = threading.Lock()


@lru_cache(maxsize=1)
def _load_model() -> SentenceTransformer:
    """
    Load the embedding model ONCE per process (about 100-300 MB RAM).

    The local cache is tried first, so the system starts fully offline once
    the model has been downloaded; it is downloaded only on first setup.
    """

    try:
        model = SentenceTransformer(MODEL_NAME, local_files_only=True)
    except Exception:
        model = SentenceTransformer(MODEL_NAME)

    model.max_seq_length = MAX_SEQ_LENGTH
    return model


@lru_cache(maxsize=512)
def _cached_query_embedding(text: str) -> tuple[float, ...]:
    model = _load_model()
    with _encode_lock:
        embedding = model.encode(text, normalize_embeddings=True)
    return tuple(embedding.tolist())


class EmbeddingService:
    """Thin wrapper; every instance shares the same loaded model."""

    def __init__(self):
        self.model = _load_model()

    def generate_embedding(self, text: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("Cannot generate embedding for empty text.")
        # Repeated questions (and follow-ups) reuse the vector instead of running the model again.
        return list(_cached_query_embedding(text))

    def generate_embeddings(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        if not texts:
            raise ValueError("Text list cannot be empty.")

        # Encode in small batches and release the lock between them, so a
        # user's question never waits for a whole large document to embed.
        vectors: list[list[float]] = []
        for start in range(0, len(texts), batch_size):
            with _encode_lock:
                batch = self.model.encode(
                    texts[start:start + batch_size],
                    normalize_embeddings=True,
                    batch_size=batch_size,
                )
            vectors.extend(batch.tolist())
        return vectors
