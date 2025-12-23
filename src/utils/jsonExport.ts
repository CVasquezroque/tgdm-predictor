import type { Prediction, VideoMeta, InferenceResult } from '../types'
import { BEHAVIOR_BY_ID } from '../constants/behaviors'

function inferVideoId(fileName: string): string {
  const withoutExt = fileName.includes('.') ? fileName.split('.').slice(0, -1).join('.') : fileName
  return withoutExt || 'video'
}

export interface ExportData {
  exportedAt: string
  video: {
    id: string
    fileName: string
    duration: number
    fps?: number
  }
  inference: {
    modelVersion: string
    videoHash: string
    processedAt: string
    durationSec: number
  } | null
  predictions: Array<{
    behaviorId: string
    behaviorName: string
    category: string
    prediction: number
    confidence: number
    rubricText: string
    segmentStart?: number
    segmentEnd?: number
    allCriteria: {
      0: string
      1: string
      2: string
    }
  }>
  summary: {
    totalBehaviors: number
    averageScore: number
    averageConfidence: number
    scoreDistribution: {
      0: number
      1: number
      2: number
    }
  }
}

export function exportPredictionsToJson(
  predictions: Prediction[],
  videoMeta: VideoMeta,
  result?: InferenceResult | null,
) {
  const videoId = result?.videoId || inferVideoId(videoMeta.fileName)

  const scoreDistribution = { 0: 0, 1: 0, 2: 0 }
  let totalScore = 0
  let totalConfidence = 0

  const enrichedPredictions = predictions.map((p) => {
    const behavior = BEHAVIOR_BY_ID[p.behaviorId]
    scoreDistribution[p.pred]++
    totalScore += p.pred
    totalConfidence += p.confidence

    return {
      behaviorId: p.behaviorId,
      behaviorName: behavior?.name || '',
      category: behavior?.category || '',
      prediction: p.pred,
      confidence: p.confidence,
      rubricText: p.rubricText,
      segmentStart: p.segmentStart,
      segmentEnd: p.segmentEnd,
      allCriteria: behavior?.labels || { 0: '', 1: '', 2: '' },
    }
  })

  const exportData: ExportData = {
    exportedAt: new Date().toISOString(),
    video: {
      id: videoId,
      fileName: videoMeta.fileName,
      duration: videoMeta.duration,
      fps: videoMeta.fps,
    },
    inference: result
      ? {
          modelVersion: result.metadata.modelVersion,
          videoHash: result.metadata.videoHash,
          processedAt: result.metadata.processedAt,
          durationSec: result.metadata.durationSec,
        }
      : null,
    predictions: enrichedPredictions,
    summary: {
      totalBehaviors: predictions.length,
      averageScore: predictions.length > 0 ? totalScore / predictions.length : 0,
      averageConfidence: predictions.length > 0 ? totalConfidence / predictions.length : 0,
      scoreDistribution,
    },
  }

  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${videoId}_predictions.json`
  link.click()
  URL.revokeObjectURL(url)
}

