import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  InferenceJob,
  InferenceResult,
  Prediction,
  JobStatusResponse,
  JobResultsResponse,
  BehaviorId,
} from '../types'
import { BEHAVIOR_BY_ID } from '../constants/behaviors'

const API_BASE = '/api'

interface UseInferenceJobReturn {
  job: InferenceJob | null
  results: InferenceResult | null
  predictions: Prediction[]
  startInference: (videoId: string) => Promise<void>
  reset: () => void
  error: string | null
}

export function useInferenceJob(): UseInferenceJobReturn {
  const [job, setJob] = useState<InferenceJob | null>(null)
  const [results, setResults] = useState<InferenceResult | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const fetchJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`)
      if (!res.ok) {
        throw new Error(`Error fetching job status: ${res.status}`)
      }
      const data: JobStatusResponse = await res.json()
      return data
    } catch (err) {
      console.error('Error polling job status:', err)
      return null
    }
  }, [])

  const fetchJobResults = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/results`)
      if (!res.ok) {
        throw new Error(`Error fetching results: ${res.status}`)
      }
      const data: JobResultsResponse = await res.json()

      // Transform API response to frontend types
      const transformedPredictions: Prediction[] = data.predictions.map((p) => {
        const behavior = BEHAVIOR_BY_ID[p.behavior_id]
        return {
          behaviorId: p.behavior_id as BehaviorId,
          pred: p.pred,
          confidence: p.confidence,
          rubricText: p.rubric_text || behavior?.labels[p.pred] || '',
          segmentStart: p.segment_start,
          segmentEnd: p.segment_end,
        }
      })

      const result: InferenceResult = {
        jobId: data.job_id,
        videoId: data.video_id,
        predictions: transformedPredictions,
        metadata: {
          modelVersion: data.metadata.model_version,
          videoHash: data.metadata.video_hash,
          processedAt: data.metadata.processed_at,
          durationSec: data.metadata.duration_sec,
        },
      }

      return { result, predictions: transformedPredictions }
    } catch (err) {
      console.error('Error fetching results:', err)
      return null
    }
  }, [])

  const pollJob = useCallback(
    (jobId: string, videoId: string) => {
      const poll = async () => {
        const status = await fetchJobStatus(jobId)
        if (!status) return

        setJob((prev) => ({
          jobId,
          videoId,
          status: status.status,
          progress: status.progress,
          message: status.message,
          error: status.error,
          createdAt: prev?.createdAt || new Date().toISOString(),
          completedAt: status.status === 'completed' ? new Date().toISOString() : undefined,
        }))

        if (status.status === 'completed') {
          stopPolling()
          const resultData = await fetchJobResults(jobId)
          if (resultData) {
            setResults(resultData.result)
            setPredictions(resultData.predictions)
          }
        } else if (status.status === 'failed') {
          stopPolling()
          setError(status.error || 'Inference failed')
        }
      }

      // Initial poll
      void poll()

      // Start polling interval
      pollingRef.current = window.setInterval(poll, 1000)
    },
    [fetchJobStatus, fetchJobResults, stopPolling],
  )

  const startInference = useCallback(
    async (videoId: string) => {
      setError(null)
      setResults(null)
      setPredictions([])
      stopPolling()

      try {
        const res = await fetch(`${API_BASE}/infer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || `Error starting inference: ${res.status}`)
        }

        const data = await res.json()
        const jobId = data.job_id

        setJob({
          jobId,
          videoId,
          status: 'pending',
          progress: 0,
          message: 'Iniciando análisis...',
          createdAt: new Date().toISOString(),
        })

        // Start polling for job status
        pollJob(jobId, videoId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error starting inference'
        setError(message)
        setJob(null)
      }
    },
    [pollJob, stopPolling],
  )

  const reset = useCallback(() => {
    stopPolling()
    setJob(null)
    setResults(null)
    setPredictions([])
    setError(null)
  }, [stopPolling])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return {
    job,
    results,
    predictions,
    startInference,
    reset,
    error,
  }
}

