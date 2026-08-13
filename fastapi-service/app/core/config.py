"""
CONFIG — fastapi-service/app/core/config.py

WHAT: Centralizes environment-driven settings (host, port, fake model
      latency) in a single Pydantic Settings object.

WHY IT EXISTS: so no other file reaches into os.environ directly. Same
      instinct as a single config module + dotenv setup in an Express app
      — one source of truth for "what can be configured from outside".

      Note this is Pydantic doing double duty: the SAME library that
      validates incoming HTTP request bodies (schemas/requests.py) is
      also used here to validate environment variables at process
      startup. That's a genuinely different use of Pydantic than
      anything in the Express/Mongoose world.

WHO CALLS THIS: imported wherever a setting is needed (main.py,
      models/fake_model.py, etc).
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000              # Uvicorn / REST port
    grpc_port: int = 50051        # gRPC server port — a SEPARATE port from REST,
                                   # because these are two independent servers
                                   # sharing one process, not one server speaking
                                   # two protocols on one port.
    fake_model_latency_ms: int = 150  # simulated "ML inference" time

    class Config:
        env_prefix = "AI_SERVICE_"


settings = Settings()
