from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Polski Lektor AI TTS")

MODELS_DIR = Path(os.getenv("TTS_MODELS_DIR", "/models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)


class DatasetManifest(BaseModel):
    manifest_path: str
    samples: int


class TrainRequest(BaseModel):
    modelId: str
    architecture: str = "vits"
    epochs: int = 5
    learning_rate: float = 0.0001
    datasetManifest: str | None = None


class TrainStatus(BaseModel):
    id: str
    status: str
    progress: float
    message: str | None = None


TRAINING_STATUS: Dict[str, TrainStatus] = {}


@app.post("/dataset/prepare")
async def dataset_prepare(files: list[UploadFile]) -> DatasetManifest:
    manifest_path = MODELS_DIR / "manifest-demo.jsonl"
    entries: list[dict[str, Any]] = []
    for file in files:
        content = await file.read()
        entries.append({"path": file.filename, "text": file.filename.replace(".wav", "")})
        (MODELS_DIR / file.filename).write_bytes(content)
    manifest_path.write_text("\n".join(json.dumps(entry) for entry in entries), encoding="utf-8")
    return DatasetManifest(manifest_path=str(manifest_path), samples=len(entries))


@app.post("/train")
async def train(request: TrainRequest) -> TrainStatus:
    status = TrainStatus(id=request.modelId, status="training", progress=0.1)
    TRAINING_STATUS[request.modelId] = status

    async def _simulate_training() -> None:
        for step in range(1, request.epochs + 1):
            await asyncio.sleep(0.1)
            TRAINING_STATUS[request.modelId] = TrainStatus(
                id=request.modelId,
                status="training",
                progress=min(0.1 + step / request.epochs, 0.9),
                message=f"Epoka {step}/{request.epochs}"
            )
        (MODELS_DIR / request.modelId).mkdir(parents=True, exist_ok=True)
        TRAINING_STATUS[request.modelId] = TrainStatus(
            id=request.modelId,
            status="ready",
            progress=1.0,
            message="Trening ukończony"
        )

    asyncio.create_task(_simulate_training())
    return status


@app.get("/train/{model_id}/status")
async def train_status(model_id: str) -> TrainStatus:
    status = TRAINING_STATUS.get(model_id)
    if status is None:
        return TrainStatus(id=model_id, status="unknown", progress=0.0)
    return status


class TtsRequest(BaseModel):
    text: str
    metadata: Dict[str, Any] | None = None


async def sine_wave(duration: float = 1.0, sample_rate: int = 22050) -> bytes:
    import io

    import numpy as np
    import soundfile as sf

    t = np.linspace(0, duration, int(sample_rate * duration), False)
    tone = 0.2 * np.sin(2 * np.pi * 440 * t)
    buffer = io.BytesIO()
    sf.write(buffer, tone, sample_rate, format="WAV")
    buffer.seek(0)
    return buffer.read()


@app.post("/tts/{model_id}")
async def tts(model_id: str, payload: TtsRequest):
    audio = await sine_wave()
    headers = {"X-Model-Id": model_id, "X-Watermark": "syntetyczny"}
    return StreamingResponse(iter([audio]), media_type="audio/wav", headers=headers)


class WatermarkRequest(BaseModel):
    marker: str
    payload: str


@app.post("/watermark/apply")
async def watermark_apply(request: WatermarkRequest) -> Dict[str, str]:
    return {"status": "ok", "marker": request.marker, "payload": request.payload}
