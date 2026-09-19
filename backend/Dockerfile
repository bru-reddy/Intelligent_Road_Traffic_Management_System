FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY seed_data.py .
COPY data ./data

EXPOSE 8000

CMD ["sh", "-c", "python seed_data.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
