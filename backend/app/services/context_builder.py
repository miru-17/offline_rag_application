class ContextBuilder:

    def build_context(self, results) -> str:
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        if not documents:
            return ""

        context_parts = []

        for index, document in enumerate(documents):

            metadata = (
                metadatas[index]
                if index < len(metadatas)
                else {}
            )

            filename = metadata.get(
                "filename",
                "Unknown document"
            )

            chunk_index = metadata.get(
                "chunk_index",
                index
            )

            context_parts.append(
                f"[Source: {filename}, "
                f"Chunk: {chunk_index}]\n"
                f"{document}"
            )

        return "\n\n".join(context_parts)