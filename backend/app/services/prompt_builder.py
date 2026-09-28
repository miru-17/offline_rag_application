"""
Prompt Builder Service

Builds the final prompt for the local LLM using:
1. Retrieved document context
2. User query
"""

from typing import Optional


def build_prompt(
    query: str,
    context: str,
) -> str:
    """
    Build a RAG prompt using the user's query and retrieved context.

    The LLM is instructed to answer only from the supplied context
    and avoid hallucinating information.
    """

    query = query.strip()
    context = context.strip()

    if not query:
        raise ValueError("Query cannot be empty.")

    if not context:
        context = "No relevant context was found in the uploaded documents."

    prompt = f"""
You are an AI assistant for an offline document question-answering system.

Your task is to answer the user's question using ONLY the information
provided in the context below.

IMPORTANT RULES:
1. Use only the provided context.
2. Do not use outside knowledge.
3. Do not invent or assume information.
4. If the answer is not available in the context, clearly say:
   "I could not find the answer in the uploaded documents."
5. Keep the answer clear and concise.
6. When possible, mention the source information provided in the context.

---------------- CONTEXT ----------------

{context}

-------------- END CONTEXT --------------

USER QUESTION:
{query}

ANSWER:
""".strip()

    return prompt


if __name__ == "__main__":
    # Test data
    test_context = """
[Source: resume.pdf, Chunk: 0]
Mirudhula K
Python, React, JavaScript

[Source: resume.pdf, Chunk: 1]
MediPredict and RentEdge projects

[Source: resume.pdf, Chunk: 2]
M.Sc. Integrated Information Technology
"""

    test_query = "What programming languages does Mirudhula know?"

    generated_prompt = build_prompt(
        query=test_query,
        context=test_context,
    )

    print("=" * 60)
    print("GENERATED PROMPT")
    print("=" * 60)
    print(generated_prompt)