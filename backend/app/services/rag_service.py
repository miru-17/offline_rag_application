"""
RAG pipeline:

question -> (follow-up context) -> retrieval with access filters
         -> evidence excerpts -> guarded prompt -> local LLM -> answer + sources
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.ollama_service import active_model
from app.services.ollama_service import generate_answer as llm_generate
from app.services.ollama_service import stream_answer
from app.services.prompt_builder import NOT_FOUND_ANSWER, build_prompt
from app.services.retrieval_service import RetrievalService

EXCERPT_CHARS = 400
FOLLOW_UP_MAX_WORDS = 8


@dataclass
class PreparedQuery:
    found: bool
    prompt: str = ""
    sources: list[dict] = field(default_factory=list)
    model: str | None = None


def looks_like_not_found(answer: str) -> bool:
    text = (answer or "").lower()
    return (
        "cannot answer this question" in text
        or "could not find the answer" in text
        or "not in your uploaded documents" in text
    )


class RAGService:

    def __init__(self):
        self.retrieval_service = RetrievalService()

    @staticmethod
    def _retrieval_query(query: str, history: list[dict] | None) -> str:
        """Short follow-ups ("explain that more") reuse the previous question."""
        if not history or len(query.split()) > FOLLOW_UP_MAX_WORDS:
            return query
        previous = next((t["content"] for t in reversed(history) if t.get("role") == "user"), None)
        return f"{previous} {query}" if previous else query

    def prepare(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        top_k: int = 5,
        group_ids: list[str] | None = None,
        history: list[dict] | None = None,
        document_id: str | None = None,
        hybrid: bool = False,
        language: str | None = "auto",
        model: str | None = None,
        accessible_documents: list[dict] | None = None,
    ) -> PreparedQuery:
        if not user_id or not tenant_id:
            raise ValueError("User and tenant are required for RAG.")

        results = self.retrieval_service.retrieve(
            query=self._retrieval_query(query, history),
            user_id=user_id,
            tenant_id=tenant_id,
            top_k=top_k,
            group_ids=group_ids,
            document_id=document_id,
            hybrid=hybrid,
            accessible_documents=accessible_documents,
        )

        documents = results.get("documents", [[]])[0]
        if not documents:
            return PreparedQuery(found=False)

        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        matches = (results.get("matches") or [[]])[0]

        excerpts, sources = [], []
        for index, text in enumerate(documents):
            metadata = metadatas[index] or {}
            page = metadata.get("page")
            sheet = metadata.get("sheet")
            location = f"page {page}" if page else (f"sheet {sheet}" if sheet else "")
            excerpts.append({"filename": metadata.get("filename", "document"), "location": location, "text": text})
            sources.append({
                "ref": index + 1,
                "document_id": metadata.get("document_id", ""),
                "filename": str(metadata.get("filename", "Unknown document")).strip(),
                "page": int(page) if page else None,
                "sheet": sheet or None,
                "chunk_index": metadata.get("chunk_index", 0),
                "excerpt": text[:EXCERPT_CHARS] + ("…" if len(text) > EXCERPT_CHARS else ""),
                "score": round(max(0.0, 1.0 - float(distances[index])), 3),
                "match": matches[index] if index < len(matches) else "meaning",
            })

        prompt = build_prompt(query=query, excerpts=excerpts, history=history, language=language)
        return PreparedQuery(found=True, prompt=prompt, sources=sources, model=model or active_model())

    def generate_answer(
        self,
        query: str,
        user_id: str,
        tenant_id: str,
        top_k: int = 5,
        group_ids: list[str] | None = None,
        history: list[dict] | None = None,
        hybrid: bool = False,
        language: str | None = "auto",
        model: str | None = None,
        accessible_documents: list[dict] | None = None,
    ) -> dict:
        prepared = self.prepare(query, user_id, tenant_id, top_k, group_ids, history,
                                hybrid=hybrid, language=language, model=model,
                                accessible_documents=accessible_documents)
        if not prepared.found:
            return {"answer": NOT_FOUND_ANSWER, "sources": [], "status": "not_found"}

        answer = llm_generate(prepared.prompt, model=prepared.model)
        status = "not_found" if looks_like_not_found(answer) else "answered"
        return {"answer": answer, "sources": prepared.sources if status == "answered" else [], "status": status}

    def stream(self, prepared: PreparedQuery, stop=None):
        return stream_answer(prepared.prompt, stop=stop, model=prepared.model)
