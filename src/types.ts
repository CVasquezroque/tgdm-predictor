// ============================================
// DIANA Inference Tool - Type Definitions
// ============================================

export type BehaviorId =
  | 'A01'
  | 'A02'
  | 'A03'
  | 'A04'
  | 'B01'
  | 'B02'
  | 'B03'
  | 'B04'
  | 'C01'
  | 'C02'
  | 'C03'
  | 'C04'

export type PredictionScore = 0 | 1 | 2

export interface BehaviorDefinition {
  id: BehaviorId
  name: string
  nameEs?: string
  category: string
  labels: {
    0: string
    1: string
    2: string
  }
  labelsEs?: {
    0: string
    1: string
    2: string
  }
  color: string
}

export interface Prediction {
  behaviorId: BehaviorId
  pred: PredictionScore
  confidence: number
  rubricText: string
  rubricTextEs?: string
}

export interface VideoMeta {
  fileName: string
  filePath: string
  duration: number
  fps?: number
  videoId?: string
}

export interface SkeletonData {
  fileName: string
  frameCount: number
  fps?: number
  keypoints: number[][][]  // [frame][keypoint][x,y,confidence]
}

export type InputType = 'video' | 'skeleton'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface InferenceJob {
  jobId: string
  inputId: string
  inputType: InputType
  behaviorId: BehaviorId
  status: JobStatus
  progress: number
  message: string
  error?: string
  createdAt: string
  completedAt?: string
}

export interface InferenceResult {
  jobId: string
  inputId: string
  inputType: InputType
  behaviorId: BehaviorId
  prediction: Prediction
  metadata: {
    modelVersion: string
    inputHash: string
    processedAt: string
  }
}

// API Response types
export interface UploadVideoResponse {
  video_id: string
  stored_path: string
  duration: number
  fps: number
}

export interface UploadSkeletonResponse {
  skeleton_id: string
  stored_path: string
  frame_count: number
  fps: number
}

export interface StartInferenceResponse {
  job_id: string
}

export interface JobStatusResponse {
  status: JobStatus
  progress: number
  message: string
  error?: string
}

export interface JobResultsResponse {
  job_id: string
  input_id: string
  input_type: InputType
  behavior_id: BehaviorId
  prediction: {
    behavior_id: BehaviorId
    pred: PredictionScore
    confidence: number
    rubric_text: string
    rubric_text_es: string
  }
  metadata: {
    model_version: string
    input_hash: string
    processed_at: string
  }
}
