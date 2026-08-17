from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"


class EmbeddingService:

    def __init__(self):
        self.model = SentenceTransformer(
            MODEL_NAME
        )

    def generate_embedding(
        self,
        text: str,
    ) -> list[float]:

        if not text or not text.strip():
            raise ValueError(
                "Cannot generate embedding for empty text."
            )

        embedding = self.model.encode(
            text,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def generate_embeddings(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        if not texts:
            raise ValueError(
                "Text list cannot be empty."
            )

        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
        )

        return embeddings.tolist()