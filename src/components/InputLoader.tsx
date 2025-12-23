import type { ChangeEvent } from 'react'
import { useState } from 'react'
import type { InputType } from '../types'

interface Props {
  onVideoSelected: (file: File) => void
  onSkeletonSelected: (file: File, data: unknown) => void
  disabled?: boolean
}

export function InputLoader({ onVideoSelected, onSkeletonSelected, disabled }: Props) {
  const [activeTab, setActiveTab] = useState<InputType>('video')
  const [error, setError] = useState<string | null>(null)

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setError(null)
      onVideoSelected(file)
    }
  }

  const handleSkeletonChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file extension
    if (!file.name.endsWith('.json')) {
      setError('El archivo debe ser formato JSON')
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Basic validation of skeleton data structure
      // Supports: OpenPose format (data), keypoints, frames, skeleton
      if (!data.data && !data.keypoints && !data.frames && !data.skeleton) {
        setError('El JSON no tiene estructura de skeleton válida (data/keypoints/frames/skeleton)')
        return
      }

      onSkeletonSelected(file, data)
    } catch (err) {
      setError('Error al leer el archivo JSON: ' + (err instanceof Error ? err.message : 'formato inválido'))
    }
  }

  return (
    <div className="input-loader">
      <div className="input-tabs">
        <button
          className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
          disabled={disabled}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" />
          </svg>
          Video
        </button>
        <button
          className={`tab-btn ${activeTab === 'skeleton' ? 'active' : ''}`}
          onClick={() => setActiveTab('skeleton')}
          disabled={disabled}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="2" />
            <line x1="12" y1="7" x2="12" y2="14" />
            <line x1="8" y1="10" x2="16" y2="10" />
            <line x1="12" y1="14" x2="8" y2="20" />
            <line x1="12" y1="14" x2="16" y2="20" />
          </svg>
          Skeleton
        </button>
      </div>

      <div className="input-content">
        {activeTab === 'video' ? (
          <label className={`file-picker ${disabled ? 'disabled' : ''}`}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="picker-text">
              <span className="picker-title">Cargar Video</span>
              <span className="picker-hint">MP4, MOV, AVI, MKV, WebM</span>
            </div>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              disabled={disabled}
            />
          </label>
        ) : (
          <label className={`file-picker skeleton ${disabled ? 'disabled' : ''}`}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <div className="picker-text">
              <span className="picker-title">Cargar Skeleton Points</span>
              <span className="picker-hint">Archivo JSON con keypoints</span>
            </div>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleSkeletonChange}
              disabled={disabled}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="input-error">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}

