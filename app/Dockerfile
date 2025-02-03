FROM python:slim-bullseye
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
ENTRYPOINT ["gunicorn", "--workers", "5", "--threads", "1", "--bind", "0.0.0.0:8000", "--timeout", "90", "app:app"]
