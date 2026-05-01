"""
Decision Quality Auditor — FastAPI Service

Exposes the trained sklearn model via HTTP endpoints.
Trains/loads model on startup, then serves audit requests.
"""

import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model import DecisionQualityAuditor, BIAS_EMOJIS, BIAS_DESCRIPTIONS

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Decision Quality Auditor", version="1.0.0")

# CORS — allow the Node.js backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global auditor instance
auditor = DecisionQualityAuditor()


@app.on_event("startup")
async def startup_event():
    """Load or train the model on startup."""
    logger.info("Starting Decision Quality Auditor service...")
    auditor.load_or_train()
    logger.info("Model ready! Service is accepting requests.")


# ─── Request/Response Models ────────────────────────────────────────────────────

class CaptionEntry(BaseModel):
    speaker: str = "Unknown"
    text: str
    timestamp: str = ""


class SingleAuditRequest(BaseModel):
    text: str


class SingleAuditResponse(BaseModel):
    score: float
    detected_biases: List[str]
    bias_probabilities: dict
    recommendations: List[str]


# ─── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "model_trained": auditor.trained}


@app.post("/audit-single")
async def audit_single(request: SingleAuditRequest):
    """
    Audit a single text snippet for cognitive biases.
    Used for real-time caption-by-caption analysis.
    """
    if not auditor.trained:
        raise HTTPException(status_code=503, detail="Model not ready yet")

    if not request.text or len(request.text.strip()) < 3:
        return {
            "score": 100,
            "detected_biases": [],
            "bias_probabilities": {},
            "recommendations": [],
            "message": "Text too short for analysis"
        }

    try:
        result = auditor.audit_decision(request.text)
        return result
    except Exception as e:
        logger.error(f"Error auditing single text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/audit-decisions")
async def audit_decisions(captions: List[CaptionEntry]):
    """
    Full transcript audit — segments transcript into decision blocks,
    audits each, returns meeting-level report.
    """
    if not auditor.trained:
        raise HTTPException(status_code=503, detail="Model not ready yet")

    entries = [{"speaker": c.speaker, "text": c.text, "timestamp": c.timestamp}
               for c in captions]

    try:
        report = auditor.audit_full_transcript(entries)
        return report
    except Exception as e:
        logger.error(f"Error auditing transcript: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/audit-per-speaker")
async def audit_per_speaker(captions: List[CaptionEntry]):
    """
    Per-speaker audit — analyzes each speaker's combined text for biases.
    Returns a per-speaker breakdown of decision quality.
    """
    if not auditor.trained:
        raise HTTPException(status_code=503, detail="Model not ready yet")

    entries = [{"speaker": c.speaker, "text": c.text, "timestamp": c.timestamp}
               for c in captions]

    try:
        speaker_audits = auditor.audit_per_speaker(entries)
        return {
            "speaker_audits": speaker_audits,
            "bias_emojis": BIAS_EMOJIS,
            "bias_descriptions": BIAS_DESCRIPTIONS
        }
    except Exception as e:
        logger.error(f"Error in per-speaker audit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/meta")
async def meta():
    """Return model metadata (bias types, emojis, descriptions)."""
    return {
        "bias_emojis": BIAS_EMOJIS,
        "bias_descriptions": BIAS_DESCRIPTIONS
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
