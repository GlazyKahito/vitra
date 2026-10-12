"""Start the VITRA CV service: python run.py  (binds 127.0.0.1:8001 by default)."""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "vitra_cv.app:app",
        host=os.environ.get("CV_HOST", "127.0.0.1"),
        port=int(os.environ.get("CV_PORT", "8001")),
        log_level=os.environ.get("CV_LOG_LEVEL", "info"),
    )
