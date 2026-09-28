"""
Ollama Service

Handles communication between the RAG application
and the locally running Ollama LLM.
"""

import requests
import os

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://localhost:11434/api/generate"
)


MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:3b")


def generate_answer(prompt: str) -> str:
    """
    Send the generated RAG prompt to Ollama
    and return the generated answer.
    """

    if not prompt.strip():
        raise ValueError("Prompt cannot be empty.")

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
    }

    response = requests.post(
        OLLAMA_URL,
        json=payload,
        timeout=120,
    )

    response.raise_for_status()

    result = response.json()

    return result.get("response", "").strip()


if __name__ == "__main__":
    test_prompt = """
You are an AI assistant.

Answer ONLY using the context provided below.

Context:
[Source: resume.pdf, Chunk: 0]
Mirudhula K
Python, React, JavaScript

Question:
What programming languages are mentioned in the context?

Answer:
"""

    answer = generate_answer(test_prompt)

    print("=" * 60)
    print("OLLAMA RESPONSE")
    print("=" * 60)
    print(answer)