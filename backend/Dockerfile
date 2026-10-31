FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/hf_cache \
    UPLOAD_ROOT=/app/uploads \
    CHROMA_PATH=/app/chroma_db \
    REPORTS_DIR=/app/reports

# Tesseract reads scanned PDFs and photos (OCR). English + Tamil + Hindi.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-tam tesseract-ocr-hin \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch: avoids ~3 GB of CUDA libraries a laptop cannot use.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# The API runs as an unprivileged user. The entrypoint starts as root only to
# give that user ownership of the data volumes (also volumes from older
# versions), then drops privileges.
RUN useradd --system --uid 10001 --home-dir /app ragentis \
    && mkdir -p /app/uploads /app/chroma_db /app/reports /hf_cache \
    && chown -R ragentis:ragentis /app/uploads /app/chroma_db /app/reports /hf_cache \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
# Prepare the database (create tables / apply migrations / seed defaults),
# then start the API. Safe on every start; existing data is never dropped.
CMD ["sh", "-c", "python -m app.database.bootstrap && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
