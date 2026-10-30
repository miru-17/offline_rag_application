"""
Ollama (local LLM) client.

A process-wide semaphore lets only LLM_MAX_CONCURRENCY generations run at
once (default 1 on a CPU laptop). Further requests wait in line up to
LLM_QUEUE_WAIT_SECONDS and then get a clear "busy" error instead of
overloading the machine.
"""

from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from typing import Iterator

import requests

from app.core.config import (
    LLM_MAX_CONCURRENCY,
    LLM_QUEUE_WAIT_SECONDS,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_NUM_CTX,
    OLLAMA_TIMEOUT_SECONDS,
)

MODEL_NAME = OLLAMA_MODEL
GENERATE_URL = f"{OLLAMA_BASE_URL}/api/generate"
TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"

_slots = threading.BoundedSemaphore(max(1, LLM_MAX_CONCURRENCY))
_waiting = 0
_waiting_lock = threading.Lock()


class LLMError(RuntimeError):
    """The local model could not produce an answer. Message is user-safe."""


class LLMBusy(LLMError):
    pass


@contextmanager
def llm_slot():
    global _waiting
    with _waiting_lock:
        _waiting += 1
    try:
        acquired = _slots.acquire(timeout=LLM_QUEUE_WAIT_SECONDS)
    finally:
        with _waiting_lock:
            _waiting -= 1
    if not acquired:
        raise LLMBusy("The AI engine is busy with other requests. Please try again in a moment.")
    try:
        yield
    finally:
        _slots.release()


def queue_depth() -> int:
    return _waiting


def _payload(prompt: str, stream: bool, json_mode: bool, temperature: float, max_tokens: int | None) -> dict:
    options = {"temperature": temperature, "num_ctx": OLLAMA_NUM_CTX}
    if max_tokens:
        options["num_predict"] = max_tokens
    payload = {"model": MODEL_NAME, "prompt": prompt, "stream": stream, "options": options}
    if json_mode:
        payload["format"] = "json"
    return payload


def generate_answer(
    prompt: str,
    json_mode: bool = False,
    temperature: float = 0.1,
    max_tokens: int | None = None,
) -> str:
    if not prompt.strip():
        raise ValueError("Prompt cannot be empty.")

    with llm_slot():
        try:
            response = requests.post(
                GENERATE_URL,
                json=_payload(prompt, False, json_mode, temperature, max_tokens),
                timeout=OLLAMA_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return (response.json().get("response") or "").strip()
        except requests.Timeout:
            raise LLMError("The AI engine took too long to answer. Try a shorter question.")
        except (requests.RequestException, ValueError):
            raise LLMError("The local AI engine is not reachable. Check that Ollama is running.")


def stream_answer(prompt: str, temperature: float = 0.1, stop: threading.Event | None = None) -> Iterator[str]:
    """
    Yield the answer piece by piece. Closing the generator (client pressed
    Stop or disconnected) closes the HTTP stream, which makes Ollama stop
    generating.
    """

    if not prompt.strip():
        raise ValueError("Prompt cannot be empty.")

    with llm_slot():
        try:
            response = requests.post(
                GENERATE_URL,
                json=_payload(prompt, True, False, temperature, None),
                timeout=(10, OLLAMA_TIMEOUT_SECONDS),
                stream=True,
            )
            response.raise_for_status()
        except requests.Timeout:
            raise LLMError("The AI engine took too long to answer. Try a shorter question.")
        except requests.RequestException:
            raise LLMError("The local AI engine is not reachable. Check that Ollama is running.")

        try:
            for line in response.iter_lines():
                if stop is not None and stop.is_set():
                    break
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except ValueError:
                    continue
                piece = data.get("response")
                if piece:
                    yield piece
                if data.get("done"):
                    break
        except requests.RequestException:
            raise LLMError("The connection to the AI engine was interrupted.")
        finally:
            response.close()


def model_status(timeout: float = 2.0) -> dict:
    try:
        response = requests.get(TAGS_URL, timeout=timeout)
        if response.status_code != 200:
            return {"ollama": "offline", "model_status": "unavailable"}
        names = {m.get("name") for m in response.json().get("models", [])}
        return {"ollama": "online", "model_status": "available" if MODEL_NAME in names else "missing"}
    except (requests.RequestException, ValueError):
        return {"ollama": "offline", "model_status": "unavailable"}
