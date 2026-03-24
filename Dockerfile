FROM python:3.11-slim

WORKDIR /app

# System deps for XGBoost
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY pyproject.toml .
COPY readme.md .

# Copy source
COPY honeycloud/ ./honeycloud/
COPY api/ ./api/

RUN pip install --no-cache-dir -e ".[server]" || pip install --no-cache-dir -e .

# Install server-specific deps not in pyproject.toml
RUN pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    asyncpg \
    psycopg2-binary

CMD ["honeycloud", "serve", "--host", "0.0.0.0", "--port", "8000"]