"""
DIANA Inference Tool - FastAPI Backend
======================================
Local inference server with job-based processing and dummy mode support.
Supports both video and skeleton point inputs.
Single behavior per inference.
"""

import os
import json
import uuid
import hashlib
import time
import threading
import random
from pathlib import Path
from datetime import datetime
from typing import Optional, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configuration
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
SKELETONS_DIR = BASE_DIR / "skeletons"
RUNS_DIR = BASE_DIR / "runs"
MODELS_DIR = BASE_DIR / "models"
ASSETS_DIR = BASE_DIR / "assets"
LABEL_MAP_PATH = ASSETS_DIR / "label_map.json"

# Environment variables
DUMMY_MODE = os.environ.get("DIANA_DUMMY_MODE", "0") == "1"
MODEL_PATH = MODELS_DIR / "model.onnx"

# Create directories
UPLOADS_DIR.mkdir(exist_ok=True)
SKELETONS_DIR.mkdir(exist_ok=True)
RUNS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# In-memory job storage (for MVP - use Redis/DB in production)
jobs: dict = {}
jobs_lock = threading.Lock()

# Load label map
def load_label_map() -> dict:
    if LABEL_MAP_PATH.exists():
        with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

LABEL_MAP = load_label_map()
BEHAVIOR_IDS = list(LABEL_MAP.keys())


# ============================================
# Pydantic Models
# ============================================

class VideoUploadResponse(BaseModel):
    video_id: str
    stored_path: str
    duration: float
    fps: float


class SkeletonUploadRequest(BaseModel):
    filename: str
    data: dict


class SkeletonUploadResponse(BaseModel):
    skeleton_id: str
    stored_path: str
    frame_count: int
    fps: float


class InferenceRequest(BaseModel):
    input_id: str
    input_type: Literal["video", "skeleton"]
    behavior_id: str


class InferenceResponse(BaseModel):
    job_id: str


class JobStatus(BaseModel):
    status: str  # pending, processing, completed, failed
    progress: float
    message: str
    error: Optional[str] = None


class PredictionResult(BaseModel):
    behavior_id: str
    pred: int
    confidence: float
    rubric_text: str
    rubric_text_es: str


class InferenceMetadata(BaseModel):
    model_version: str
    input_hash: str
    processed_at: str


class JobResultsResponse(BaseModel):
    job_id: str
    input_id: str
    input_type: str
    behavior_id: str
    prediction: PredictionResult
    metadata: InferenceMetadata


# ============================================
# Helper Functions
# ============================================

def compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()[:16]


def compute_data_hash(data: dict) -> str:
    """Compute hash of data dictionary."""
    json_str = json.dumps(data, sort_keys=True)
    return hashlib.sha256(json_str.encode()).hexdigest()[:16]


def get_video_info(file_path: Path) -> tuple[float, float]:
    """
    Get video duration and FPS.
    For MVP, returns placeholder values. 
    In production, use ffprobe or opencv.
    """
    # TODO: Use ffprobe or opencv to get actual values
    return 30.0, 30.0  # duration, fps


def is_model_available() -> bool:
    """Check if inference model is available."""
    return MODEL_PATH.exists() and not DUMMY_MODE


def generate_dummy_prediction(behavior_id: str, input_hash: str) -> dict:
    """Generate realistic mock prediction for a single behavior."""
    random.seed(hash(f"{behavior_id}_{input_hash}"))  # Deterministic
    
    behavior = LABEL_MAP.get(behavior_id, {})
    labels = behavior.get("labels", {})
    labels_es = behavior.get("labels_es", {})
    
    # Generate realistic score with some variation
    pred = random.choices([0, 1, 2], weights=[0.2, 0.35, 0.45])[0]
    confidence = random.uniform(0.65, 0.95)
    
    return {
        "behavior_id": behavior_id,
        "pred": pred,
        "confidence": round(confidence, 4),
        "rubric_text": labels.get(str(pred), ""),
        "rubric_text_es": labels_es.get(str(pred), ""),
    }


def run_inference(
    input_path: Path,
    input_type: str,
    behavior_id: str,
    job_id: str,
    input_id: str,
):
    """
    Run inference for a single behavior.
    Supports both video and skeleton inputs.
    """
    try:
        # Update job status
        with jobs_lock:
            jobs[job_id]["status"] = "processing"
            jobs[job_id]["message"] = "Iniciando procesamiento..."
            jobs[job_id]["progress"] = 5

        # Compute input hash
        if input_type == "video":
            input_hash = compute_file_hash(input_path)
        else:
            with open(input_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            input_hash = compute_data_hash(data)
        
        # Simulate processing stages
        stages = [
            (15, "Cargando datos..."),
            (35, "Preprocesando..."),
            (55, "Extrayendo características..."),
            (75, f"Evaluando {behavior_id}..."),
            (90, "Generando predicción..."),
        ]
        
        for progress, message in stages:
            with jobs_lock:
                jobs[job_id]["progress"] = progress
                jobs[job_id]["message"] = message
            time.sleep(0.4)  # Simulate processing time
        
        # Generate prediction (dummy or real)
        if is_model_available():
            # TODO: Implement real model inference
            prediction = generate_dummy_prediction(behavior_id, input_hash)
        else:
            prediction = generate_dummy_prediction(behavior_id, input_hash)
        
        # Prepare results
        model_version = "dummy-v1.0" if not is_model_available() else "diana-v1.0"
        
        results = {
            "job_id": job_id,
            "input_id": input_id,
            "input_type": input_type,
            "behavior_id": behavior_id,
            "prediction": prediction,
            "metadata": {
                "model_version": model_version,
                "input_hash": input_hash,
                "processed_at": datetime.utcnow().isoformat() + "Z",
            }
        }
        
        # Save results to disk
        run_dir = RUNS_DIR / job_id
        run_dir.mkdir(exist_ok=True)
        
        with open(run_dir / "results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        # Save metadata
        metadata = {
            "job_id": job_id,
            "input_id": input_id,
            "input_type": input_type,
            "behavior_id": behavior_id,
            "input_path": str(input_path),
            "input_hash": input_hash,
            "model_version": model_version,
            "started_at": jobs[job_id].get("created_at"),
            "completed_at": datetime.utcnow().isoformat() + "Z",
            "dummy_mode": not is_model_available(),
        }
        
        with open(run_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        # Update job as completed
        with jobs_lock:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["message"] = "Análisis completado"
            jobs[job_id]["results"] = results
            
    except Exception as e:
        with jobs_lock:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)
            jobs[job_id]["message"] = f"Error: {str(e)}"


# ============================================
# FastAPI App
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("=" * 50)
    print("DIANA Inference Tool - Backend Server")
    print("=" * 50)
    print(f"Dummy Mode: {'ENABLED' if DUMMY_MODE or not MODEL_PATH.exists() else 'DISABLED'}")
    print(f"Model Path: {MODEL_PATH}")
    print(f"Model Available: {MODEL_PATH.exists()}")
    print(f"Uploads Dir: {UPLOADS_DIR}")
    print(f"Skeletons Dir: {SKELETONS_DIR}")
    print(f"Runs Dir: {RUNS_DIR}")
    print(f"Behaviors Loaded: {len(BEHAVIOR_IDS)}")
    print(f"Behaviors: {', '.join(BEHAVIOR_IDS)}")
    print("=" * 50)
    yield
    # Shutdown
    print("Shutting down server...")


app = FastAPI(
    title="DIANA Inference Tool API",
    description="Local inference backend for motor skill prediction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "model_available": is_model_available(),
        "dummy_mode": DUMMY_MODE or not MODEL_PATH.exists(),
        "behaviors_count": len(BEHAVIOR_IDS),
        "behaviors": BEHAVIOR_IDS,
    }


@app.post("/api/videos", response_model=VideoUploadResponse)
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a video file for processing.
    Returns video_id and metadata.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Validate file type
    allowed_extensions = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Generate video ID
    video_id = str(uuid.uuid4())
    
    # Save file
    file_path = UPLOADS_DIR / f"{video_id}{ext}"
    
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Get video info
    duration, fps = get_video_info(file_path)
    
    return VideoUploadResponse(
        video_id=video_id,
        stored_path=str(file_path),
        duration=duration,
        fps=fps,
    )


@app.post("/api/skeletons", response_model=SkeletonUploadResponse)
async def upload_skeleton(request: SkeletonUploadRequest):
    """
    Upload skeleton points data (JSON).
    Returns skeleton_id and metadata.
    """
    # Generate skeleton ID
    skeleton_id = str(uuid.uuid4())
    
    # Save data
    file_path = SKELETONS_DIR / f"{skeleton_id}.json"
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({
                "filename": request.filename,
                "data": request.data,
                "uploaded_at": datetime.utcnow().isoformat() + "Z",
            }, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save skeleton data: {str(e)}")
    
    # Try to extract frame count from data
    # Supports multiple skeleton JSON formats:
    # - OpenPose format: {"data": [{"frame_index": 1, "skeleton": [...]}, ...]}
    # - Alternative formats: {"keypoints": [...]}, {"frames": [...]}, {"skeleton": [...]}
    frame_count = 0
    data = request.data
    if "data" in data and isinstance(data["data"], list):
        # OpenPose format: data contains array of frame objects
        frame_count = len(data["data"])
    elif "keypoints" in data and isinstance(data["keypoints"], list):
        frame_count = len(data["keypoints"])
    elif "frames" in data and isinstance(data["frames"], list):
        frame_count = len(data["frames"])
    elif "skeleton" in data and isinstance(data["skeleton"], list):
        frame_count = len(data["skeleton"])
    
    return SkeletonUploadResponse(
        skeleton_id=skeleton_id,
        stored_path=str(file_path),
        frame_count=frame_count,
        fps=30.0,  # Default FPS
    )


@app.post("/api/infer", response_model=InferenceResponse)
async def start_inference(request: InferenceRequest, background_tasks: BackgroundTasks):
    """
    Start inference job for a single behavior.
    Supports both video and skeleton inputs.
    Returns job_id for tracking progress.
    """
    input_id = request.input_id
    input_type = request.input_type
    behavior_id = request.behavior_id
    
    # Validate behavior_id
    if behavior_id not in BEHAVIOR_IDS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid behavior_id. Valid options: {', '.join(BEHAVIOR_IDS)}"
        )
    
    # Find input file
    input_path = None
    if input_type == "video":
        for ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            candidate = UPLOADS_DIR / f"{input_id}{ext}"
            if candidate.exists():
                input_path = candidate
                break
    else:  # skeleton
        candidate = SKELETONS_DIR / f"{input_id}.json"
        if candidate.exists():
            input_path = candidate
    
    if not input_path:
        raise HTTPException(status_code=404, detail=f"{input_type.capitalize()} not found")
    
    # Create job
    job_id = str(uuid.uuid4())
    
    with jobs_lock:
        jobs[job_id] = {
            "job_id": job_id,
            "input_id": input_id,
            "input_type": input_type,
            "behavior_id": behavior_id,
            "status": "pending",
            "progress": 0,
            "message": "En cola...",
            "error": None,
            "results": None,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
    
    # Start background processing
    background_tasks.add_task(
        run_inference, 
        input_path, 
        input_type, 
        behavior_id, 
        job_id, 
        input_id
    )
    
    return InferenceResponse(job_id=job_id)


@app.get("/api/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get status of inference job."""
    with jobs_lock:
        job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatus(
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
        error=job.get("error"),
    )


@app.get("/api/jobs/{job_id}/results", response_model=JobResultsResponse)
async def get_job_results(job_id: str):
    """Get results of completed inference job."""
    with jobs_lock:
        job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400, 
            detail=f"Job not completed. Current status: {job['status']}"
        )
    
    results = job.get("results")
    if not results:
        # Try to load from disk
        results_path = RUNS_DIR / job_id / "results.json"
        if results_path.exists():
            with open(results_path, "r", encoding="utf-8") as f:
                results = json.load(f)
        else:
            raise HTTPException(status_code=500, detail="Results not found")
    
    return JobResultsResponse(
        job_id=results["job_id"],
        input_id=results["input_id"],
        input_type=results["input_type"],
        behavior_id=results["behavior_id"],
        prediction=PredictionResult(**results["prediction"]),
        metadata=InferenceMetadata(**results["metadata"]),
    )


@app.get("/api/behaviors")
async def get_behaviors():
    """Get list of all behaviors with their criteria."""
    return {
        "behaviors": LABEL_MAP,
        "count": len(BEHAVIOR_IDS),
        "ids": BEHAVIOR_IDS,
    }


# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
