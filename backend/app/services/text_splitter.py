from functools import lru_cache

from transformers import AutoTokenizer
from langchain_text_splitters import RecursiveCharacterTextSplitter


# --------------------------------------------------
# Local Tokenizer Configuration
# --------------------------------------------------

TOKENIZER_NAME = "sentence-transformers/all-MiniLM-L6-v2"

# MiniLM supports a maximum sequence length of 512 tokens.
# Keep chunks slightly below that limit.
DEFAULT_CHUNK_SIZE = 500
DEFAULT_CHUNK_OVERLAP = 100


# --------------------------------------------------
# Load Tokenizer Once
# --------------------------------------------------

@lru_cache(maxsize=1)
def get_tokenizer():
    """
    Load the local tokenizer used for token-based chunking.

    The tokenizer is cached so it is loaded only once
    during the application lifetime.
    """

    try:
        return AutoTokenizer.from_pretrained(
            TOKENIZER_NAME,
            local_files_only=True,
        )
    except Exception:
        # First-time setup: download once, then it is cached offline.
        return AutoTokenizer.from_pretrained(TOKENIZER_NAME)


# --------------------------------------------------
# Token Length Function
# --------------------------------------------------

def token_length(text: str) -> int:
    """
    Return the number of tokens in the text using
    the local MiniLM tokenizer.
    """

    tokenizer = get_tokenizer()

    return len(
        tokenizer.encode(
            text,
            add_special_tokens=False,
        )
    )


# --------------------------------------------------
# Split Text
# --------------------------------------------------

def split_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """
    Split extracted document text into overlapping
    token-based chunks.

    Default:
        chunk_size    = 500 tokens
        chunk_overlap = 100 tokens

    The 500-token size keeps chunks within the
    MiniLM embedding model's 512-token limit.
    """

    # --------------------------------------------------
    # Validate input
    # --------------------------------------------------

    if not text or not text.strip():
        raise ValueError(
            "Cannot split empty text."
        )

    if chunk_size < 500 or chunk_size > 1000:
        raise ValueError(
            "chunk_size must be between 500 and 1000 tokens."
        )

    if chunk_overlap < 0:
        raise ValueError(
            "chunk_overlap cannot be negative."
        )

    if chunk_overlap >= chunk_size:
        raise ValueError(
            "chunk_overlap must be smaller than chunk_size."
        )

    # --------------------------------------------------
    # Create token-aware splitter
    # --------------------------------------------------

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=token_length,
        separators=[
            "\n\n",
            "\n",
            ". ",
            " ",
            "",
        ],
    )

    # --------------------------------------------------
    # Generate chunks
    # --------------------------------------------------

    chunks = splitter.split_text(text)

    # --------------------------------------------------
    # Clean chunks
    # --------------------------------------------------

    return [
        chunk.strip()
        for chunk in chunks
        if chunk.strip()
    ]