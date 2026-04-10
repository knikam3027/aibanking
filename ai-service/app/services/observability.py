"""
Observability & Structured Logging for the Agent Orchestration System.
Provides JSON-structured logging, request tracing, and performance metrics.
"""

import logging
import json
import time
import os
from functools import wraps
from typing import Any, Callable


def setup_logging():
    """Configure structured JSON logging for the AI service."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_entry = {
                "timestamp": self.formatTime(record),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "service": "ai-banking-service",
                "version": "2.0.0",
            }
            if record.exc_info and record.exc_info[0]:
                log_entry["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_entry)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))
    root_logger.handlers = [handler]

    return root_logger


def track_performance(func: Callable) -> Callable:
    """Decorator to log function execution time and result status."""
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        logger = logging.getLogger(func.__module__)
        start = time.time()
        try:
            result = func(*args, **kwargs)
            duration = round((time.time() - start) * 1000, 2)
            logger.info(f"{func.__name__} completed in {duration}ms")
            return result
        except Exception as e:
            duration = round((time.time() - start) * 1000, 2)
            logger.error(f"{func.__name__} failed after {duration}ms: {e}")
            raise
    return wrapper


# Initialize on import
setup_logging()
