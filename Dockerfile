FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2 and XGBoost
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY pyproject.toml .
COPY README.md .
RUN pip install --no-cache-dir -e ".[server]" || pip install --no-cache-dir -e .

# Install server-specific deps not in pyproject.toml
RUN pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    psycopg2-binary

# Copy source
COPY honeycloud/ ./honeycloud/
COPY api/ ./api/

# Default command — overridden per service in docker-compose
CMD ["honeycloud", "serve", "--host", "0.0.0.0", "--port", "8000"]