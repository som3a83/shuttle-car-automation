FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/shuttle-gateway
COPY gateway.py config.example.json ./
RUN useradd --system --uid 10001 gateway && mkdir -p /var/lib/shuttle-gateway && chown -R gateway:gateway /opt/shuttle-gateway /var/lib/shuttle-gateway
USER gateway
ENV SHUTTLE_GATEWAY_BIND=0.0.0.0 SHUTTLE_GATEWAY_PORT=8765 SHUTTLE_GATEWAY_DB=/var/lib/shuttle-gateway/telemetry.sqlite3 SHUTTLE_GATEWAY_CONFIG=/opt/shuttle-gateway/config.example.json
EXPOSE 8765
CMD ["python", "gateway.py"]
