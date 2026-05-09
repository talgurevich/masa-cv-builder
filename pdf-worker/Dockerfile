FROM python:3.12-slim

# Chromium + fontconfig + a Hebrew-capable font set (Noto covers Hebrew well)
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-core \
      fonts-noto-hinted \
      fonts-noto-extra \
      fonts-liberation \
      fontconfig \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py generate_pdf.py ./
COPY templates ./templates

ENV CHROME_PATH=/usr/bin/chromium \
    PYTHONUNBUFFERED=1 \
    PORT=8080

EXPOSE 8080

CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8080", "--timeout", "60", "app:app"]
