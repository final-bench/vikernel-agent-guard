FROM python:3.12-slim
RUN useradd -m -u 1000 user
WORKDIR /app
COPY --chown=1000 . /app
USER 1000
EXPOSE 7860
CMD ["python", "server.py"]
