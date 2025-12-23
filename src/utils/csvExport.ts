import type { Prediction, VideoMeta, InferenceResult } from '../types'
import { BEHAVIOR_BY_ID } from '../constants/behaviors'

function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function inferVideoId(fileName: string): string {
  const withoutExt = fileName.includes('.') ? fileName.split('.').slice(0, -1).join('.') : fileName
  return withoutExt || 'video'
}

export function exportPredictionsToCsv(
  predictions: Prediction[],
  videoMeta: VideoMeta,
  result?: InferenceResult | null,
) {
  const header = [
    'video_id',
    'file_name',
    'behavior_id',
    'behavior_name',
    'category',
    'prediction',
    'confidence',
    'rubric_text',
    'segment_start',
    'segment_end',
  ]

  const videoId = result?.videoId || inferVideoId(videoMeta.fileName)

  const rows = predictions.map((p) => {
    const behavior = BEHAVIOR_BY_ID[p.behaviorId]
    return [
      videoId,
      videoMeta.fileName,
      p.behaviorId,
      behavior?.name || '',
      behavior?.category || '',
      p.pred,
      p.confidence.toFixed(4),
      p.rubricText,
      p.segmentStart?.toFixed(2) ?? '',
      p.segmentEnd?.toFixed(2) ?? '',
    ]
  })

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${videoId}_predictions.csv`
  link.click()
  URL.revokeObjectURL(url)
}

